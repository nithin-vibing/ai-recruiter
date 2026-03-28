'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CreateProjectForm } from '@/components/screens/create-project-form';
import { RubricTable } from '@/components/screens/rubric-table';
import { StepIndicator } from '@/components/shared/step-indicator';
import { useProject } from '@/lib/project-context';
import { generateRubric, fetchRubric } from '@/lib/api-client';
import type { RubricCriterion } from '@/lib/types';

export default function CreateProjectPage() {
  const router = useRouter();
  const { setProjectDetails, setRubric, currentProject, setCurrentStep } = useProject();
  const [isGenerating, setIsGenerating] = useState(false);
  const [localRubric, setLocalRubric] = useState<RubricCriterion[]>([]);
  const [showRubric, setShowRubric] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const rubricRef = useRef<HTMLDivElement>(null);

  const handleGenerateRubric = async (data: { name: string; roleName: string; jobDescription: string }) => {
    setIsGenerating(true);
    try {
      // Call n8n Workflow 1 — creates project + generates rubric in Supabase
      const result = await generateRubric(data);

      // n8n returns an array of rubric items, each with project_id
      // Extract projectId from the first item
      const rubricArray = Array.isArray(result) ? result : [result];
      const pid = rubricArray[0]?.project_id;

      if (pid) {
        setProjectId(pid);
      }

      // Map the response directly — n8n already returned the rubric items
      const mappedRubric: RubricCriterion[] = rubricArray.map((row: Record<string, unknown>) => ({
        id: row.id as string,
        name: row.criterion as string,
        description: (row.description as string) || '',
        maxScore: (row.max_score as number) || 10,
        weight: Number(row.weight) || 1,
      }));
      setLocalRubric(mappedRubric);
      setShowRubric(true);
      // Auto-scroll to rubric after a brief delay for render
      setTimeout(() => {
        rubricRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
      return mappedRubric;
    } catch (error) {
      console.error('Failed to generate rubric:', error);
      throw error;
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFormSubmit = (data: { name: string; roleName: string; jobDescription: string }) => {
    setProjectDetails(data);
  };

  const handleRubricChange = (rubric: RubricCriterion[]) => {
    setLocalRubric(rubric);
  };

  const handleApproveRubric = () => {
    setRubric(localRubric);
    // Store projectId in the project context so Screen 2 can use it
    if (projectId) {
      setProjectDetails({
        name: currentProject?.name || '',
        roleName: currentProject?.roleName || '',
        jobDescription: currentProject?.jobDescription || '',
      });
      // Store projectId in sessionStorage for Screen 2
      sessionStorage.setItem('currentProjectId', projectId);
    }
    setCurrentStep(2);
    router.push('/dashboard/project/upload');
  };

  return (
    <div className="p-8">
      {/* Header with Step Indicator */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Create New Project
          </h1>
          <p className="mt-1 text-muted-foreground">
            Step 1: Define the role and generate an evaluation rubric
          </p>
        </div>
        <StepIndicator currentStep={1} />
      </div>

      {/* Content */}
      <div className="space-y-6">
        <CreateProjectForm
          onGenerateRubric={handleGenerateRubric}
          onSubmit={handleFormSubmit}
          isGenerating={isGenerating}
        />

        {showRubric && localRubric.length > 0 && (
          <div ref={rubricRef}>
          <RubricTable
            rubric={localRubric}
            onRubricChange={handleRubricChange}
            onApprove={handleApproveRubric}
          />
          </div>
        )}
      </div>
    </div>
  );
}
