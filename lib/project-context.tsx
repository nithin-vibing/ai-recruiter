'use client';

import React, { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import type { Project, RubricCriterion, Candidate, ScreeningProgress, PercentileThreshold, CandidateStatus } from './types';
import { startScreening, subscribeToScreeningProgress, fetchCandidates, mapCandidateRow, incrementResumeCount } from './api-client';
import { supabase } from './supabase';

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
  beginScreening: (
    projectId: string,
    files: File | File[],
    userId: string | undefined,
    onSkippedFiles: (files: string[]) => void,
  ) => void;

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

  // Screening orchestration refs — survive page navigation since context lives in the layout
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const totalFilesRef = useRef<number>(0);
  const liveCandidatesRef = useRef<Candidate[]>([]);
  const unsubscribeRef = useRef<(() => void) | null>(null);

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

  const beginScreening = useCallback((
    projectId: string,
    files: File | File[],
    userId: string | undefined,
    onSkippedFiles: (files: string[]) => void,
  ) => {
    // Clean up any previous session
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (unsubscribeRef.current) unsubscribeRef.current();
    totalFilesRef.current = 0;
    liveCandidatesRef.current = [];

    setScreeningProgress({ current: 0, total: 0, isComplete: false });

    // Realtime: each INSERT fires as a candidate finishes scoring
    const unsubscribe = subscribeToScreeningProgress(projectId, (raw) => {
      const incoming = mapCandidateRow(raw, 0);
      if (liveCandidatesRef.current.some(c => c.id === incoming.id)) return;
      const updated = [...liveCandidatesRef.current, incoming]
        .sort((a, b) => b.totalScore - a.totalScore)
        .map((c, i) => ({ ...c, rank: i + 1 }));
      liveCandidatesRef.current = updated;
      setCandidatesState(updated);
      setScreeningProgress({
        current: updated.length,
        total: totalFilesRef.current || updated.length,
        isComplete: false,
      });
    });
    unsubscribeRef.current = unsubscribe;

    // Polling: checks project status for completion every 3s
    pollingRef.current = setInterval(async () => {
      try {
        const { count } = await supabase
          .from('candidates')
          .select('*', { count: 'exact', head: true })
          .eq('project_id', projectId);

        const { data: project } = await supabase
          .from('projects')
          .select('status')
          .eq('id', projectId)
          .single();

        setScreeningProgress({
          current: count || 0,
          total: totalFilesRef.current || count || 0,
          isComplete: project?.status === 'complete',
        });

        if (project?.status === 'complete') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          unsubscribe();
          unsubscribeRef.current = null;

          const allCandidates = await fetchCandidates(projectId);
          setCandidatesState(allCandidates);
          setScreeningProgress({
            current: allCandidates.length,
            total: allCandidates.length,
            isComplete: true,
          });

          if (userId && allCandidates.length > 0) {
            incrementResumeCount(userId, allCandidates.length).catch(() => {});
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 3000);

    // Fire the n8n screening request — don't await (takes minutes; Vercel will timeout)
    startScreening(
      projectId,
      files,
      (_current, total) => {
        if (total > 0 && totalFilesRef.current === 0) {
          totalFilesRef.current = total;
          setScreeningProgress(prev => ({
            current: prev?.current ?? 0,
            total,
            isComplete: false,
          }));
        }
      },
      onSkippedFiles,
    ).catch((err) => {
      console.log('Screening request completed or timed out:', err?.message || 'done');
    });
  }, []);

  const resetProject = useCallback(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (unsubscribeRef.current) unsubscribeRef.current();
    unsubscribeRef.current = null;
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
        beginScreening,
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
