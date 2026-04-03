// AI Recruiter Types

export interface RubricCriterion {
  id: string;
  name: string;
  description: string;
  maxScore: number;
  weight: number;
}

export interface Project {
  id: string;
  name: string;
  roleName: string;
  jobDescription: string;
  rubric: RubricCriterion[];
  percentileThreshold: number;
  status: 'draft' | 'screening' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export type CandidateStatus = 'pending' | 'shortlisted' | 'hold' | 'rejected';

export interface CandidateScore {
  criterionId: string;
  criterionName: string;
  score: number;
  maxScore: number;
  weight: number;
  evidence: string;
}

export interface Candidate {
  id: string;
  projectId: string;
  rank: number;
  name: string;
  email: string;
  phone: string;
  linkedIn: string;
  totalScore: number;
  scores: CandidateScore[];
  reasoning: string;
  status: CandidateStatus;
  comments: string;
  confidence?: 'high' | 'medium' | 'low';
  resumeUrl?: string;
}

export interface ScreeningProgress {
  current: number;
  total: number;
  isComplete: boolean;
}

export type PercentileThreshold = 2 | 5 | 10 | 25 | 50 | 100;

export const PERCENTILE_OPTIONS: { value: PercentileThreshold; label: string }[] = [
  { value: 2, label: 'Top 2%' },
  { value: 5, label: 'Top 5%' },
  { value: 10, label: 'Top 10%' },
  { value: 25, label: 'Top 25%' },
  { value: 50, label: 'Top 50%' },
  { value: 100, label: 'All Candidates' },
];

export type FilterStatus = 'all' | CandidateStatus;

export const STATUS_OPTIONS: { value: CandidateStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'hold', label: 'Hold' },
  { value: 'rejected', label: 'Rejected' },
];
