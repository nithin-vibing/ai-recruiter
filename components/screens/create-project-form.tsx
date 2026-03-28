'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { Sparkles } from 'lucide-react';
import type { RubricCriterion } from '@/lib/types';

interface CreateProjectFormProps {
  onGenerateRubric: (data: { name: string; roleName: string; jobDescription: string }) => Promise<RubricCriterion[]>;
  onSubmit: (data: { name: string; roleName: string; jobDescription: string }) => void;
  isGenerating: boolean;
}

export function CreateProjectForm({ onGenerateRubric, onSubmit, isGenerating }: CreateProjectFormProps) {
  const [name, setName] = useState('');
  const [roleName, setRoleName] = useState('');
  const [jobDescription, setJobDescription] = useState('');

  const isValid = name.trim() && roleName.trim() && jobDescription.trim();

  const handleGenerateRubric = async () => {
    if (!isValid) return;
    await onGenerateRubric({ name, roleName, jobDescription });
    onSubmit({ name, roleName, jobDescription });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-xl font-bold">Project Details</CardTitle>
        <CardDescription>
          Paste the role info and job description. AI will generate a custom scoring rubric in seconds.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup className="space-y-4">
          <Field>
            <FieldLabel htmlFor="project-name">Project Name</FieldLabel>
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
              className="min-h-[240px] resize-y font-mono text-sm"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
            />
          </Field>

          <Button
            className="w-full bg-electric-blue hover:bg-deep-blue"
            size="lg"
            disabled={!isValid || isGenerating}
            onClick={handleGenerateRubric}
          >
            {isGenerating ? (
              <>
                <Spinner className="h-4 w-4" />
                Generating Rubric...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate Rubric with AI
              </>
            )}
          </Button>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
