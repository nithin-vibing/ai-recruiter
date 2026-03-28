'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreateProjectForm } from '@/components/screens/create-project-form';
import { RubricTable } from '@/components/screens/rubric-table';
import { StepIndicator } from '@/components/shared/step-indicator';
import { useProject } from '@/lib/project-context';
import type { RubricCriterion } from '@/lib/types';

// Mock rubric generation - replace with actual n8n webhook
async function generateMockRubric(jobDescription: string): Promise<RubricCriterion[]> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Return mock rubric based on common criteria
  return [
    {
      id: crypto.randomUUID(),
      name: 'Technical Skills',
      description: 'Proficiency in required technologies and programming languages',
      maxScore: 10,
      weight: 0.25,
    },
    {
      id: crypto.randomUUID(),
      name: 'Experience',
      description: 'Relevant work experience and industry knowledge',
      maxScore: 10,
      weight: 0.20,
    },
    {
      id: crypto.randomUUID(),
      name: 'Education',
      description: 'Educational background and certifications',
      maxScore: 10,
      weight: 0.15,
    },
    {
      id: crypto.randomUUID(),
      name: 'Problem Solving',
      description: 'Demonstrated ability to solve complex problems',
      maxScore: 10,
      weight: 0.15,
    },
    {
      id: crypto.randomUUID(),
      name: 'Communication',
      description: 'Written and verbal communication skills',
      maxScore: 10,
      weight: 0.10,
    },
    {
      id: crypto.randomUUID(),
      name: 'Leadership',
      description: 'Leadership experience and team collaboration',
      maxScore: 10,
      weight: 0.10,
    },
    {
      id: crypto.randomUUID(),
      name: 'Culture Fit',
      description: 'Alignment with company values and work style',
      maxScore: 10,
      weight: 0.05,
    },
  ];
}

export default function CreateProjectPage() {
  const router = useRouter();
  const { setProjectDetails, setRubric, currentProject, setCurrentStep } = useProject();
  const [isGenerating, setIsGenerating] = useState(false);
  const [localRubric, setLocalRubric] = useState<RubricCriterion[]>([]);
  const [showRubric, setShowRubric] = useState(false);

  const handleGenerateRubric = async (data: { name: string; roleName: string; jobDescription: string }) => {
    setIsGenerating(true);
    try {
      const rubric = await generateMockRubric(data.jobDescription);
      setLocalRubric(rubric);
      setShowRubric(true);
      return rubric;
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
          <RubricTable
            rubric={localRubric}
            onRubricChange={handleRubricChange}
            onApprove={handleApproveRubric}
          />
        )}
      </div>
    </div>
  );
}
