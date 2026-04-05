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
  const { textZip, fileCount, originalFiles } = await convertPdfZipToTextZip(zipFile, onExtractionProgress);

  if (fileCount === 0) {
    throw new Error('No readable resume files found in ZIP. Please upload PDFs or TXT files.');
  }

  // Step 2: Upload original files to Supabase Storage (non-blocking)
  uploadResumesToStorage(projectId, originalFiles).catch((err) => {
    console.warn('Failed to upload resumes to storage (non-critical):', err);
  });

  // Step 3: Send text-only ZIP to API route → n8n
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

// ─── Screen 2: Upload Resumes to Supabase Storage ────────────────────────────

/**
 * Upload original resume files to Supabase Storage for later viewing.
 * Files are stored as resumes/{projectId}/{filename}
 */
async function uploadResumesToStorage(projectId: string, files: Map<string, Blob>) {
  const uploads = Array.from(files.entries()).map(async ([filename, blob]) => {
    const path = `${projectId}/${filename}`;
    const contentType = filename.toLowerCase().endsWith('.pdf')
      ? 'application/pdf'
      : 'text/plain';
    const { error } = await supabase.storage
      .from('resumes')
      .upload(path, blob, { upsert: true, contentType });
    if (error) {
      console.warn(`Failed to upload ${filename}:`, error.message);
    }
  });
  await Promise.all(uploads);
}

/**
 * Get a public URL for a resume file in Supabase Storage.
 */
