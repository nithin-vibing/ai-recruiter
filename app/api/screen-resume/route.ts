import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import Anthropic from '@anthropic-ai/sdk';
import JSZip from 'jszip';
import { createClient } from '@/lib/supabase/server';
import { SCREENING_SYSTEM_PROMPT, buildScreeningUserPrompt } from '@/lib/prompts/screening';

const anthropic = new Anthropic();
const CONCURRENCY = 5;

interface RubricRow {
  criterion: string;
  description: string;
  max_score: number;
  weight: number;
  scoring_guide?: { high?: string; mid?: string; low?: string } | string;
}

interface CriterionScore {
  criterion: string;
  score: number;
  max_score: number;
  weight: number;
  evidence: string;
}

async function scoreResume(
  resumeText: string,
  fileName: string,
  projectId: string,
  rubric: RubricRow[]
): Promise<void> {
  const supabase = await createClient();

  // Insert candidate row as pending before scoring
  const { data: candidate, error: insertError } = await supabase
    .from('candidates')
    .insert({
      project_id: projectId,
      source_filename: fileName,
      resume_text: resumeText,
      status: 'pending',
      screening_status: 'pending',
    })
    .select('id')
    .single();

  if (insertError || !candidate) {
    console.error(`Failed to insert candidate ${fileName}:`, insertError);
    return;
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      system: SCREENING_SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: buildScreeningUserPrompt(resumeText, rubric) },
      ],
    });

    let text = message.content[0].type === 'text' ? message.content[0].text : '';
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(text);

    // Always recompute total_score — never trust Claude's calculation
    const totalScore = parsed.criteria_scores
      ? Math.round(
          (parsed.criteria_scores as CriterionScore[]).reduce(
            (sum, c) =>
              sum + (c.max_score > 0 ? (c.score / c.max_score) * c.weight * 100 : 0),
            0
          ) * 10
        ) / 10
      : 0;

    await supabase
      .from('candidates')
      .update({
        candidate_name: parsed.candidate_name ?? null,
        score: totalScore,
        criteria_scores: parsed.criteria_scores,
        reasoning: parsed.summary,
        confidence: parsed.confidence,
        screening_status: 'scored',
      })
      .eq('id', candidate.id);
  } catch (err) {
    console.error(`Failed to score ${fileName}:`, err);
    await supabase
      .from('candidates')
      .update({ screening_status: 'failed' })
      .eq('id', candidate.id);
  }
}

async function runScoringInBackground(
  projectId: string,
  resumes: { name: string; text: string }[],
  rubric: RubricRow[]
) {
  const supabase = await createClient();

  // Mark project as screening
  await supabase
    .from('projects')
    .update({ status: 'screening' })
    .eq('id', projectId);

  // Score in batches of CONCURRENCY
  for (let i = 0; i < resumes.length; i += CONCURRENCY) {
    const batch = resumes.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map((r) => scoreResume(r.text, r.name, projectId, rubric))
    );
  }

  // Mark project complete
  await supabase
    .from('projects')
    .update({ status: 'complete' })
    .eq('id', projectId);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const projectId = formData.get('projectId') as string;
  const zipFile = formData.get('resumesZip') as File;

  if (!projectId || !zipFile) {
    return NextResponse.json(
      { error: 'Missing required fields: projectId and resumesZip' },
      { status: 400 }
    );
  }

  // Fetch rubric (including scoring_guide for richer prompts)
  const { data: rubric, error: rubricError } = await supabase
    .from('rubrics')
    .select('criterion, description, max_score, weight, scoring_guide')
    .eq('project_id', projectId)
    .order('sort_order');

  if (rubricError || !rubric?.length) {
    return NextResponse.json({ error: 'Rubric not found for this project' }, { status: 400 });
  }

  // Unzip resumes in the API route
  const zipBuffer = await zipFile.arrayBuffer();
  const zip = await JSZip.loadAsync(zipBuffer);

  const resumes: { name: string; text: string }[] = [];
  for (const [fileName, file] of Object.entries(zip.files)) {
    if (file.dir) continue;
    const text = await file.async('string');
    if (text.trim().length > 50) {
      resumes.push({ name: fileName, text });
    }
  }

  if (resumes.length === 0) {
    return NextResponse.json({ error: 'No readable resumes found in ZIP' }, { status: 400 });
  }

  // Keep the function alive after response using Vercel's waitUntil
  waitUntil(
    runScoringInBackground(projectId, resumes, rubric).catch((err) =>
      console.error('Background scoring error:', err)
    )
  );

  return NextResponse.json({ queued: resumes.length });
}
