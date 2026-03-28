'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, ArrowRight, Sparkles, Upload, BarChart3, FolderOpen, Calendar } from 'lucide-react';
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
          .limit(3);

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
    <div className="flex flex-col h-[calc(100vh-2rem)] px-8 py-5">

      {/* Row 1: Hero + CTA — single row */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-foreground" style={{ letterSpacing: '-0.03em' }}>
            Find your{' '}
            <span className="underline decoration-electric-blue decoration-[3px] underline-offset-4">
              top candidates in minutes
            </span>
            , not days.
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AI screens every resume against your custom rubric — you decide who makes the cut.
          </p>
        </div>
        <Button asChild size="lg" className="bg-electric-blue hover:bg-deep-blue text-base px-6 gap-2 shrink-0">
          <Link href="/dashboard/project/create">
            <Plus className="h-5 w-5" />
            New Project
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      {/* Row 2: How It Works — 3 cards, takes most space */}
      <div className="flex-1 mb-4">
        <h2 className="font-display text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
          How It Works
        </h2>
        <div className="grid gap-5 md:grid-cols-3 h-[calc(100%-2rem)]">
          <Link href="/dashboard/project/create" className="group">
            <div className="rounded-xl border bg-card p-6 transition-all group-hover:border-electric-blue/30 group-hover:shadow-md h-full flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-electric-blue/10">
                  <Sparkles className="h-5 w-5 text-electric-blue" />
                </div>
                <h3 className="font-display text-lg font-bold text-foreground">Define Criteria</h3>
                <span className="ml-auto font-display text-4xl font-extrabold text-muted-foreground/8">1</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                Paste a JD. AI builds a weighted rubric. Edit or approve.
              </p>
              <div className="mt-4 text-xs text-electric-blue font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                Get started <ArrowRight className="h-3 w-3" />
              </div>
            </div>
          </Link>
          <Link href="/dashboard/project/upload" className="group">
            <div className="rounded-xl border bg-card p-6 transition-all group-hover:border-electric-blue/30 group-hover:shadow-md h-full flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-electric-blue/10">
                  <Upload className="h-5 w-5 text-electric-blue" />
                </div>
                <h3 className="font-display text-lg font-bold text-foreground">Upload Resumes</h3>
                <span className="ml-auto font-display text-4xl font-extrabold text-muted-foreground/8">2</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                Drop a ZIP of PDFs. Each one scored by Claude AI.
              </p>
              <div className="mt-4 text-xs text-electric-blue font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                Upload files <ArrowRight className="h-3 w-3" />
              </div>
            </div>
          </Link>
          <Link href="/dashboard/project/results" className="group">
            <div className="rounded-xl border bg-card p-6 transition-all group-hover:border-electric-blue/30 group-hover:shadow-md h-full flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-electric-blue/10">
                  <BarChart3 className="h-5 w-5 text-electric-blue" />
                </div>
                <h3 className="font-display text-lg font-bold text-foreground">Review & Shortlist</h3>
                <span className="ml-auto font-display text-4xl font-extrabold text-muted-foreground/8">3</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                Ranked results with scores and reasoning. Shortlist, hold, or reject.
              </p>
              <div className="mt-4 text-xs text-electric-blue font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                View results <ArrowRight className="h-3 w-3" />
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Row 3: Stats bar + Recent projects — compact footer */}
      <div className="flex items-center gap-6 py-3 border-t border-border/50">
        {/* Stats */}
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-1.5">
            <span className="font-display text-lg font-bold text-foreground">{stats.projects}</span>
            <span className="text-xs text-muted-foreground">projects</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-1.5">
            <span className="font-display text-lg font-bold text-foreground">{stats.candidates}</span>
            <span className="text-xs text-muted-foreground">screened</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-1.5">
            <span className="font-display text-lg font-bold text-electric-blue">{stats.avgTopScore || '—'}</span>
            <span className="text-xs text-muted-foreground">avg top score</span>
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Recent Projects */}
        <div className="flex items-center gap-3">
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          {recentProjects.length > 0 ? (
            <div className="flex items-center gap-4">
              {recentProjects.slice(0, 2).map((project) => {
                const status = statusConfig[project.status] || statusConfig.draft;
                return (
                  <div
                    key={project.id}
                    className={`flex items-center gap-2 text-sm ${
                      project.status === 'complete' ? 'cursor-pointer hover:opacity-70' : ''
                    }`}
                    onClick={() => handleViewProject(project)}
                  >
                    <span className="font-medium truncate max-w-[120px]">{project.project_name}</span>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${status.className}`}>
                      {status.label}
                    </Badge>
                  </div>
                );
              })}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">No projects yet</span>
          )}
          <Button variant="ghost" asChild size="sm" className="text-xs h-6 px-2">
            <Link href="/dashboard/projects">All →</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
