import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';

const N8N_WEBHOOK_BASE = 'https://ainkv.app.n8n.cloud/webhook';

async function extractTextFromPdf(buffer: ArrayBuffer): Promise<string> {
  // Dynamic import to avoid SSR issues
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const textParts: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: { str?: string }) => item.str || '')
      .join(' ');
    textParts.push(pageText);
  }

  return textParts.join('\n');
}

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

    // Read the uploaded ZIP
    const zipBuffer = await zipFile.arrayBuffer();
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
          console.log(`Extracting text from PDF: ${baseName}`);
          const pdfBuffer = await zipEntry.async('arraybuffer');
          const text = await extractTextFromPdf(pdfBuffer);
          if (text && text.trim().length > 50) {
            const txtName = baseName.replace(/\.pdf$/i, '.txt');
            textZip.file(txtName, text.trim());
            fileCount++;
            console.log(`Extracted ${text.trim().length} chars from ${baseName}`);
          } else {
            console.warn(`Skipping ${baseName}: extracted text too short (${text?.trim().length || 0} chars)`);
          }
        } catch (e) {
          console.error(`Failed to parse PDF: ${fileName}`, e);
        }
      } else if (lowerName.endsWith('.txt')) {
        // Pass through text files as-is
        const text = await zipEntry.async('string');
        if (text && text.trim().length > 50) {
          textZip.file(baseName, text.trim());
          fileCount++;
        }
      }
    }

    console.log(`Processed ${fileCount} resumes total`);

    if (fileCount === 0) {
      return NextResponse.json(
        { error: 'No readable resume files found in ZIP. Please upload PDFs or TXT files.' },
        { status: 400 }
      );
    }

    // Generate the text-only ZIP
    const textZipBuffer = await textZip.generateAsync({ type: 'nodebuffer' });
    const textZipBlob = new Blob([textZipBuffer], { type: 'application/zip' });

    // Forward to n8n
    const n8nFormData = new FormData();
    n8nFormData.append('projectId', projectId);
    n8nFormData.append('resumesZip', textZipBlob, 'resumes.zip');

    console.log(`Sending ${fileCount} text resumes to n8n...`);

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
