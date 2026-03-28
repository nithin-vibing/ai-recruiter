'use client';

import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { Project, RubricCriterion, Candidate, ScreeningProgress, PercentileThreshold, CandidateStatus } from './types';

interface ProjectContextType {
  // Current project state
  currentProject: Partial<Project> | null;
  candidates: Candidate[];
  screeningProgress: ScreeningProgress | null;
  
  // Project actions
  setProjectDetails: (details: { name: string; roleName: string; jobDescription: string }) => void;
  setRubric: (rubric: RubricCriterion[]) => void;
  setPercentileThreshold: (threshold: PercentileThreshold) => void;
  
  // Candidate actions
  setCandidates: (candidates: Candidate[]) => void;
  updateCandidateStatus: (candidateId: string, status: CandidateStatus) => void;
  updateCandidateComments: (candidateId: string, comments: string) => void;
  
  // Screening actions
  setScreeningProgress: (progress: ScreeningProgress | null) => void;
  
  // Navigation helpers
  currentStep: 1 | 2 | 3;
  setCurrentStep: (step: 1 | 2 | 3) => void;
  
  // Reset
  resetProject: () => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [currentProject, setCurrentProject] = useState<Partial<Project> | null>(null);
  const [candidates, setCandidatesState] = useState<Candidate[]>([]);
  const [screeningProgress, setScreeningProgress] = useState<ScreeningProgress | null>(null);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  const setProjectDetails = useCallback((details: { name: string; roleName: string; jobDescription: string }) => {
    setCurrentProject(prev => ({
      ...prev,
      ...details,
      id: prev?.id || crypto.randomUUID(),
      status: 'draft' as const,
      createdAt: prev?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const setRubric = useCallback((rubric: RubricCriterion[]) => {
    setCurrentProject(prev => ({
      ...prev,
      rubric,
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const setPercentileThreshold = useCallback((threshold: PercentileThreshold) => {
    setCurrentProject(prev => ({
      ...prev,
      percentileThreshold: threshold,
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const setCandidates = useCallback((newCandidates: Candidate[]) => {
    setCandidatesState(newCandidates);
  }, []);

  const updateCandidateStatus = useCallback((candidateId: string, status: CandidateStatus) => {
    setCandidatesState(prev => 
      prev.map(c => c.id === candidateId ? { ...c, status } : c)
    );
  }, []);

  const updateCandidateComments = useCallback((candidateId: string, comments: string) => {
    setCandidatesState(prev => 
      prev.map(c => c.id === candidateId ? { ...c, comments } : c)
    );
  }, []);

  const resetProject = useCallback(() => {
    setCurrentProject(null);
    setCandidatesState([]);
    setScreeningProgress(null);
    setCurrentStep(1);
  }, []);

  return (
    <ProjectContext.Provider
      value={{
        currentProject,
        candidates,
        screeningProgress,
        setProjectDetails,
        setRubric,
        setPercentileThreshold,
        setCandidates,
        updateCandidateStatus,
        updateCandidateComments,
        setScreeningProgress,
        currentStep,
        setCurrentStep,
        resetProject,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}
