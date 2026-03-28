'use client';

import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist';

// Set the worker source to the CDN version
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs`;

/**
 * Extract text from a single PDF buffer using pdf.js in the browser.
 * Browser has full DOM support so pdf.js works perfectly.
 */
async function extractTextFromPdf(buffer: ArrayBuffer): Promise<string> {
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const textParts: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    textParts.push(pageText);
  }

  return textParts.join('\n');
}

/**
 * Takes a ZIP file (containing PDFs and/or TXT files), extracts text from all
 * PDFs in the browser, and returns a new ZIP containing only .txt files.
 *
 * Returns { textZip: Blob, fileCount: number }
 */
export async function convertPdfZipToTextZip(
  zipFile: File,
  onProgress?: (current: number, total: number, fileName: string) => void
): Promise<{ textZip: Blob; fileCount: number }> {
  const zipBuffer = await zipFile.arrayBuffer();
  const zip = await JSZip.loadAsync(zipBuffer);

  // Count total processable files first
  const entries = Object.entries(zip.files).filter(([name, entry]) => {
    if (entry.dir) return false;
    if (name.startsWith('__MACOSX')) return false;
    if (name.startsWith('.')) return false;
    const lower = name.toLowerCase();
    return lower.endsWith('.pdf') || lower.endsWith('.txt');
  });

  const textZip = new JSZip();
  let fileCount = 0;
  let processed = 0;

  for (const [fileName, zipEntry] of entries) {
    const lowerName = fileName.toLowerCase();
    const baseName = fileName.split('/').pop() || fileName;

    processed++;
    onProgress?.(processed, entries.length, baseName);

    if (lowerName.endsWith('.pdf')) {
      try {
        const pdfBuffer = await zipEntry.async('arraybuffer');
        const text = await extractTextFromPdf(pdfBuffer);
        if (text && text.trim().length > 50) {
          const txtName = baseName.replace(/\.pdf$/i, '.txt');
          textZip.file(txtName, text.trim());
          fileCount++;
        }
      } catch (e) {
        console.error(`Failed to parse PDF: ${baseName}`, e);
      }
    } else if (lowerName.endsWith('.txt')) {
      const text = await zipEntry.async('string');
      if (text && text.trim().length > 50) {
        textZip.file(baseName, text.trim());
        fileCount++;
      }
    }
  }

  const textZipBlob = await textZip.generateAsync({ type: 'blob' });
  return { textZip: textZipBlob, fileCount };
}
