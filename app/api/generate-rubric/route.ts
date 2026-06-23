import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { RUBRIC_SYSTEM_PROMPT, buildRubricUserPrompt } from '@/lib/prompts/rubric';

const anthropic = new Anthropic();

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { projectName, roleName, jobDescription } = body;

  if (!projectName || !roleName || !jobDescription) {
    return NextResponse.json(
      { error: 'Missing required fields: projectName, roleName, jobDescription' },
      { status: 400 }
    );
  }

  // 1. Create project row owned by the authenticated user
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({
      user_id: user.id,
      project_name: projectName,
      role_name: roleName,
      job_description: jobDescription,
      status: 'draft',
    })
    .select('id')
    .single();

  if (projectError || !project) {
    console.error('Failed to create project:', projectError);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }

  const projectId = project.id;

  // 2. Generate rubric with Claude Sonnet
  let rubricItems: Record<string, unknown>[];
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: RUBRIC_SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: buildRubricUserPrompt(roleName, jobDescription) },
      ],
    });

    let text = message.content[0].type === 'text' ? message.content[0].text : '';
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    rubricItems = JSON.parse(text);
  } catch (err) {
    // Clean up the orphaned project row if Claude fails
    await supabase.from('projects').delete().eq('id', projectId);
    console.error('Rubric generation failed:', err);
    return NextResponse.json({ error: 'Failed to generate rubric' }, { status: 500 });
  }

  // 3. Normalise weights to sum exactly to 1.0
  const totalWeight = rubricItems.reduce((sum, r) => sum + (r.weight as number), 0);
  const normalisedItems: Record<string, unknown>[] = rubricItems.map((r) => ({
    ...r,
    weight: Math.round(((r.weight as number) / totalWeight) * 1000) / 1000,
  }));

  // 4. Insert rubric criteria into Supabase
  const rubricRows = normalisedItems.map((item, index) => ({
    project_id: projectId,
    criterion: item.criterion,
    description: item.description,
    max_score: item.max_score ?? 10,
    weight: item.weight,
    sort_order: index,
    scoring_guide: item.scoring_guide ?? null,
  }));

  const { data: insertedRubric, error: rubricError } = await supabase
    .from('rubrics')
    .insert(rubricRows)
    .select();

  if (rubricError) {
    await supabase.from('projects').delete().eq('id', projectId);
    console.error('Failed to insert rubric:', rubricError);
    return NextResponse.json({ error: 'Failed to save rubric' }, { status: 500 });
  }

  return NextResponse.json(insertedRubric);
}
