'use client';

import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist';

// Set the worker source to the CDN version
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs`;

/**
 * Extract text from a single PDF buffer using pdf.js in the browser.
 * Browser has full DOM support so pdf.js works perfectly.
 */
export async function extractTextFromPdf(buffer: ArrayBuffer): Promise<string> {
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
 * Takes a flat array of PDF/TXT File objects (no ZIP needed), extracts text,
 * and returns the same shape as convertPdfZipToTextZip so callers are interchangeable.
 */
export async function convertPdfFilesToTextZip(
  files: File[],
  onProgress?: (current: number, total: number, fileName: string) => void
): Promise<{ textZip: Blob; fileCount: number; originalFiles: Map<string, Blob>; failedFiles: string[] }> {
  const eligible = files.filter((f) => {
    const lower = f.name.toLowerCase();
    return lower.endsWith('.pdf') || lower.endsWith('.txt');
  });

  const textZip = new JSZip();
  const originalFiles = new Map<string, Blob>();
  const failedFiles: string[] = [];
  let fileCount = 0;

  for (let i = 0; i < eligible.length; i++) {
    const file = eligible[i];
    onProgress?.(i + 1, eligible.length, file.name);

    if (file.name.toLowerCase().endsWith('.pdf')) {
      try {
        const buffer = await file.arrayBuffer();
        const bufferCopy = buffer.slice(0);
        const text = await extractTextFromPdf(buffer);
        if (text && text.trim().length > 50) {
          const txtName = file.name.replace(/\.pdf$/i, '.txt');
          textZip.file(txtName, text.trim());
          originalFiles.set(file.name, new Blob([bufferCopy], { type: 'application/pdf' }));
          fileCount++;
        } else {
          failedFiles.push(file.name);
        }
      } catch (e) {
        console.error(`Failed to parse PDF: ${file.name}`, e);
        failedFiles.push(file.name);
      }
    } else {
      const text = await file.text();
      if (text && text.trim().length > 50) {
        textZip.file(file.name, text.trim());
        originalFiles.set(file.name, new Blob([text], { type: 'text/plain' }));
        fileCount++;
      } else {
        failedFiles.push(file.name);
      }
    }
  }

  const textZipBlob = await textZip.generateAsync({ type: 'blob' });
  return { textZip: textZipBlob, fileCount, originalFiles, failedFiles };
}

/**
 * Takes a ZIP file (containing PDFs and/or TXT files), extracts text from all
 * PDFs in the browser, and returns a new ZIP containing only .txt files.
 *
 * Returns { textZip: Blob, fileCount: number, originalFiles: Map of filename → Blob }
 */
export async function convertPdfZipToTextZip(
  zipFile: File,
  onProgress?: (current: number, total: number, fileName: string) => void
): Promise<{ textZip: Blob; fileCount: number; originalFiles: Map<string, Blob>; failedFiles: string[] }> {
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
  const originalFiles = new Map<string, Blob>();
  const failedFiles: string[] = [];
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
        // Copy buffer BEFORE pdf.js processes it (pdf.js may neuter/transfer the original)
        const pdfCopy = pdfBuffer.slice(0);
        const text = await extractTextFromPdf(pdfBuffer);
        if (text && text.trim().length > 50) {
          const txtName = baseName.replace(/\.pdf$/i, '.txt');
          textZip.file(txtName, text.trim());
          // Keep original PDF for storage upload
          originalFiles.set(baseName, new Blob([pdfCopy], { type: 'application/pdf' }));
          fileCount++;
        } else {
          // Likely a scanned/image-only PDF with no extractable text
          failedFiles.push(baseName);
        }
      } catch (e) {
        console.error(`Failed to parse PDF: ${baseName}`, e);
        failedFiles.push(baseName);
      }
    } else if (lowerName.endsWith('.txt')) {
      const text = await zipEntry.async('string');
      if (text && text.trim().length > 50) {
        textZip.file(baseName, text.trim());
        // Keep original TXT for storage
        originalFiles.set(baseName, new Blob([text], { type: 'text/plain' }));
        fileCount++;
      }
    }
  }

  const textZipBlob = await textZip.generateAsync({ type: 'blob' });
  return { textZip: textZipBlob, fileCount, originalFiles, failedFiles };
}
