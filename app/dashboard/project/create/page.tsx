'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CreateProjectForm } from '@/components/screens/create-project-form';
import { RubricTable } from '@/components/screens/rubric-table';
import { StepIndicator } from '@/components/shared/step-indicator';
import { useProject } from '@/lib/project-context';
import { generateRubric, fetchRubric, claimProject } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, ChevronDown } from 'lucide-react';
import type { RubricCriterion } from '@/lib/types';

export default function CreateProjectPage() {
  const router = useRouter();
  const { setProjectDetails, setRubric, currentProject, setCurrentStep } = useProject();
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [localRubric, setLocalRubric] = useState<RubricCriterion[]>([]);
  const [showRubric, setShowRubric] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{ name: string; roleName: string } | null>(null);
  const [formExpanded, setFormExpanded] = useState(false);
  const [originalRubric, setOriginalRubric] = useState<RubricCriterion[]>([]);
  const rubricRef = useRef<HTMLDivElement>(null);

  const handleGenerateRubric = async (data: { name: string; roleName: string; jobDescription: string }) => {
    setIsGenerating(true);
    try {
      const result = await generateRubric(data);
      const rubricArray = Array.isArray(result) ? result : [result];
      const pid = rubricArray[0]?.project_id;

      if (pid) {
        setProjectId(pid);
        // Claim project for the logged-in user
        if (user?.id) {
          claimProject(pid, user.id).catch((err) =>
            console.error('Failed to claim project:', err)
          );
        }
      }

      const mappedRubric: RubricCriterion[] = rubricArray.map((row: Record<string, unknown>) => ({
        id: row.id as string,
        name: row.criterion as string,
        description: (row.description as string) || '',
        maxScore: (row.max_score as number) || 10,
        weight: Number(row.weight) || 1,
      }));
      setLocalRubric(mappedRubric);
      setOriginalRubric(mappedRubric);
      setShowRubric(true);
      setFormData({ name: data.name, roleName: data.roleName });
      // Scroll to top so rubric is visible (form collapses)
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
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
    if (projectId) {
      setProjectDetails({
        name: currentProject?.name || '',
        roleName: currentProject?.roleName || '',
        jobDescription: currentProject?.jobDescription || '',
      });
      sessionStorage.setItem('currentProjectId', projectId);
    }
    setCurrentStep(2);
    router.push('/dashboard/project/upload');
  };

  return (
    <div className="p-4 sm:p-8">
      {/* Header with Step Indicator */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Create New Project
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Define the job role and generate a screening rubric
          </p>
        </div>
        <StepIndicator currentStep={1} />
      </div>

      {/* Content */}
      <div className="space-y-5">
        {/* When rubric is showing, collapse form to a summary bar */}
        {showRubric && formData ? (
          <Card
            className="cursor-pointer hover:border-electric-blue/30 transition-all"
            onClick={() => setFormExpanded(!formExpanded)}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-success shrink-0" />
                <div>
                  <p className="font-display font-semibold text-foreground">{formData.name}</p>
                  <p className="text-sm text-muted-foreground">{formData.roleName}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-success/10 text-success border-0">Project Created</Badge>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${formExpanded ? 'rotate-180' : ''}`} />
              </div>
            </CardContent>
            {formExpanded && (
              <div className="px-4 pb-4 border-t" onClick={(e) => e.stopPropagation()}>
                <div className="pt-4">
                  <CreateProjectForm
                    onGenerateRubric={handleGenerateRubric}
                    onSubmit={handleFormSubmit}
                    isGenerating={isGenerating}
                  />
                </div>
              </div>
            )}
          </Card>
        ) : (
          <CreateProjectForm
            onGenerateRubric={handleGenerateRubric}
            onSubmit={handleFormSubmit}
            isGenerating={isGenerating}
          />
        )}

        {showRubric && localRubric.length > 0 && (
          <div ref={rubricRef}>
            <RubricTable
              rubric={localRubric}
              originalRubric={originalRubric}
              onRubricChange={handleRubricChange}
              onApprove={handleApproveRubric}
            />
          </div>
        )}
      </div>
    </div>
  );
}
