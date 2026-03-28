// API Client for n8n Webhook + Supabase Integration

import { supabase } from './supabase';
import type { Candidate, CandidateStatus } from './types';

// ─── Screen 1: Generate Rubric ───────────────────────────────────────────────

interface GenerateRubricPayload {
  name: string;
  roleName: string;
  jobDescription: string;
}

/**
 * Calls our Next.js API route, which proxies to n8n Workflow 1.
 * This avoids CORS issues (browser → same domain → n8n).
 */
export async function generateRubric(data: GenerateRubricPayload) {
  const response = await fetch('/api/generate-rubric', {
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
 * Calls our Next.js API route, which proxies to n8n Workflow 2.
 * First converts PDFs to text in the browser (pdf.js has full DOM support here),
 * then sends the text-only ZIP to the API route.
 */
export async function startScreening(
  projectId: string,
  zipFile: File,
  onExtractionProgress?: (current: number, total: number, fileName: string) => void
) {
  // Step 1: Convert PDFs to text in the browser
  const { convertPdfZipToTextZip } = await import('./pdf-extractor');
  const { textZip, fileCount } = await convertPdfZipToTextZip(zipFile, onExtractionProgress);

  if (fileCount === 0) {
    throw new Error('No readable resume files found in ZIP. Please upload PDFs or TXT files.');
  }

  // Step 2: Send text-only ZIP to API route → n8n
  const formData = new FormData();
  formData.append('projectId', projectId);
  formData.append('resumesZip', textZip, 'resumes.zip');

  const response = await fetch('/api/screen-resume', {
    method: 'POST',
    body: formData,
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
