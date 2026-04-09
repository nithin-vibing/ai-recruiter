'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { UploadResumes } from '@/components/screens/upload-resumes';
import { StepIndicator } from '@/components/shared/step-indicator';
import { useProject } from '@/lib/project-context';
import { startScreening, subscribeToScreeningProgress, fetchCandidates, canScreenResumes, incrementResumeCount } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, ArrowLeft, Zap, ChevronLeft } from 'lucide-react';
import type { PercentileThreshold } from '@/lib/types';

/** Request browser notification permission — called once when screening starts. */
async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

/** Fire a browser push notification (works even when tab is in background). */
function sendBrowserNotification(title: string, body: string) {
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/icon.svg' });
  }
}

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
  const [limitReached, setLimitReached] = useState(false);
  const [limitInfo, setLimitInfo] = useState<{ current: number; limit: number } | null>(null);
  const [noProject, setNoProject] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const totalFilesRef = useRef<number>(0);

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
    const projectId = localStorage.getItem('currentProjectId');
    if (!projectId) {
      setNoProject(true);
      return;
    }

    // Check resume limit before screening
    if (user?.id) {
      try {
        const resumeCheck = await canScreenResumes(user.id, 0);
        if (resumeCheck.remaining <= 0) {
          setLimitReached(true);
          setLimitInfo({ current: resumeCheck.current, limit: resumeCheck.limit });
          return;
        }
      } catch (err) {
        console.warn('Usage check failed, proceeding:', err);
      }
    }

    setPercentileThreshold(percentile);
    setIsScreening(true);

    // Ask for browser notification permission now (requires user gesture)
    requestNotificationPermission();

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
          total: totalFilesRef.current || currentCount,
          isComplete: project?.status === 'complete',
        });

        if (project?.status === 'complete') {
          // Stop polling
          if (pollingRef.current) clearInterval(pollingRef.current);
          unsubscribe();

          // Fetch all candidates
          const candidates = await fetchCandidates(projectId);
          setCandidates(candidates);

          // Notify — browser push if tab is backgrounded, toast always
          const candidateCount = candidates.length;
          toast.success(`Screening complete! ${candidateCount} candidate${candidateCount !== 1 ? 's' : ''} ranked.`, {
            duration: 5000,
            action: { label: 'View Results', onClick: () => router.push('/dashboard/project/results') },
          });
          sendBrowserNotification(
            'Screening complete ✓',
            `${candidateCount} candidate${candidateCount !== 1 ? 's' : ''} have been scored and ranked.`
          );

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
    // The API route may timeout, but n8n will keep processing.
    // onExtractionProgress fires during client-side PDF extraction and gives us
    // the total file count so the progress bar has a real denominator.
    // If user uploaded individual PDFs, pass the array; if ZIP, pass the single file
    const screeningInput = files.length === 1 && files[0].name.toLowerCase().endsWith('.zip')
      ? files[0]
      : files;

    startScreening(
      projectId,
      screeningInput,
      (_current, total) => {
        if (total > 0 && totalFilesRef.current === 0) {
          totalFilesRef.current = total;
          setScreeningProgress({ current: screeningProgress?.current ?? 0, total, isComplete: false });
        }
      },
      (failedFiles) => {
        const count = failedFiles.length;
        const label = count === 1 ? `1 file` : `${count} files`;
        toast.warning(`${label} couldn't be read and were skipped`, {
          description: failedFiles.length <= 3
            ? failedFiles.join(', ')
            : `${failedFiles.slice(0, 3).join(', ')} and ${failedFiles.length - 3} more. These are likely scanned or image-only PDFs.`,
          duration: 8000,
        });
      }
    ).catch((error) => {
      console.log('Screening request completed or timed out:', error?.message || 'done');
      // This is expected — Vercel functions timeout after 10-60s
      // n8n continues processing regardless
    });
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
              <span className="text-muted-foreground">Role:</span>{' '}
              <span className="font-medium">{currentProject.name}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {currentProject?.name && !isScreening && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => router.push('/dashboard/project/create')}
            >
              <ChevronLeft className="h-4 w-4" />
              Back to Rubric
            </Button>
          )}
          <StepIndicator currentStep={2} />
        </div>
      </div>

      {/* No project found — inline error card */}
      {noProject && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-6 text-center space-y-3">
            <p className="font-display text-lg font-bold text-foreground">No project found</p>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              You need to create a project and approve a rubric before uploading resumes.
            </p>
            <Button
              className="bg-electric-blue hover:bg-deep-blue"
              onClick={() => router.push('/dashboard/project/create')}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Step 1
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Resume limit reached — inline upgrade card */}
      {limitReached && limitInfo && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="p-6 text-center space-y-3">
            <Lock className="h-10 w-10 text-amber-500 mx-auto" />
            <h2 className="font-display text-xl font-bold text-foreground">
              Monthly resume limit reached
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              You&apos;ve screened {limitInfo.current} of {limitInfo.limit} resumes this month on the free plan.
              Upgrade to Pro for 500 resumes/month.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button variant="outline" onClick={() => router.push('/dashboard')}>
                Back to Dashboard
              </Button>
              <Button
                className="bg-electric-blue hover:bg-electric-blue/90 gap-2"
                onClick={() => router.push('/dashboard/pricing')}
              >
                <Zap className="h-4 w-4" />
                Upgrade to Pro — $29/mo
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main upload UI — hidden when showing error states */}
      {!noProject && !limitReached && (
        <UploadResumes
          onStartScreening={handleStartScreening}
          screeningProgress={screeningProgress}
          percentileThreshold={threshold}
          onThresholdChange={handleThresholdChange}
        />
      )}
    </div>
  );
}
