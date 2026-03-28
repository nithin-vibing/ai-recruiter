'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UploadResumes } from '@/components/screens/upload-resumes';
import { StepIndicator } from '@/components/shared/step-indicator';
import { useProject } from '@/lib/project-context';
import type { PercentileThreshold, ScreeningProgress, Candidate } from '@/lib/types';

// Mock screening function - replace with actual n8n webhook
async function mockScreenResumes(
  files: File[], 
  onProgress: (progress: ScreeningProgress) => void
): Promise<Candidate[]> {
  const total = files.length;
  const candidates: Candidate[] = [];

  for (let i = 0; i < total; i++) {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 800));
    
    onProgress({
      current: i + 1,
      total,
      isComplete: false,
    });

    // Generate mock candidate data
    const names = ['Alex Johnson', 'Sarah Chen', 'Michael Park', 'Emily Davis', 'James Wilson', 'Maria Garcia', 'David Kim', 'Lisa Thompson'];
    const score = Math.floor(Math.random() * 40) + 60; // Score between 60-100
    
    candidates.push({
      id: crypto.randomUUID(),
      projectId: 'current',
      rank: 0, // Will be set after sorting
      name: names[i % names.length] || `Candidate ${i + 1}`,
      email: `candidate${i + 1}@email.com`,
      phone: `+1 (555) ${String(Math.floor(Math.random() * 900) + 100)}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
      linkedIn: `https://linkedin.com/in/candidate${i + 1}`,
      totalScore: score,
      scores: [
        { criterionId: '1', criterionName: 'Technical Skills', score: Math.floor(Math.random() * 4) + 7, maxScore: 10 },
        { criterionId: '2', criterionName: 'Experience', score: Math.floor(Math.random() * 4) + 6, maxScore: 10 },
        { criterionId: '3', criterionName: 'Education', score: Math.floor(Math.random() * 4) + 6, maxScore: 10 },
      ],
      reasoning: `Strong candidate with ${score > 80 ? 'excellent' : score > 70 ? 'good' : 'adequate'} qualifications. Shows proficiency in required skills and relevant experience in the field. Communication skills are ${score > 75 ? 'above average' : 'satisfactory'}.`,
      status: 'pending',
      comments: '',
    });
  }

  // Sort by score and assign ranks
  candidates.sort((a, b) => b.totalScore - a.totalScore);
  candidates.forEach((c, idx) => c.rank = idx + 1);

  onProgress({
    current: total,
    total,
    isComplete: true,
  });

  return candidates;
}

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
    setPercentileThreshold(percentile);
    
    const candidates = await mockScreenResumes(files, (progress) => {
      setScreeningProgress(progress);
    });

    setCandidates(candidates);
    
    // Wait a moment to show completion
    await new Promise(resolve => setTimeout(resolve, 500));
    
    setCurrentStep(3);
    router.push('/dashboard/project/results');
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
