// API Client for n8n Webhook + Supabase Integration

import { supabase } from './supabase';
import type { Candidate, CandidateStatus } from './types';

const N8N_WEBHOOK_BASE = 'https://ainkv.app.n8n.cloud/webhook';

// ─── Screen 1: Generate Rubric ───────────────────────────────────────────────

interface GenerateRubricPayload {
  name: string;
  roleName: string;
  jobDescription: string;
}

/**
 * Calls n8n Workflow 1 (Rubric Generator).
 * n8n creates the project in Supabase, generates rubric via OpenAI,
 * saves rubric to Supabase, and returns the project + rubric data.
 */
export async function generateRubric(data: GenerateRubricPayload) {
  const response = await fetch(`${N8N_WEBHOOK_BASE}/rubric-generator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectName: data.name,
      roleName: data.roleName,
      jobDescription: data.jobDescription,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to generate rubric: ${response.statusText}`);
  }

  return response.json();
}

// ─── Screen 2: Start Screening ───────────────────────────────────────────────

/**
 * Calls n8n Workflow 2 (Resume Screener).
 * Sends the ZIP file + projectId via FormData.
 * n8n decompresses, scores each resume with Claude, writes to Supabase.
 */
export async function startScreening(projectId: string, zipFile: File) {
  const formData = new FormData();
  formData.append('projectId', projectId);
  formData.append('resumesZip', zipFile);

  const response = await fetch(`${N8N_WEBHOOK_BASE}/resume-screener`, {
    method: 'POST',
    body: formData,
    // No Content-Type header — browser sets it with boundary for FormData
  });

  if (!response.ok) {
    throw new Error(`Failed to start screening: ${response.statusText}`);
  }

  return response.json();
}

// ─── Screen 2: Real-time Progress ────────────────────────────────────────────

/**
 * Subscribe to real-time candidate inserts for a project.
 * Each time n8n writes a scored candidate to Supabase, this fires.
 */
export function subscribeToScreeningProgress(
  projectId: string,
  onNewCandidate: (candidate: Record<string, unknown>) => void
) {
  const channel = supabase
    .channel(`screening-${projectId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'candidates',
        filter: `project_id=eq.${projectId}`,
      },
      (payload) => {
        onNewCandidate(payload.new);
      }
    )
    .subscribe();

  // Return unsubscribe function
  return () => {
    supabase.removeChannel(channel);
  };
}

// ─── Screen 3: Fetch Results ─────────────────────────────────────────────────

/**
 * Fetch all candidates for a project, sorted by score descending.
 */
export async function fetchCandidates(projectId: string): Promise<Candidate[]> {
  const { data, error } = await supabase
    .from('candidates')
    .select('*')
    .eq('project_id', projectId)
    .order('score', { ascending: false });

  if (error) throw new Error(`Failed to fetch candidates: ${error.message}`);

  // Map Supabase column names (snake_case) to frontend types (camelCase)
  return (data || []).map((row, index) => ({
    id: row.id,
    projectId: row.project_id,
    rank: index + 1,
    name: row.candidate_name || 'Unknown',
    email: row.email || '',
    phone: row.phone || '',
    linkedIn: row.linkedin || '',
    totalScore: Number(row.score) || 0,
    scores: [], // Per-criterion scores stored in raw_response if needed
    reasoning: row.reasoning || '',
    status: row.status || 'pending',
    comments: row.user_comment || '',
  }));
}

// ─── Screen 3: Update Candidate ──────────────────────────────────────────────

/**
 * Update candidate status (shortlisted/hold/rejected) in Supabase.
 */
export async function updateCandidateStatus(candidateId: string, status: CandidateStatus) {
  const { error } = await supabase
    .from('candidates')
    .update({ status })
    .eq('id', candidateId);

  if (error) throw new Error(`Failed to update status: ${error.message}`);
}

/**
 * Update candidate comment in Supabase.
 */
export async function updateCandidateComment(candidateId: string, comment: string) {
  const { error } = await supabase
    .from('candidates')
    .update({ user_comment: comment })
    .eq('id', candidateId);

  if (error) throw new Error(`Failed to update comment: ${error.message}`);
}

// ─── Dashboard: Fetch Projects ───────────────────────────────────────────────

/**
 * Fetch all projects for the dashboard.
 */
export async function fetchProjects() {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch projects: ${error.message}`);
  return data || [];
}

/**
 * Fetch rubric for a project.
 */
export async function fetchRubric(projectId: string) {
  const { data, error } = await supabase
    .from('rubrics')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true });

  if (error) throw new Error(`Failed to fetch rubric: ${error.message}`);
  return data || [];
}
