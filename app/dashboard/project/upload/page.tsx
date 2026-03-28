'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UploadResumes } from '@/components/screens/upload-resumes';
import { StepIndicator } from '@/components/shared/step-indicator';
import { useProject } from '@/lib/project-context';
import { startScreening, subscribeToScreeningProgress, fetchCandidates } from '@/lib/api-client';
import type { PercentileThreshold } from '@/lib/types';

export default function UploadResumesPage() {
  const router = useRouter();
  const {
    currentProject,
    setPercentileThreshold,
    setCandidates,
    screeningProgress,
    setScreeningProgress,
    setCurrentStep,
  } = useProject();

  const [threshold, setThreshold] = useState<PercentileThreshold>(
    (currentProject?.percentileThreshold as PercentileThreshold) || 25
  );

  const handleThresholdChange = (newThreshold: PercentileThreshold) => {
    setThreshold(newThreshold);
    setPercentileThreshold(newThreshold);
  };

  const handleStartScreening = async (files: File[], percentile: PercentileThreshold) => {
    const projectId = sessionStorage.getItem('currentProjectId');
    if (!projectId) {
      alert('No project found. Please go back to Step 1 and create a project first.');
      return;
    }

    setPercentileThreshold(percentile);

    const zipFile = files[0];
    let candidateCount = 0;

    // Subscribe to real-time updates BEFORE starting screening
    // Each time n8n writes a candidate to Supabase, this fires
    const unsubscribe = subscribeToScreeningProgress(projectId, () => {
      candidateCount++;
      setScreeningProgress({
        current: candidateCount,
        total: 0, // We don't know total upfront — will update when screening completes
        isComplete: false,
      });
    });

    try {
      // Call n8n Workflow 2 — this blocks until all resumes are scored
      await startScreening(projectId, zipFile);

      // Screening complete — fetch all candidates from Supabase
      const candidates = await fetchCandidates(projectId);

      setCandidates(candidates);
      setScreeningProgress({
        current: candidates.length,
        total: candidates.length,
        isComplete: true,
      });

      // Clean up subscription
      unsubscribe();

      // Wait a moment to show completion state
      await new Promise(resolve => setTimeout(resolve, 1500));

      setCurrentStep(3);
      router.push('/dashboard/project/results');
    } catch (error) {
      console.error('Screening failed:', error);
      unsubscribe();
      alert('Screening failed. Please try again.');
    }
  };

  return (
    <div className="p-8">
      {/* Header with Step Indicator */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Upload Resumes
          </h1>
          <p className="mt-1 text-muted-foreground">
            Step 2: Upload candidate resumes for AI screening
          </p>
          {currentProject?.name && (
            <p className="mt-2 text-sm">
              <span className="text-muted-foreground">Project:</span>{' '}
              <span className="font-medium">{currentProject.name}</span>
            </p>
          )}
        </div>
        <StepIndicator currentStep={2} />
      </div>

      {/* Content */}
      <UploadResumes
        onStartScreening={handleStartScreening}
        screeningProgress={screeningProgress}
        percentileThreshold={threshold}
        onThresholdChange={handleThresholdChange}
      />
    </div>
  );
}
