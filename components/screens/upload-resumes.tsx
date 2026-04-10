'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Field, FieldLabel } from '@/components/ui/field';
import { Upload, FileArchive, FileText, X, Play, CheckCircle, RefreshCw, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PERCENTILE_OPTIONS, type PercentileThreshold, type ScreeningProgress } from '@/lib/types';

interface UploadResumesProps {
  onStartScreening: (files: File[], threshold: PercentileThreshold) => Promise<void>;
  screeningProgress: ScreeningProgress | null;
  percentileThreshold: PercentileThreshold;
  onThresholdChange: (threshold: PercentileThreshold) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

type UploadMode = 'pdfs' | 'zip';

export function UploadResumes({
  onStartScreening,
  screeningProgress,
  percentileThreshold,
  onThresholdChange,
}: UploadResumesProps) {
  const [mode, setMode] = useState<UploadMode>('pdfs');
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const hasFiles = mode === 'pdfs' ? pdfFiles.length > 0 : zipFile !== null;

  const handlePdfFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming).filter((f) => {
      const lower = f.name.toLowerCase();
      return lower.endsWith('.pdf') || lower.endsWith('.txt');
    });
    if (arr.length > 0) setPdfFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      return [...prev, ...arr.filter((f) => !names.has(f.name))];
    });
  }, []);

  const handleZipFile = useCallback((file: File) => {
    if (file.name.endsWith('.zip') || file.type === 'application/zip' || file.type === 'application/x-zip-compressed') {
      setZipFile(file);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (mode === 'pdfs') {
      handlePdfFiles(e.dataTransfer.files);
    } else {
      const file = e.dataTransfer.files[0];
      if (file) handleZipFile(file);
    }
  }, [mode, handlePdfFiles, handleZipFile]);

  const openFilePicker = () => {
    if (isScreening) return;
    const input = document.createElement('input');
    input.type = 'file';
    if (mode === 'pdfs') {
      input.accept = '.pdf,.txt';
      input.multiple = true;
      input.onchange = (e) => {
        const files = (e.target as HTMLInputElement).files;
        if (files) handlePdfFiles(files);
      };
    } else {
      input.accept = '.zip';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) handleZipFile(file);
      };
    }
    input.click();
  };

  const handleStartScreening = async () => {
    if (mode === 'pdfs' && pdfFiles.length > 0) {
      await onStartScreening(pdfFiles, percentileThreshold);
    } else if (mode === 'zip' && zipFile) {
      await onStartScreening([zipFile], percentileThreshold);
    }
  };

  const isScreening = screeningProgress !== null && !screeningProgress.isComplete;
  const isComplete = screeningProgress?.isComplete === true;

  return (
    <div className="space-y-5">

      {/* ── No file selected: Full dropzone ── */}
      {!hasFiles && !isScreening && !isComplete && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="font-display text-xl">Upload Resumes</CardTitle>
                <CardDescription className="mt-1">
                  {mode === 'pdfs'
                    ? 'Drop individual PDF or TXT resume files. AI scores each one against your approved scorecard.'
                    : 'Upload a .zip archive containing PDF or TXT resume files.'}
                </CardDescription>
              </div>
              {/* Mode toggle */}
              <div className="flex items-center rounded-lg border bg-muted/40 p-0.5 shrink-0 text-xs font-medium">
                <button
                  className={cn('px-3 py-1.5 rounded-md transition-colors', mode === 'pdfs' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}
                  onClick={() => { setMode('pdfs'); setZipFile(null); }}
                >
                  PDFs
                </button>
                <button
                  className={cn('px-3 py-1.5 rounded-md transition-colors', mode === 'zip' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}
                  onClick={() => { setMode('zip'); setPdfFiles([]); }}
                >
                  ZIP
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                'relative flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all',
                isDragOver
                  ? 'border-electric-blue bg-cloud-blue/50 scale-[1.01]'
                  : 'border-muted-foreground/20 bg-off-white hover:border-electric-blue/40 hover:bg-cloud-blue/20'
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={openFilePicker}
            >
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-electric-blue/10">
                  {mode === 'pdfs'
                    ? <FileText className="h-6 w-6 text-electric-blue" />
                    : <FileArchive className="h-6 w-6 text-electric-blue" />}
                </div>
                <div className="text-center">
                  <p className="font-display text-lg font-semibold text-foreground">
                    {isDragOver
                      ? 'Drop here'
                      : mode === 'pdfs' ? 'Drop resume PDFs here' : 'Drop resumes ZIP here'}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">or click to browse</p>
                </div>
                <p className="text-xs text-muted-foreground/60">
                  {mode === 'pdfs' ? '.pdf or .txt files (select multiple)' : '.zip archive'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Files selected: Compact summary + options + start ── */}
      {hasFiles && !isScreening && !isComplete && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl">Ready to screen</CardTitle>
            <CardDescription>Review your files and screening options, then start.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* File summary bar */}
            {mode === 'pdfs' ? (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-electric-blue/10 shrink-0">
                      <FileText className="h-5 w-5 text-electric-blue" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{pdfFiles.length} resume{pdfFiles.length !== 1 ? 's' : ''} selected</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(pdfFiles.reduce((sum, f) => sum + f.size, 0))} total</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={openFilePicker} className="text-muted-foreground hover:text-foreground text-xs">
                      <Upload className="h-3.5 w-3.5" /> Add more
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setPdfFiles([])} className="text-muted-foreground hover:text-destructive">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {/* File list (max 5 shown) */}
                <div className="space-y-1 max-h-[120px] overflow-y-auto">
                  {pdfFiles.slice(0, 8).map((f) => (
                    <div key={f.name} className="flex items-center justify-between gap-2 text-xs text-muted-foreground px-1">
                      <span className="truncate">{f.name}</span>
                      <span className="shrink-0 tabular-nums">{formatFileSize(f.size)}</span>
                    </div>
                  ))}
                  {pdfFiles.length > 8 && (
                    <p className="text-xs text-muted-foreground/60 px-1">+{pdfFiles.length - 8} more files</p>
                  )}
                </div>
              </div>
            ) : (
              <div
                className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-electric-blue/10">
                    <FileArchive className="h-5 w-5 text-electric-blue" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{zipFile!.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(zipFile!.size)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openFilePicker(); }} className="text-muted-foreground hover:text-foreground text-xs">
                    <RefreshCw className="h-3.5 w-3.5" /> Change
                  </Button>
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setZipFile(null); }} className="text-muted-foreground hover:text-destructive">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Screening options + start button */}
            <div className="flex items-end gap-4">
              <Field className="flex-1 max-w-xs">
                <FieldLabel>Show top candidates</FieldLabel>
                <Select
                  value={percentileThreshold.toString()}
                  onValueChange={(v) => onThresholdChange(parseInt(v) as PercentileThreshold)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERCENTILE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value.toString()}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Button
                className="bg-electric-blue hover:bg-deep-blue gap-2"
                size="lg"
                onClick={handleStartScreening}
              >
                <Play className="h-4 w-4" />
                Start Screening
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Screening in progress ── */}
      {isScreening && screeningProgress && (
        <Card className="border-electric-blue/30">
          <CardContent className="p-6">
            <div className="space-y-4">
              {/* File reminder */}
              {zipFile && (
                <div className="flex items-center gap-3 pb-4 border-b">
                  <FileArchive className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{zipFile.name}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <p className="font-display font-semibold text-foreground">Screening in progress</p>
                <span className="text-sm font-medium text-electric-blue tabular-nums">
                  {screeningProgress.total > 0
                    ? `${screeningProgress.current} of ${screeningProgress.total} scored`
                    : `${screeningProgress.current} scored`}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                {screeningProgress.total > 0 ? (
                  <div
                    className="h-full bg-electric-blue rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, (screeningProgress.current / screeningProgress.total) * 100)}%` }}
                  />
                ) : (
                  <div className="h-full bg-electric-blue/60 rounded-full animate-pulse" style={{ width: '100%' }} />
                )}
              </div>
              <div className="flex items-start gap-2 rounded-lg bg-electric-blue/5 border border-electric-blue/20 px-3 py-2">
                <Info className="h-4 w-4 text-electric-blue mt-0.5 shrink-0" />
                <p className="text-sm text-muted-foreground">
                  Screening runs in the background — <span className="text-foreground font-medium">safe to close this tab</span>. You&apos;ll get a browser notification when results are ready.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Complete ── */}
      {isComplete && (
        <Card className="border-success/30 bg-success/5">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-6 w-6 text-success" />
              <div>
                <p className="font-display font-semibold text-foreground">Screening complete</p>
                <p className="text-sm text-muted-foreground">
                  {screeningProgress?.current ?? 0} candidate{(screeningProgress?.current ?? 0) !== 1 ? 's' : ''} ranked and ready to review.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
