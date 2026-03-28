import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse');

const N8N_WEBHOOK_BASE = 'https://ainkv.app.n8n.cloud/webhook';

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const data = await pdfParse(buffer);
  return data.text || '';
}

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

    // Read the uploaded ZIP
    const zipBuffer = Buffer.from(await zipFile.arrayBuffer());
    const zip = await JSZip.loadAsync(zipBuffer);

    // Create a new ZIP with text-only files
    const textZip = new JSZip();
    let fileCount = 0;

    for (const [fileName, zipEntry] of Object.entries(zip.files)) {
      // Skip directories and Mac system files
      if (zipEntry.dir) continue;
      if (fileName.startsWith('__MACOSX')) continue;
      if (fileName.startsWith('.')) continue;

      const lowerName = fileName.toLowerCase();
      const baseName = fileName.split('/').pop() || fileName;

      if (lowerName.endsWith('.pdf')) {
        // Extract text from PDF
        try {
          const pdfBuffer = Buffer.from(await zipEntry.async('arraybuffer'));
          const text = await extractTextFromPdf(pdfBuffer);
          if (text && text.trim().length > 50) {
            // Save as .txt with same base name
            const txtName = baseName.replace(/\.pdf$/i, '.txt');
            textZip.file(txtName, text.trim());
            fileCount++;
          }
        } catch (e) {
          console.error(`Failed to parse PDF: ${fileName}`, e);
          // Skip unreadable PDFs
        }
      } else if (lowerName.endsWith('.txt')) {
        // Pass through text files as-is
        const text = await zipEntry.async('string');
        if (text && text.trim().length > 50) {
          textZip.file(baseName, text.trim());
          fileCount++;
        }
      }
      // Skip other file types (docx, images, etc.)
    }

    if (fileCount === 0) {
      return NextResponse.json(
        { error: 'No readable resume files found in ZIP. Please upload PDFs or TXT files.' },
        { status: 400 }
      );
    }

    // Generate the text-only ZIP
    const textZipBuffer = await textZip.generateAsync({ type: 'nodebuffer' });

    // Create a Blob to send as FormData
    const textZipBlob = new Blob([textZipBuffer], { type: 'application/zip' });

    // Forward to n8n
    const n8nFormData = new FormData();
    n8nFormData.append('projectId', projectId);
    n8nFormData.append('resumesZip', textZipBlob, 'resumes.zip');

    console.log(`Processed ${fileCount} resumes, sending to n8n...`);

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
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error screening resumes:', error);
    return NextResponse.json(
      { error: 'Failed to screen resumes' },
      { status: 500 }
    );
  }
}
