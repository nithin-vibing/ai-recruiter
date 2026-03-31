'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { UploadResumes } from '@/components/screens/upload-resumes';
import { StepIndicator } from '@/components/shared/step-indicator';
import { useProject } from '@/lib/project-context';
import { startScreening, subscribeToScreeningProgress, fetchCandidates, canScreenResumes, incrementResumeCount } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import type { PercentileThreshold } from '@/lib/types';

export default function UploadResumesPage() {
  const router = useRouter();
  const { user } = useAuth();
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
  const [isScreening, setIsScreening] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleThresholdChange = (newThreshold: PercentileThreshold) => {
    setThreshold(newThreshold);
    setPercentileThreshold(newThreshold);
  };

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const handleStartScreening = async (files: File[], percentile: PercentileThreshold) => {
    const projectId = sessionStorage.getItem('currentProjectId');
    if (!projectId) {
      alert('No project found. Please go back to Step 1 and create a project first.');
      return;
    }

    // Check resume limit before screening
    if (user?.id) {
      try {
        const resumeCheck = await canScreenResumes(user.id, 0);
        if (resumeCheck.remaining <= 0) {
          const upgrade = confirm(
            `You've screened ${resumeCheck.current} of ${resumeCheck.limit} resumes this month (free tier).\n\nUpgrade to Pro for 500 resumes/month?\n\nClick OK to see pricing, or Cancel to go back.`
          );
          if (upgrade) router.push('/dashboard/pricing');
          return;
        }
      } catch (err) {
        console.warn('Usage check failed, proceeding:', err);
      }
    }

    setPercentileThreshold(percentile);
    setIsScreening(true);

    const zipFile = files[0];

    // Set initial progress
    setScreeningProgress({
      current: 0,
      total: 0,
      isComplete: false,
    });

    // Subscribe to real-time updates — each candidate insert fires this
    const unsubscribe = subscribeToScreeningProgress(projectId, () => {
      // We'll use polling as the primary method since WebSocket may not always work
    });

    // Start polling for candidates count every 3 seconds
    pollingRef.current = setInterval(async () => {
      try {
        const { count } = await supabase
          .from('candidates')
          .select('*', { count: 'exact', head: true })
          .eq('project_id', projectId);

        const currentCount = count || 0;

        // Check if project status is complete
        const { data: project } = await supabase
          .from('projects')
          .select('status')
          .eq('id', projectId)
          .single();

        setScreeningProgress({
          current: currentCount,
          total: currentCount, // Update as we go
          isComplete: project?.status === 'complete',
        });

        if (project?.status === 'complete') {
          // Stop polling
          if (pollingRef.current) clearInterval(pollingRef.current);
          unsubscribe();

          // Fetch all candidates
          const candidates = await fetchCandidates(projectId);
          setCandidates(candidates);

          // Track resume usage
          if (user?.id && candidates.length > 0) {
            incrementResumeCount(user.id, candidates.length).catch((err) =>
              console.warn('Failed to track resume usage:', err)
            );
          }

          setScreeningProgress({
            current: candidates.length,
            total: candidates.length,
            isComplete: true,
          });

          // Wait to show completion state
          await new Promise(resolve => setTimeout(resolve, 1500));

          setCurrentStep(3);
          router.push('/dashboard/project/results');
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 3000);

    // Fire the screening request — don't await it (it takes minutes)
    // The API route may timeout, but n8n will keep processing
    startScreening(projectId, zipFile).catch((error) => {
      console.log('Screening request completed or timed out:', error?.message || 'done');
      // This is expected — Vercel functions timeout after 10-60s
      // n8n continues processing regardless
    });

    // Increment resume count (we use file count from the ZIP)
    // This runs after extraction, so we count the actual resumes processed
    if (user?.id) {
      // We'll count candidates when screening completes (in the polling loop)
    }
  };

  return (
    <div className="p-4 sm:p-8">
      {/* Header with Step Indicator */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Upload Resumes
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload candidate resumes and start AI screening
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
