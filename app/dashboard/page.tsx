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
    <div className="flex flex-col min-h-[calc(100vh-2rem)] px-4 py-4 sm:px-8 sm:py-5">

      {/* Row 1: Hero + CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-foreground" style={{ letterSpacing: '-0.03em' }}>
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
        <Button asChild size="lg" className="bg-electric-blue hover:bg-deep-blue text-base px-6 gap-2 shrink-0 w-full sm:w-auto">
          <Link href="/dashboard/project/create">
            <Plus className="h-5 w-5" />
            New Project
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      {/* Row 2: How It Works — 3 cards, fill remaining space */}
      <div className="flex-1 flex flex-col mb-4">
        <h2 className="font-display text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
          How It Works
        </h2>
        <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-3 flex-1">
          <Link href="/dashboard/project/create" className="group flex">
            <div className="rounded-xl border bg-card p-4 sm:p-5 transition-all group-hover:border-electric-blue/30 group-hover:shadow-md flex flex-col flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-electric-blue/10">
                  <Sparkles className="h-5 w-5 text-electric-blue" />
                </div>
                <h3 className="font-display text-base sm:text-lg font-bold text-foreground">Define Criteria</h3>
                <span className="ml-auto font-display text-3xl sm:text-4xl font-extrabold text-muted-foreground/20">1</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Paste the JD.<br />AI builds the rubric. Edit or Approve.
              </p>
              <div className="mt-auto pt-3 text-xs text-electric-blue font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                Get started <ArrowRight className="h-3 w-3" />
              </div>
            </div>
          </Link>
          <Link href="/dashboard/project/upload" className="group flex">
            <div className="rounded-xl border bg-card p-4 sm:p-5 transition-all group-hover:border-electric-blue/30 group-hover:shadow-md flex flex-col flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-electric-blue/10">
                  <Upload className="h-5 w-5 text-electric-blue" />
                </div>
                <h3 className="font-display text-base sm:text-lg font-bold text-foreground">Upload Resumes</h3>
                <span className="ml-auto font-display text-3xl sm:text-4xl font-extrabold text-muted-foreground/20">2</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Upload a ZIP file.<br />AI scores each resume.
              </p>
              <div className="mt-auto pt-3 text-xs text-electric-blue font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                Upload files <ArrowRight className="h-3 w-3" />
              </div>
            </div>
          </Link>
          <Link href="/dashboard/project/results" className="group flex">
            <div className="rounded-xl border bg-card p-4 sm:p-5 transition-all group-hover:border-electric-blue/30 group-hover:shadow-md flex flex-col flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-electric-blue/10">
                  <BarChart3 className="h-5 w-5 text-electric-blue" />
                </div>
                <h3 className="font-display text-base sm:text-lg font-bold text-foreground">Review & Shortlist</h3>
                <span className="ml-auto font-display text-3xl sm:text-4xl font-extrabold text-muted-foreground/20">3</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Ranked results with scores and reasoning.<br />Shortlist, hold or reject.
              </p>
              <div className="mt-auto pt-3 text-xs text-electric-blue font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                View results <ArrowRight className="h-3 w-3" />
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Row 3: Quick Stats + Past Projects */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-auto pt-4 border-t border-border/50">
        {/* Quick Stats */}
        <div>
          <h2 className="font-display text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
            Quick Stats
          </h2>
          <div className="flex items-center gap-4 sm:gap-5">
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
        </div>

        {/* Past Projects */}
        <div>
          <h2 className="font-display text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
            Past Projects
          </h2>
          <div className="flex items-center gap-3 overflow-x-auto">
            {recentProjects.length > 0 ? (
              <div className="flex items-center gap-3 sm:gap-4">
                {recentProjects.slice(0, 2).map((project) => {
                  const status = statusConfig[project.status] || statusConfig.draft;
                  return (
                    <div
                      key={project.id}
                      className={`flex items-center gap-2 text-sm shrink-0 ${
                        project.status === 'complete' ? 'cursor-pointer hover:opacity-70' : ''
                      }`}
                      onClick={() => handleViewProject(project)}
                    >
                      <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium truncate max-w-[100px] sm:max-w-[140px]">{project.project_name}</span>
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
            <Button variant="ghost" asChild size="sm" className="text-xs h-6 px-2 shrink-0">
              <Link href="/dashboard/projects">All →</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
