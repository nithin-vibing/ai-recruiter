'use client';

import { useEffect, useState, useMemo } from 'react';
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
  fetchOverrideInsights,
} from '@/lib/api-client';
import { Plus, SlidersHorizontal, ChevronUp, EyeOff, Eye, TrendingUp, X as XIcon } from 'lucide-react';
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
  const [blindMode, setBlindMode] = useState(false);
  const [overrideInsight, setOverrideInsight] = useState<{ total: number; message: string } | null>(null);
  const [insightDismissed, setInsightDismissed] = useState(false);

  // Live re-rank preview: recompute scores client-side from new rubric weights
  // while the user edits the rubric, before committing to a full AI re-rank.
  const previewCandidates = useMemo(() => {
    if (!showRubricEditor || rubric.length === 0 || candidates.length === 0) return null;
    return [...candidates]
      .map(c => {
        const previewScore = c.scores.reduce((sum, s) => {
          const criterion = rubric.find(r => r.name === s.criterionName);
          if (!criterion || s.maxScore === 0) return sum;
          return sum + (s.score / s.maxScore) * criterion.weight * 100;
        }, 0);
        return { ...c, previewScore: Math.round(previewScore * 10) / 10 };
      })
      .sort((a, b) => b.previewScore - a.previewScore)
      .map((c, i) => ({ ...c, previewRank: i + 1 }));
  }, [candidates, rubric, showRubricEditor]);

  // Load rubric when editor opens — use localStorage ID (actual Supabase project ID)
  useEffect(() => {
    if (showRubricEditor) {
      const projectId = localStorage.getItem('currentProjectId');
      if (projectId) {
        fetchRubricCriteria(projectId)
          .then(criteria => {
            setRubric(criteria);
            setOriginalRubric(criteria);
          })
          .catch(err => console.error('Failed to load rubric:', err));
      }
    }
  }, [showRubricEditor]);

  // Fetch override pattern insights once on mount — only surfaces when ≥5 overrides exist.
  useEffect(() => {
    const projectId = localStorage.getItem('currentProjectId');
    if (!projectId) return;
    const dismissedKey = `insights-dismissed-${projectId}`;
    if (localStorage.getItem(dismissedKey) === 'true') return;
    fetchOverrideInsights(projectId)
      .then(insight => { if (insight) setOverrideInsight(insight); })
      .catch(() => {});
  }, []);

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
    const projectId = localStorage.getItem('currentProjectId');
    if (!projectId) return;
    setIsRescoring(true);
    setRescoreError(null);
    try {
      await rescoreProject(projectId, rubric);
      const updated = await fetchCandidates(projectId);
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
          <h2 className="font-display text-xl font-semibold">No results yet</h2>
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
            variant={blindMode ? 'default' : 'outline'}
            onClick={() => setBlindMode(b => !b)}
            title="Hide AI scores to review resumes without anchoring bias"
          >
            {blindMode ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            {blindMode ? 'Show scores' : 'Blind review'}
          </Button>
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
            {showRubricEditor ? 'Hide scorecard' : 'Edit scorecard & re-rank'}
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

      {/* Override pattern insight card */}
      {overrideInsight && !insightDismissed && (
        <div className="flex items-start gap-3 rounded-lg border border-electric-blue/20 bg-electric-blue/5 px-4 py-3 text-sm">
          <TrendingUp className="h-4 w-4 text-electric-blue shrink-0 mt-0.5" />
          <p className="flex-1 text-muted-foreground">{overrideInsight.message}</p>
          <button
            onClick={() => {
              setInsightDismissed(true);
              const projectId = localStorage.getItem('currentProjectId');
              if (projectId) localStorage.setItem(`insights-dismissed-${projectId}`, 'true');
            }}
            className="shrink-0 rounded p-0.5 hover:bg-electric-blue/10 transition-colors text-muted-foreground"
            aria-label="Dismiss"
          >
            <XIcon className="h-3.5 w-3.5" />
          </button>
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
        previewCandidates={previewCandidates}
        blindMode={blindMode}
      />
    </div>
  );
}
