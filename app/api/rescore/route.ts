import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { projectId, rubric } = await request.json();

  if (!projectId || !rubric?.length) {
    return NextResponse.json({ error: 'Missing projectId or rubric' }, { status: 400 });
  }

  // Validate weights sum to ~1.0
  const totalWeight = rubric.reduce((sum: number, r: { weight: number }) => sum + r.weight, 0);
  if (Math.abs(totalWeight - 1.0) > 0.02) {
    return NextResponse.json(
      { error: `Weights must sum to 100% (currently ${Math.round(totalWeight * 100)}%)` },
      { status: 400 }
    );
  }

  // 1. Update rubric criteria in Supabase by their IDs
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

  // 2. Fetch candidates with resume_text
  const { data: candidates, error: candidatesError } = await supabase
    .from('candidates')
    .select('id, resume_text, candidate_name, source_filename')
    .eq('project_id', projectId);

  if (candidatesError) {
    return NextResponse.json({ error: candidatesError.message }, { status: 500 });
  }

  const candidatesWithText = (candidates || []).filter(c => c.resume_text);
  if (candidatesWithText.length === 0) {
    return NextResponse.json(
      { error: 'No resume text found. This project was screened before re-ranking was available. Please re-upload resumes to enable re-ranking.' },
      { status: 400 }
    );
  }

  // 3. Build rubric text for Claude prompt
  const rubricText = rubric
    .map((r: { name: string; weight: number; maxScore: number; description: string }) =>
      `### ${r.name} (weight: ${r.weight}, max score: ${r.maxScore})\nDescription: ${r.description}`
    )
    .join('\n\n');

  const systemPrompt = `You are an expert talent evaluator. Score resumes against the provided rubric criteria using evidence-based scoring. Never invent or infer experience not stated in the resume. Output ONLY valid JSON — no preamble, no explanation.`;

  // 4. Score each candidate with updated rubric
  let rescored = 0;
  for (const candidate of candidatesWithText) {
    const userContent = `Score this resume against the rubric below.

<Rubric>
${rubricText}
</Rubric>

<Resume>
${candidate.resume_text}
</Resume>

Respond ONLY with this exact JSON:
{
  "criteria_scores": [
    { "criterion": "criterion name", "score": 8, "max_score": 10, "weight": 0.2, "evidence": "direct quote or paraphrase from resume" }
  ],
  "total_score": 74.5,
  "summary": "Strongest aspect sentence. Biggest gap sentence.",
  "confidence": "high | medium | low"
}`;

    try {
      const res = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1500,
          system: systemPrompt,
          messages: [{ role: 'user', content: userContent }],
        }),
      });

      const data = await res.json();
      let text = data.content?.[0]?.text || '';
      text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(text);

      // Always compute total_score ourselves — never trust Claude's calculation
      // Formula: sum of (score / max_score × weight × 100) for all criteria
      let totalScore = 0;
      if (parsed.criteria_scores?.length) {
        totalScore = parsed.criteria_scores.reduce(
          (sum: number, c: { score: number; max_score: number; weight: number }) =>
            sum + (c.max_score > 0 ? (c.score / c.max_score) * c.weight * 100 : 0),
          0
        );
        totalScore = Math.round(totalScore * 10) / 10;
      }

      await supabase
        .from('candidates')
        .update({
          score: totalScore,
          criteria_scores: parsed.criteria_scores,
          reasoning: parsed.summary,
          confidence: parsed.confidence,
        })
        .eq('id', candidate.id);

      rescored++;
    } catch (err) {
      console.error(`Failed to rescore candidate ${candidate.id}:`, err);
    }
  }

  return NextResponse.json({ success: true, rescored });
}
