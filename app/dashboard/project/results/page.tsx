'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ResultsTable } from '@/components/screens/results-table';
import { RubricTable } from '@/components/screens/rubric-table';
import { StepIndicator } from '@/components/shared/step-indicator';
import { Button } from '@/components/ui/button';
import { useProject } from '@/lib/project-context';
import {
  updateCandidateStatus as updateStatusInDb,
  updateCandidateComment as updateCommentInDb,
  logCandidateOverride,
  fetchRubricCriteria,
  fetchCandidates,
  rescoreProject,
} from '@/lib/api-client';
import { Plus, SlidersHorizontal, ChevronUp } from 'lucide-react';
import type { CandidateStatus, RubricCriterion } from '@/lib/types';

export default function ResultsPage() {
  const router = useRouter();
  const {
    currentProject,
    candidates,
    setCandidates,
    updateCandidateStatus,
    updateCandidateComments,
    resetProject,
  } = useProject();

  const [showRubricEditor, setShowRubricEditor] = useState(false);
  const [rubric, setRubric] = useState<RubricCriterion[]>([]);
  const [originalRubric, setOriginalRubric] = useState<RubricCriterion[]>([]);
  const [isRescoring, setIsRescoring] = useState(false);
  const [rescoreError, setRescoreError] = useState<string | null>(null);

  // Load rubric when editor opens
  useEffect(() => {
    if (showRubricEditor && currentProject?.id) {
      fetchRubricCriteria(currentProject.id)
        .then(criteria => {
          setRubric(criteria);
          setOriginalRubric(criteria);
        })
        .catch(err => console.error('Failed to load rubric:', err));
    }
  }, [showRubricEditor, currentProject?.id]);

  const handleStatusChange = async (candidateId: string, status: CandidateStatus) => {
    const candidate = candidates.find(c => c.id === candidateId);
    const previousStatus = candidate?.status || 'pending';
    updateCandidateStatus(candidateId, status);
    try {
      await updateStatusInDb(candidateId, status);
    } catch (error) {
      console.error('Failed to save status:', error);
    }
    if (candidate && currentProject?.id) {
      logCandidateOverride(
        candidateId,
        currentProject.id,
        previousStatus,
        status,
        candidate.totalScore,
        candidate.rank
      ).catch(() => {});
    }
  };

  const handleCommentsChange = async (candidateId: string, comments: string) => {
    updateCandidateComments(candidateId, comments);
    try {
      await updateCommentInDb(candidateId, comments);
    } catch (error) {
      console.error('Failed to save comment:', error);
    }
  };

  const handleRerank = async () => {
    if (!currentProject?.id) return;
    setIsRescoring(true);
    setRescoreError(null);
    try {
      await rescoreProject(currentProject.id, rubric);
      // Refresh candidates with new scores
      const updated = await fetchCandidates(currentProject.id);
      setCandidates(updated);
      setShowRubricEditor(false);
    } catch (err) {
      setRescoreError(err instanceof Error ? err.message : 'Re-ranking failed');
    } finally {
      setIsRescoring(false);
    }
  };

  const handleNewProject = () => {
    resetProject();
    localStorage.removeItem('currentProjectId');
    router.push('/dashboard/project/create');
  };

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
    <div className="p-4 sm:p-8">
      {/* Header */}
      <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Screening Results
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review candidates, update status, and export results
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StepIndicator currentStep={3} />
          <Button
            variant="outline"
            onClick={() => {
              setShowRubricEditor(prev => !prev);
              setRescoreError(null);
            }}
          >
            {showRubricEditor ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <SlidersHorizontal className="h-4 w-4" />
            )}
            {showRubricEditor ? 'Hide Rubric' : 'Edit Rubric & Re-rank'}
          </Button>
          <Button variant="outline" onClick={handleNewProject}>
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </div>
      </div>

      {/* Rubric Editor */}
      {showRubricEditor && (
        <div className="mb-6">
          {rescoreError && (
            <div className="mb-3 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {rescoreError}
            </div>
          )}
          <RubricTable
            rubric={rubric}
            originalRubric={originalRubric}
            onRubricChange={setRubric}
            onApprove={handleRerank}
            approveLabel="Re-rank Candidates"
            isLoading={isRescoring}
          />
        </div>
      )}

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
