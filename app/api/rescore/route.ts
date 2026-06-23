import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { SCREENING_SYSTEM_PROMPT, buildScreeningUserPrompt } from '@/lib/prompts/screening';

const anthropic = new Anthropic();
const CONCURRENCY = 5;

interface RubricInput {
  id: string;
  name: string;
  description: string;
  weight: number;
  maxScore: number;
}

interface CriterionScore {
  score: number;
  max_score: number;
  weight: number;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { projectId, rubric } = await request.json() as { projectId: string; rubric: RubricInput[] };

  if (!projectId || !rubric?.length) {
    return NextResponse.json({ error: 'Missing projectId or rubric' }, { status: 400 });
  }

  // Validate weights sum to ~1.0
  const totalWeight = rubric.reduce((sum, r) => sum + r.weight, 0);
  if (Math.abs(totalWeight - 1.0) > 0.02) {
    return NextResponse.json(
      { error: `Weights must sum to 100% (currently ${Math.round(totalWeight * 100)}%)` },
      { status: 400 }
    );
  }

  // 1. Persist updated rubric criteria to Supabase
  for (const criterion of rubric) {
    const { error } = await supabase
      .from('rubrics')
      .update({
        criterion: criterion.name,
        description: criterion.description,
        weight: criterion.weight,
        max_score: criterion.maxScore,
      })
      .eq('id', criterion.id)
      .eq('project_id', projectId);

    if (error) console.warn(`Failed to update criterion ${criterion.name}:`, error.message);
  }

  // 2. Fetch candidates that have resume text
  const { data: candidates, error: candidatesError } = await supabase
    .from('candidates')
    .select('id, resume_text, source_filename')
    .eq('project_id', projectId);

  if (candidatesError) {
    return NextResponse.json({ error: candidatesError.message }, { status: 500 });
  }

  const scoreable = (candidates || []).filter((c) => c.resume_text);
  if (scoreable.length === 0) {
    return NextResponse.json(
      { error: 'No resume text found. Please re-upload resumes to enable re-ranking.' },
      { status: 400 }
    );
  }

  // Map rubric input to the shape the prompt builder expects
  const rubricForPrompt = rubric.map((r) => ({
    criterion: r.name,
    description: r.description,
    max_score: r.maxScore,
    weight: r.weight,
  }));

  let rescored = 0;

  async function rescoreCandidate(candidate: { id: string; resume_text: string }) {
    try {
      const message = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        system: SCREENING_SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: buildScreeningUserPrompt(candidate.resume_text, rubricForPrompt) },
        ],
      });

      let text = message.content[0].type === 'text' ? message.content[0].text : '';
      text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(text);

      // Always recompute total_score — never trust Claude's calculation
      const totalScore = parsed.criteria_scores?.length
        ? Math.round(
            (parsed.criteria_scores as CriterionScore[]).reduce(
              (sum, c) => sum + (c.max_score > 0 ? (c.score / c.max_score) * c.weight * 100 : 0),
              0
            ) * 10
          ) / 10
        : 0;

      await supabase
        .from('candidates')
        .update({
          score: totalScore,
          criteria_scores: parsed.criteria_scores,
          reasoning: parsed.summary,
          confidence: parsed.confidence,
          screening_status: 'scored',
        })
        .eq('id', candidate.id);

      rescored++;
    } catch (err) {
      console.error(`Failed to rescore candidate ${candidate.id}:`, err);
      await supabase
        .from('candidates')
        .update({ screening_status: 'failed' })
        .eq('id', candidate.id);
    }
  }

  // 3. Score in parallel with concurrency cap
  for (let i = 0; i < scoreable.length; i += CONCURRENCY) {
    const batch = scoreable.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(rescoreCandidate));
  }

  return NextResponse.json({ success: true, rescored });
}
