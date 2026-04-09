'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Sparkles, CheckCircle2, Loader2 } from 'lucide-react';
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

  const isValid = name.trim() && roleName.trim() && jobDescription.trim();

  const handleGenerateRubric = async () => {
    if (!isValid) return;
    await onGenerateRubric({ name, roleName, jobDescription });
    onSubmit({ name, roleName, jobDescription });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-xl font-bold">Role Details</CardTitle>
        <CardDescription>
          Paste the role info and job description. AI will generate a custom scoring rubric in seconds.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup className="space-y-4">
          <Field>
            <FieldLabel htmlFor="project-name">Role Name</FieldLabel>
            <Input
              id="project-name"
              placeholder="e.g., Q2 Engineering Hiring"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="role-name">Role Name</FieldLabel>
            <Input
              id="role-name"
              placeholder="e.g., Senior Frontend Engineer"
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="job-description">Job Description</FieldLabel>
            <Textarea
              id="job-description"
              placeholder="Paste the full job description here — responsibilities, requirements, qualifications, nice-to-haves. The more detail, the better the rubric."
              className="min-h-[160px] resize-y font-mono text-sm"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
            />
          </Field>

          {isGenerating ? (
            <div className="rounded-xl border bg-muted/30 px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Building your rubric
              </p>
              <RubricGenerationProgress />
            </div>
          ) : (
            <Button
              className="w-full bg-electric-blue hover:bg-deep-blue"
              size="lg"
              disabled={!isValid}
              onClick={handleGenerateRubric}
            >
              <Sparkles className="h-4 w-4" />
              Create Screening Rubric
            </Button>
          )}
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
