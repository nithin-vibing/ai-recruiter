'use client';

import { useRouter } from 'next/navigation';
import { ResultsTable } from '@/components/screens/results-table';
import { StepIndicator } from '@/components/shared/step-indicator';
import { Button } from '@/components/ui/button';
import { useProject } from '@/lib/project-context';
import { updateCandidateStatus as updateStatusInDb, updateCandidateComment as updateCommentInDb } from '@/lib/api-client';
import { Plus } from 'lucide-react';
import type { CandidateStatus } from '@/lib/types';

export default function ResultsPage() {
  const router = useRouter();
  const {
    currentProject,
    candidates,
    updateCandidateStatus,
    updateCandidateComments,
    resetProject,
  } = useProject();

  const handleStatusChange = async (candidateId: string, status: CandidateStatus) => {
    // Update locally (instant UI feedback)
    updateCandidateStatus(candidateId, status);
    // Persist to Supabase
    try {
      await updateStatusInDb(candidateId, status);
    } catch (error) {
      console.error('Failed to save status:', error);
    }
  };

  const handleCommentsChange = async (candidateId: string, comments: string) => {
    // Update locally (instant UI feedback)
    updateCandidateComments(candidateId, comments);
    // Persist to Supabase
    try {
      await updateCommentInDb(candidateId, comments);
    } catch (error) {
      console.error('Failed to save comment:', error);
    }
  };

  const handleNewProject = () => {
    resetProject();
    sessionStorage.removeItem('currentProjectId');
    router.push('/dashboard/project/create');
  };

  // Show empty state if no candidates
  if (!candidates || candidates.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-8">
        <div className="text-center">
          <h2 className="font-display text-xl font-semibold">No Results Yet</h2>
          <p className="mt-2 text-muted-foreground">
            Start a new project to screen candidates
          </p>
          <Button
            className="mt-4 bg-electric-blue hover:bg-deep-blue"
            onClick={handleNewProject}
          >
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header with Step Indicator */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Screening Results
          </h1>
          <p className="mt-1 text-muted-foreground">
            Step 3: Review and manage candidate evaluations
          </p>
        </div>
        <div className="flex items-center gap-4">
          <StepIndicator currentStep={3} />
          <Button
            variant="outline"
            onClick={handleNewProject}
          >
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </div>
      </div>

      {/* Results Table */}
      <ResultsTable
        candidates={candidates}
        projectName={currentProject?.name || 'Untitled Project'}
        roleName={currentProject?.roleName || 'Role'}
        percentileThreshold={currentProject?.percentileThreshold || 100}
        onStatusChange={handleStatusChange}
        onCommentsChange={handleCommentsChange}
      />
    </div>
  );
}
