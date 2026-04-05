import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const N8N_WEBHOOK_BASE = 'https://ainkv.app.n8n.cloud/webhook';

export async function POST(request: NextRequest) {
  // Auth guard — reject unauthenticated requests
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { projectName, roleName, jobDescription } = body;

    if (!projectName || !roleName || !jobDescription) {
      return NextResponse.json(
        { error: 'Missing required fields: projectName, roleName, and jobDescription' },
        { status: 400 }
      );
    }

    // Forward to n8n Workflow 1 (Rubric Generator)
    const response = await fetch(`${N8N_WEBHOOK_BASE}/rubric-generator`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectName, roleName, jobDescription }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('n8n webhook error:', errorText);
      throw new Error(`n8n webhook failed: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    if (!text || text.trim() === '') {
      throw new Error('n8n returned an empty response — workflow may have timed out or failed before responding');
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.error('n8n response was not valid JSON:', text.slice(0, 500));
      throw new Error(`n8n returned non-JSON response: ${text.slice(0, 200)}`);
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error generating rubric:', error);
    return NextResponse.json(
      { error: 'Failed to generate rubric' },
      { status: 500 }
    );
  }
}
