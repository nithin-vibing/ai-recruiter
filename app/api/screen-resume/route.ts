import { NextRequest, NextResponse } from 'next/server';

const N8N_WEBHOOK_BASE = 'https://ainkv.app.n8n.cloud/webhook';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const projectId = formData.get('projectId') as string;
    const zipFile = formData.get('resumesZip') as File;

    if (!projectId || !zipFile) {
      return NextResponse.json(
        { error: 'Missing required fields: projectId and resumesZip' },
        { status: 400 }
      );
    }

    // Forward FormData to n8n Workflow 2 (Resume Screener)
    const n8nFormData = new FormData();
    n8nFormData.append('projectId', projectId);
    n8nFormData.append('resumesZip', zipFile);

    const response = await fetch(`${N8N_WEBHOOK_BASE}/resume-screener`, {
      method: 'POST',
      body: n8nFormData,
      // No Content-Type header — let fetch set the multipart boundary
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('n8n webhook error:', errorText);
      throw new Error(`n8n webhook failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error screening resumes:', error);
    return NextResponse.json(
      { error: 'Failed to screen resumes' },
      { status: 500 }
    );
  }
}
