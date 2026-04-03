import { NextRequest, NextResponse } from 'next/server';

const N8N_WEBHOOK_BASE = process.env.N8N_WEBHOOK_BASE_URL ?? 'https://ainkv.app.n8n.cloud/webhook';

export async function POST(request: NextRequest) {
  try {
    console.log('Screen resume API called');

    const formData = await request.formData();
    const projectId = formData.get('projectId') as string;
    const zipFile = formData.get('resumesZip') as File;

    if (!projectId || !zipFile) {
      return NextResponse.json(
        { error: 'Missing required fields: projectId and resumesZip' },
        { status: 400 }
      );
    }

    console.log(`Received ZIP: ${zipFile.name}, size: ${zipFile.size}, projectId: ${projectId}`);

    // Forward the text ZIP directly to n8n
    // PDF→text conversion already happened in the browser
    const n8nFormData = new FormData();
    n8nFormData.append('projectId', projectId);
    n8nFormData.append('resumesZip', zipFile, 'resumes.zip');

    console.log('Forwarding to n8n...');

    const response = await fetch(`${N8N_WEBHOOK_BASE}/resume-screener`, {
      method: 'POST',
      body: n8nFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('n8n webhook error:', errorText);
      throw new Error(`n8n webhook failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('n8n responded successfully');
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error screening resumes:', error);
    return NextResponse.json(
      { error: `Failed to screen resumes: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
