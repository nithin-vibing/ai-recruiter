'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Sparkles, CheckCircle2, Loader2, Link2, FileText, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RubricCriterion } from '@/lib/types';

const GENERATION_STEPS = [
  'Reading your job description',
  'Identifying must-have skills',
  'Mapping competencies to criteria',
  'Setting scoring weights',
];

function RubricGenerationProgress() {
  const [activeStep, setActiveStep] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setActiveStep((prev) => (prev < GENERATION_STEPS.length - 1 ? prev + 1 : prev));
    }, 1600);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <div className="w-full space-y-2.5 py-1">
      {GENERATION_STEPS.map((step, i) => {
        const isDone = i < activeStep;
        const isActive = i === activeStep;
        return (
          <div key={step} className={cn('flex items-center gap-3 transition-opacity duration-300', i > activeStep && 'opacity-30')}>
            {isDone ? (
              <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
            ) : isActive ? (
              <Loader2 className="h-4 w-4 text-electric-blue animate-spin shrink-0" />
            ) : (
              <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
            )}
            <span className={cn(
              'text-sm transition-colors',
              isDone && 'text-success',
              isActive && 'text-foreground font-medium',
              !isDone && !isActive && 'text-muted-foreground',
            )}>
              {step}
            </span>
          </div>
        );
      })}
    </div>
  );
}

interface CreateProjectFormProps {
  onGenerateRubric: (data: { name: string; roleName: string; jobDescription: string }) => Promise<RubricCriterion[]>;
  onSubmit: (data: { name: string; roleName: string; jobDescription: string }) => void;
  isGenerating: boolean;
  initialValues?: { name: string; roleName: string; jobDescription: string };
}

export function CreateProjectForm({ onGenerateRubric, onSubmit, isGenerating, initialValues }: CreateProjectFormProps) {
  const [name, setName] = useState(initialValues?.name || '');
  const [roleName, setRoleName] = useState(initialValues?.roleName || '');
  const [jobDescription, setJobDescription] = useState(initialValues?.jobDescription || '');
  const [jdInputMode, setJdInputMode] = useState<'link' | 'text'>('link');
  const [jdUrl, setJdUrl] = useState('');
  const [jdFetchError, setJdFetchError] = useState<string | null>(null);
  const [isFetchingJd, setIsFetchingJd] = useState(false);

  const jdFilled = jdInputMode === 'link' ? jdUrl.trim() : jobDescription.trim();
  const isValid = name.trim() && roleName.trim() && jdFilled;

  const handleGenerateRubric = async () => {
    if (!isValid) return;
    setJdFetchError(null);

    let resolvedJd = jobDescription;

    if (jdInputMode === 'link') {
      setIsFetchingJd(true);
      try {
        const res = await fetch('/api/fetch-jd', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: jdUrl }),
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          setJdFetchError("Couldn't read that page — paste the description instead.");
          setJdInputMode('text');
          setIsFetchingJd(false);
          return;
        }
        resolvedJd = data.jobDescription;
        setJobDescription(resolvedJd);
      } catch {
        setJdFetchError("Couldn't read that page — paste the description instead.");
        setJdInputMode('text');
        setIsFetchingJd(false);
        return;
      }
      setIsFetchingJd(false);
    }

    await onGenerateRubric({ name, roleName, jobDescription: resolvedJd });
    onSubmit({ name, roleName, jobDescription: resolvedJd });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-xl font-bold">Project Details</CardTitle>
        <CardDescription>
          Add the role details and job description. AI will generate a custom scorecard in seconds.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="project-name">
                Project name
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">for your dashboard</span>
              </FieldLabel>
              <Input
                id="project-name"
                placeholder="e.g., Q2 Engineering Hiring"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="role-name">
                Role you&apos;re hiring for
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">the job title</span>
              </FieldLabel>
              <Input
                id="role-name"
                placeholder="e.g., Senior Frontend Engineer"
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
              />
            </Field>
          </div>

          <Field>
            <div className="flex items-center justify-between mb-1.5">
              <FieldLabel htmlFor={jdInputMode === 'link' ? 'jd-url' : 'job-description'} className="mb-0">
                Job description
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">more detail = sharper scorecard</span>
              </FieldLabel>
              <div className="flex items-center rounded-md border bg-muted/50 p-0.5 gap-0.5">
                <button
                  type="button"
                  onClick={() => { setJdInputMode('link'); setJdFetchError(null); }}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors',
                    jdInputMode === 'link'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Link2 className="h-3 w-3" />
                  Link
                </button>
                <button
                  type="button"
                  onClick={() => { setJdInputMode('text'); setJdFetchError(null); }}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors',
                    jdInputMode === 'text'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <FileText className="h-3 w-3" />
                  Paste
                </button>
              </div>
            </div>

            {jdInputMode === 'link' ? (
              <Input
                id="jd-url"
                type="url"
                placeholder="https://jobs.lever.co/…"
                value={jdUrl}
                onChange={(e) => { setJdUrl(e.target.value); setJdFetchError(null); }}
              />
            ) : (
              <Textarea
                id="job-description"
                placeholder="Paste the JD here…"
                className="min-h-[160px] resize-y text-sm"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
              />
            )}

            {jdFetchError && (
              <div className="flex items-center gap-2 mt-1.5 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {jdFetchError}
              </div>
            )}
          </Field>

          {isGenerating || isFetchingJd ? (
            <div className="rounded-xl border bg-muted/30 px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                {isFetchingJd ? 'Reading job posting…' : 'Building your scorecard'}
              </p>
              {isGenerating && <RubricGenerationProgress />}
              {isFetchingJd && (
                <div className="flex items-center gap-3">
                  <Loader2 className="h-4 w-4 text-electric-blue animate-spin shrink-0" />
                  <span className="text-sm text-foreground font-medium">Fetching job description</span>
                </div>
              )}
            </div>
          ) : (
            <Button
              className="w-full bg-electric-blue hover:bg-deep-blue"
              size="lg"
              disabled={!isValid}
              onClick={handleGenerateRubric}
            >
              <Sparkles className="h-4 w-4" />
              Generate scorecard
            </Button>
          )}
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
