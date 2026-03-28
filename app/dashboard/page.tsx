'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, ArrowRight, FileText, Upload, Users, FolderOpen } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchCandidates } from '@/lib/api-client';
import { useProject } from '@/lib/project-context';

interface RecentProject {
  id: string;
  project_name: string;
  role_name: string;
  status: string;
  created_at: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-muted text-muted-foreground' },
  rubric_review: { label: 'Rubric Review', className: 'bg-warning/10 text-warning border-warning/20' },
  screening: { label: 'Screening', className: 'bg-electric-blue/10 text-electric-blue border-electric-blue/20' },
  complete: { label: 'Complete', className: 'bg-success/10 text-success border-success/20' },
};

export default function DashboardPage() {
  const router = useRouter();
  const { setCandidates, setProjectDetails, setCurrentStep } = useProject();
  const [stats, setStats] = useState({ projects: 0, candidates: 0, avgTopScore: 0 });
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const { count: projectCount } = await supabase
          .from('projects')
          .select('*', { count: 'exact', head: true });

        const { count: candidateCount } = await supabase
          .from('candidates')
          .select('*', { count: 'exact', head: true });

        const { data: completedProjects } = await supabase
          .from('projects')
          .select('id')
          .eq('status', 'complete');

        let avgTopScore = 0;
        if (completedProjects && completedProjects.length > 0) {
          const topScores = await Promise.all(
            completedProjects.map(async (p) => {
              const { data } = await supabase
                .from('candidates')
                .select('score')
                .eq('project_id', p.id)
                .order('score', { ascending: false })
                .limit(1);
              return data?.[0]?.score || 0;
            })
          );
          avgTopScore = Math.round(
            topScores.reduce((sum, s) => sum + Number(s), 0) / topScores.length * 10
          ) / 10;
        }

        setStats({
          projects: projectCount || 0,
          candidates: candidateCount || 0,
          avgTopScore,
        });

        const { data: recent } = await supabase
          .from('projects')
          .select('id, project_name, role_name, status, created_at')
          .order('created_at', { ascending: false })
          .limit(2);

        setRecentProjects(recent || []);
      } catch (error) {
        console.error('Failed to load dashboard:', error);
      }
    }

    loadDashboard();
  }, []);

  const handleViewProject = async (project: RecentProject) => {
    if (project.status !== 'complete') return;
    sessionStorage.setItem('currentProjectId', project.id);
    setProjectDetails({
      name: project.project_name,
      roleName: project.role_name,
      jobDescription: '',
    });
    const candidates = await fetchCandidates(project.id);
    setCandidates(candidates);
    setCurrentStep(3);
    router.push('/dashboard/project/results');
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div
      className="grid px-4 py-4 sm:px-10 sm:py-8"
      style={{
        gridTemplateRows: 'auto auto 1fr auto',
        minHeight: 'calc(100vh - 2rem)',
        gap: 0,
      }}
    >

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6 sm:mb-7">
        <div>
          <h1
            className="font-display text-2xl sm:text-[1.75rem] font-extrabold text-foreground leading-tight"
            style={{ letterSpacing: '-0.03em' }}
          >
            Find your{' '}
            <span className="underline decoration-electric-blue decoration-[3px] underline-offset-[5px]">
              top candidates in minutes
            </span>
            , not days.
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            AI screens every resume against your custom rubric — you decide who makes the cut.
          </p>
        </div>
        <Button
          asChild
          className="bg-electric-blue hover:bg-deep-blue text-sm font-semibold px-5 py-2.5 gap-1.5 shrink-0 w-full sm:w-auto shadow-[0_2px_12px_rgba(27,111,238,0.18)] hover:shadow-[0_4px_20px_rgba(27,111,238,0.35)] hover:-translate-y-px transition-all rounded-[9px]"
        >
          <Link href="/dashboard/project/create">
            <Plus className="h-4 w-4" />
            New Project
          </Link>
        </Button>
      </div>

      {/* ── How It Works ── */}
      <div className="mb-6 sm:mb-7">
        <h2 className="font-display text-[0.68rem] font-bold uppercase text-muted-foreground mb-3" style={{ letterSpacing: '0.12em' }}>
          How It Works
        </h2>
        <div className="grid gap-3.5 grid-cols-1 md:grid-cols-3">
          {/* Card 1 — Define Criteria (blue) */}
          <Link href="/dashboard/project/create" className="group">
            <div className="rounded-[14px] border-2 border-transparent bg-card p-5 sm:p-[22px_24px_20px] flex flex-col gap-2.5 transition-all duration-300 group-hover:-translate-y-[3px] group-hover:shadow-[0_8px_28px_rgba(0,0,0,0.07)] group-hover:border-electric-blue cursor-pointer overflow-hidden">
              <div className="flex items-center gap-2.5">
                <div className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] bg-electric-blue/10">
                  <FileText className="h-[18px] w-[18px] text-electric-blue" />
                </div>
                <h3 className="font-display text-base font-bold text-foreground" style={{ letterSpacing: '-0.01em' }}>Define Criteria</h3>
                <span className="ml-auto font-display text-[1.6rem] font-extrabold text-muted-foreground/[0.12] leading-none">1</span>
              </div>
              <p className="text-[0.82rem] text-muted-foreground leading-relaxed">
                Paste the JD.<br />AI builds the rubric. Edit or Approve.
              </p>
              <div className="mt-1 text-[0.78rem] font-semibold text-electric-blue flex items-center gap-1 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                Get started <ArrowRight className="h-[13px] w-[13px] transition-transform group-hover:translate-x-[3px]" />
              </div>
            </div>
          </Link>

          {/* Card 2 — Upload Resumes (green) */}
          <Link href="/dashboard/project/upload" className="group">
            <div className="rounded-[14px] border-2 border-transparent bg-card p-5 sm:p-[22px_24px_20px] flex flex-col gap-2.5 transition-all duration-300 group-hover:-translate-y-[3px] group-hover:shadow-[0_8px_28px_rgba(0,0,0,0.07)] group-hover:border-electric-blue cursor-pointer overflow-hidden">
              <div className="flex items-center gap-2.5">
                <div className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] bg-success/10">
                  <Upload className="h-[18px] w-[18px] text-success" />
                </div>
                <h3 className="font-display text-base font-bold text-foreground" style={{ letterSpacing: '-0.01em' }}>Upload Resumes</h3>
                <span className="ml-auto font-display text-[1.6rem] font-extrabold text-muted-foreground/[0.12] leading-none">2</span>
              </div>
              <p className="text-[0.82rem] text-muted-foreground leading-relaxed">
                Upload a ZIP file.<br />AI scores each resume.
              </p>
              <div className="mt-1 text-[0.78rem] font-semibold text-electric-blue flex items-center gap-1 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                Upload files <ArrowRight className="h-[13px] w-[13px] transition-transform group-hover:translate-x-[3px]" />
              </div>
            </div>
          </Link>

          {/* Card 3 — Review & Shortlist (amber) */}
          <Link href="/dashboard/project/results" className="group">
            <div className="rounded-[14px] border-2 border-transparent bg-card p-5 sm:p-[22px_24px_20px] flex flex-col gap-2.5 transition-all duration-300 group-hover:-translate-y-[3px] group-hover:shadow-[0_8px_28px_rgba(0,0,0,0.07)] group-hover:border-electric-blue cursor-pointer overflow-hidden">
              <div className="flex items-center gap-2.5">
                <div className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] bg-warning/10">
                  <Users className="h-[18px] w-[18px] text-warning" />
                </div>
                <h3 className="font-display text-base font-bold text-foreground" style={{ letterSpacing: '-0.01em' }}>Review & Shortlist</h3>
                <span className="ml-auto font-display text-[1.6rem] font-extrabold text-muted-foreground/[0.12] leading-none">3</span>
              </div>
              <p className="text-[0.82rem] text-muted-foreground leading-relaxed">
                Ranked results with scores and reasoning.<br />Shortlist, hold or reject.
              </p>
              <div className="mt-1 text-[0.78rem] font-semibold text-electric-blue flex items-center gap-1 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                View results <ArrowRight className="h-[13px] w-[13px] transition-transform group-hover:translate-x-[3px]" />
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* ── Spacer — pushes bottom section down ── */}
      <div />

      {/* ── Bottom: Quick Stats + Past Projects ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 self-end pt-5 border-t border-border">
        {/* Quick Stats */}
        <div className="flex flex-col gap-2">
          <h2 className="font-display text-[0.68rem] font-bold uppercase text-muted-foreground" style={{ letterSpacing: '0.12em' }}>
            Quick Stats
          </h2>
          <div className="flex items-baseline gap-5">
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-xl font-bold text-foreground">{stats.projects}</span>
              <span className="text-[0.78rem] text-muted-foreground">projects</span>
            </div>
            <div className="w-px h-[18px] bg-border self-center" />
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-xl font-bold text-foreground">{stats.candidates}</span>
              <span className="text-[0.78rem] text-muted-foreground">screened</span>
            </div>
            <div className="w-px h-[18px] bg-border self-center" />
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-xl font-bold text-electric-blue">{stats.avgTopScore || '—'}</span>
              <span className="text-[0.78rem] text-muted-foreground">avg top score</span>
            </div>
          </div>
        </div>

        {/* Past Projects */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-[0.68rem] font-bold uppercase text-muted-foreground" style={{ letterSpacing: '0.12em' }}>
              Past Projects
            </h2>
            <Link href="/dashboard/projects" className="text-[0.78rem] font-semibold text-electric-blue hover:opacity-70 transition-opacity">
              All →
            </Link>
          </div>
          <div className="flex items-center gap-2.5 overflow-x-auto">
            {recentProjects.length > 0 ? (
              recentProjects.slice(0, 2).map((project) => {
                const status = statusConfig[project.status] || statusConfig.draft;
                return (
                  <div
                    key={project.id}
                    className={`flex items-center gap-2 px-3.5 py-2 bg-card border border-border rounded-[9px] transition-all shrink-0 ${
                      project.status === 'complete'
                        ? 'cursor-pointer hover:border-electric-blue hover:shadow-[0_2px_10px_rgba(27,111,238,0.08)]'
                        : ''
                    }`}
                    onClick={() => handleViewProject(project)}
                  >
                    <span className="text-[0.82rem] font-medium text-foreground">{project.project_name}</span>
                    <Badge variant="outline" className={`text-[0.68rem] font-semibold px-2 py-0.5 rounded-[5px] border-0 ${status.className}`}>
                      {status.label}
                    </Badge>
                  </div>
                );
              })
            ) : (
              <span className="text-xs text-muted-foreground">No projects yet</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
