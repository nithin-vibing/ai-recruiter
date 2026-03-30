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
import { Upload, FileArchive, X, Play, CheckCircle, RefreshCw } from 'lucide-react';
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

export function UploadResumes({
  onStartScreening,
  screeningProgress,
  percentileThreshold,
  onThresholdChange,
}: UploadResumesProps) {
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFile = useCallback((file: File) => {
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
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const openFilePicker = () => {
    if (isScreening) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) handleFile(file);
    };
    input.click();
  };

  const handleStartScreening = async () => {
    if (!zipFile) return;
    await onStartScreening([zipFile], percentileThreshold);
  };

  const isScreening = screeningProgress !== null && !screeningProgress.isComplete;
  const isComplete = screeningProgress?.isComplete === true;

  return (
    <div className="space-y-5">

      {/* ── No file selected: Full dropzone ── */}
      {!zipFile && !isScreening && !isComplete && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl">Upload Resumes</CardTitle>
            <CardDescription>
              Upload a .zip archive containing resume files (.pdf or .txt). AI will score each one against your approved rubric.
            </CardDescription>
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
                  <Upload className="h-6 w-6 text-electric-blue" />
                </div>
                <div className="text-center">
                  <p className="font-display text-lg font-semibold text-foreground">
                    {isDragOver ? 'Drop your ZIP here' : 'Drop resumes ZIP here'}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    or click to browse
                  </p>
                </div>
                <p className="text-xs text-muted-foreground/60">
                  .zip archive containing .pdf or .txt resume files
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── File selected: Compact card with file info + options + start button ── */}
      {zipFile && !isScreening && !isComplete && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl">Ready to Screen</CardTitle>
            <CardDescription>
              Review your file and screening options, then start screening.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* File info bar */}
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
                  <p className="text-sm font-medium">{zipFile.name}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(zipFile.size)}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); openFilePicker(); }}
                  className="text-muted-foreground hover:text-foreground text-xs"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Change
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); setZipFile(null); }}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Screening options + start button — inline */}
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
                <span className="text-sm font-medium text-electric-blue">
                  {screeningProgress.current} scored
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-electric-blue rounded-full animate-pulse" style={{ width: '100%', opacity: 0.6 }} />
              </div>
              <p className="text-sm text-muted-foreground">
                {screeningProgress.current} candidates scored so far... Each resume is evaluated against your rubric by Claude AI.
              </p>
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
                  All {screeningProgress?.total} resumes scored. View your ranked results.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
