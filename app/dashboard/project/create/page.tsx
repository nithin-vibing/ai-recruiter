'use client';

import { useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CreateProjectForm } from '@/components/screens/create-project-form';
import { RubricTable } from '@/components/screens/rubric-table';
import { StepIndicator } from '@/components/shared/step-indicator';
import { useProject } from '@/lib/project-context';
import { generateRubric, claimProject, canCreateProject, incrementProjectCount } from '@/lib/api-client';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, ChevronDown, Lock, Sparkles } from 'lucide-react';
import type { RubricCriterion } from '@/lib/types';

const DEMO_VALUES = {
  name: 'Frontend Engineer Hiring — Q2',
  roleName: 'Senior Frontend Engineer',
  jobDescription: `We're building a consumer fintech app and need a Senior Frontend Engineer to lead our web platform.

Responsibilities:
- Architect and build complex React components and systems
- Lead technical decisions for frontend architecture
- Collaborate closely with design and product teams
- Mentor junior engineers and conduct code reviews
- Drive performance optimization and accessibility improvements

Requirements:
- 4+ years of production React experience
- Strong TypeScript skills
- Experience with Next.js or similar SSR frameworks
- Track record of shipping high-quality UI at scale
- Experience building or maintaining design systems

Nice to have:
- Startup experience (Series A–C)
- Familiarity with Tailwind CSS or utility-first CSS
- Open-source contributions
- Experience with testing frameworks (Jest, Playwright, Cypress)`,
};

function CreateProjectPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDemo = searchParams.get('demo') === '1';
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

  const [limitReached, setLimitReached] = useState(false);
  const [usageInfo, setUsageInfo] = useState<{ current: number; limit: number } | null>(null);

  const handleGenerateRubric = async (data: { name: string; roleName: string; jobDescription: string }): Promise<RubricCriterion[]> => {
    if (!user?.id) return [];

    // Check free tier project limit
    const projectCheck = await canCreateProject(user.id);
    if (!projectCheck.allowed) {
      setLimitReached(true);
      setUsageInfo({ current: projectCheck.current, limit: projectCheck.limit });
      return [];
    }

    setIsGenerating(true);
    try {
      const result = await generateRubric(data);
      const rubricArray = Array.isArray(result) ? result : [result];
      const pid = rubricArray[0]?.project_id;

      if (pid) {
        setProjectId(pid);
        // Claim project first — only count usage if claim succeeds
        if (user?.id) {
          try {
            await claimProject(pid, user.id);
            incrementProjectCount(user.id).catch((err) =>
              console.warn('Failed to increment project count:', err)
            );
          } catch (err) {
            console.error('Failed to claim project:', err);
            toast.error('Project created but could not be linked to your account. Please refresh and try again.');
          }
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
      localStorage.setItem('currentProjectId', projectId);
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

      {/* Limit Reached Banner */}
      {limitReached && usageInfo && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="p-6 text-center space-y-3">
            <Lock className="h-10 w-10 text-amber-500 mx-auto" />
            <h2 className="font-display text-xl font-bold text-foreground">
              Free Tier Limit Reached
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              You&apos;ve created {usageInfo.current} of 3 projects this month on the free plan.
              Upgrade to Pro for unlimited projects and 500 resumes/month.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button variant="outline" onClick={() => router.push('/dashboard')}>
                Back to Dashboard
              </Button>
              <Button
                className="bg-electric-blue hover:bg-electric-blue/90"
                onClick={() => router.push('/dashboard/pricing')}
              >
                Upgrade to Pro — $29/mo
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Content */}
      <div className="space-y-5" style={{ display: limitReached ? 'none' : undefined }}>
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
          <>
            {isDemo && (
              <div className="flex items-center gap-2 rounded-lg border border-electric-blue/30 bg-electric-blue/5 px-4 py-2.5 text-sm">
                <Sparkles className="h-4 w-4 text-electric-blue shrink-0" />
                <span className="text-muted-foreground">Pre-filled with a sample Frontend Engineer JD — feel free to edit or replace it.</span>
              </div>
            )}
            <CreateProjectForm
              onGenerateRubric={handleGenerateRubric}
              onSubmit={handleFormSubmit}
              isGenerating={isGenerating}
              initialValues={isDemo ? DEMO_VALUES : undefined}
            />
          </>
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

export default function CreateProjectPage() {
  return (
    <Suspense>
      <CreateProjectPageContent />
    </Suspense>
  );
}