export function getResumeUrl(projectId: string, filename: string): string {
  const { data } = supabase.storage
    .from('resumes')
    .getPublicUrl(`${projectId}/${filename}`);
  return data.publicUrl;
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
  return (data || []).map((row, index) => {
    // Build resume URL from source_filename if available
    let resumeUrl: string | undefined;
    if (row.source_filename) {
      // source_filename is the .txt name; try .pdf version first
      const pdfName = row.source_filename.replace(/\.txt$/i, '.pdf');
      resumeUrl = getResumeUrl(row.project_id, pdfName);
    }

    return {
      id: row.id,
      projectId: row.project_id,
      rank: index + 1,
      name: row.candidate_name || 'Unknown',
      email: row.email || '',
      phone: row.phone || '',
      linkedIn: row.linkedin || '',
      totalScore: Number(row.score) || 0,
      scores: (row.criteria_scores || []).map((cs: { criterion: string; score: number; max_score: number; weight: number; evidence: string }) => ({
        criterionId: cs.criterion,
        criterionName: cs.criterion,
        score: cs.score,
        maxScore: cs.max_score,
        weight: cs.weight,
        evidence: cs.evidence || '',
      })),
      reasoning: row.reasoning || '',
      confidence: row.confidence || undefined,
      status: row.status || 'pending',
      comments: row.user_comment || '',
      resumeUrl,
    };
  });
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

// ─── User Scoping ────────────────────────────────────────────────────────────

/**
 * Claim a project for the current user.
 * Called after n8n creates the project (with anon key, so user_id is null).
 * This sets user_id to the logged-in user's ID.
 */
export async function claimProject(projectId: string, userId: string) {
  const { error } = await supabase
    .from('projects')
    .update({ user_id: userId })
    .eq('id', projectId);

  if (error) throw new Error(`Failed to claim project: ${error.message}`);
}

// ─── Usage Tracking & Free Tier Limits ──────────────────────────────────────

const FREE_TIER_LIMITS = {
  maxProjects: 12,
  maxResumes: 100,
};

/**
 * Get the current month string in YYYY-MM format.
 */
function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Get or create the usage record for a user in the current month.
 */
export async function getUsage(userId: string) {
  const month = getCurrentMonth();

  // Try to fetch existing usage row
  const { data, error } = await supabase
    .from('usage')
    .select('*')
    .eq('user_id', userId)
    .eq('month', month)
    .single();

  if (data) return data;

  // No row yet — create one
  if (error?.code === 'PGRST116') {
    const { data: newRow, error: insertError } = await supabase
      .from('usage')
      .insert({ user_id: userId, month, projects_created: 0, resumes_screened: 0 })
      .select()
      .single();

    if (insertError) throw new Error(`Failed to create usage record: ${insertError.message}`);
    return newRow;
  }

  throw new Error(`Failed to fetch usage: ${error?.message}`);
}

/**
 * Check if the user can create a new project (under free tier limit).
 */
export async function canCreateProject(userId: string): Promise<{ allowed: boolean; current: number; limit: number }> {
  const usage = await getUsage(userId);
  return {
    allowed: usage.projects_created < FREE_TIER_LIMITS.maxProjects,
    current: usage.projects_created,
    limit: FREE_TIER_LIMITS.maxProjects,
  };
}

/**
 * Check if the user can screen more resumes (under free tier limit).
 * resumeCount = number of resumes in the current upload.
 */
export async function canScreenResumes(userId: string, resumeCount: number): Promise<{ allowed: boolean; current: number; limit: number; remaining: number }> {
  const usage = await getUsage(userId);
  const remaining = FREE_TIER_LIMITS.maxResumes - usage.resumes_screened;
  return {
    allowed: usage.resumes_screened + resumeCount <= FREE_TIER_LIMITS.maxResumes,
    current: usage.resumes_screened,
    limit: FREE_TIER_LIMITS.maxResumes,
    remaining: Math.max(0, remaining),
  };
}

/**
 * Increment project count for the current month.
 */
export async function incrementProjectCount(userId: string) {
  const usage = await getUsage(userId);
  const { error } = await supabase
    .from('usage')
    .update({
      projects_created: usage.projects_created + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', usage.id);

  if (error) throw new Error(`Failed to increment project count: ${error.message}`);
}

/**
 * Increment resume count for the current month.
 */
export async function incrementResumeCount(userId: string, count: number) {
  const usage = await getUsage(userId);
  const { error } = await supabase
    .from('usage')
    .update({
      resumes_screened: usage.resumes_screened + count,
      updated_at: new Date().toISOString(),
    })
    .eq('id', usage.id);

  if (error) throw new Error(`Failed to increment resume count: ${error.message}`);
}

// ─── Data Flywheel: Override Tracking ────────────────────────────────────────

/**
 * Log a recruiter override — fired whenever a candidate status changes.
 * Captures AI score + rank at the time of override so we can measure
 * where human judgment diverges from AI ranking.
 * Non-critical: errors are swallowed to never block the main flow.
 */
export async function logCandidateOverride(
  candidateId: string,
  projectId: string,
  previousStatus: string,
  newStatus: string,
  aiScore: number,
  aiRank: number
) {
  const { error } = await supabase
    .from('candidate_overrides')
    .insert({
      candidate_id: candidateId,
      project_id: projectId,
      ai_score: aiScore,
      ai_rank: aiRank,
      previous_status: previousStatus,
      new_status: newStatus,
    });

  if (error) {
    console.warn('Failed to log override (non-critical):', error.message);
  }
}

// ─── Dashboard: Fetch Projects ───────────────────────────────────────────────

/**
 * Fetch all projects for the dashboard.
 * userId is required — never return data across all users.
 */
export async function fetchProjects(userId: string) {
  if (!userId) throw new Error('fetchProjects requires a userId');

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
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

/**
 * Fetch rubric and map to RubricCriterion[] for the editor.
 * Uses Supabase row IDs so edits can be saved back by ID.
 */
export async function fetchRubricCriteria(projectId: string): Promise<import('./types').RubricCriterion[]> {
  const rows = await fetchRubric(projectId);
  const criteria = rows.map(row => ({
    id: row.id,
    name: row.criterion,
    description: row.description,
    maxScore: row.max_score || 10,
    weight: row.weight || 0.2,
  }));

  // Normalize weights so they always sum to exactly 1.0
  const total = criteria.reduce((sum, c) => sum + c.weight, 0);
  if (total > 0 && Math.abs(total - 1.0) > 0.001) {
    criteria.forEach(c => { c.weight = parseFloat((c.weight / total).toFixed(4)); });
    // Fix any rounding remainder on the last item
    const newTotal = criteria.reduce((sum, c) => sum + c.weight, 0);
    criteria[criteria.length - 1].weight = parseFloat((criteria[criteria.length - 1].weight + (1.0 - newTotal)).toFixed(4));
  }

  return criteria;
}

/**
 * Re-score all candidates for a project using an updated rubric.
 * Saves new rubric weights to Supabase, then calls Claude for each candidate.
 */
export async function rescoreProject(projectId: string, rubric: import('./types').RubricCriterion[]) {
  const response = await fetch('/api/rescore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, rubric }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to rescore candidates');
  return data;
}
