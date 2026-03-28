'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, FolderOpen, Users, ArrowRight, Sparkles, Upload, BarChart3, Calendar, TrendingUp } from 'lucide-react';
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
        // Fetch stats
        const { count: projectCount } = await supabase
          .from('projects')
          .select('*', { count: 'exact', head: true });

        const { count: candidateCount } = await supabase
          .from('candidates')
          .select('*', { count: 'exact', head: true });

        // Fetch avg top score across completed projects
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

        // Fetch recent projects (last 3)
        const { data: recent } = await supabase
          .from('projects')
          .select('id, project_name, role_name, status, created_at')
          .order('created_at', { ascending: false })
          .limit(1);

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
    <div className="p-6 max-w-5xl">
      {/* Hero — compact */}
      <div className="mb-5">
        <h1 className="font-display text-3xl font-extrabold text-foreground" style={{ letterSpacing: '-0.03em' }}>
          Find your{' '}
          <span className="underline decoration-electric-blue decoration-[3px] underline-offset-4">
            top candidates in minutes
          </span>
          , not days.
        </h1>
        <p className="mt-1 text-sm text-muted-foreground max-w-xl">
          AI screens every resume against your custom rubric — you decide who makes the cut.
        </p>
      </div>

      {/* CTA */}
      <Card className="mb-5 border-2 border-electric-blue/20 bg-gradient-to-br from-cloud-blue/40 to-white">
        <CardContent className="flex items-center justify-between p-5">
          <div>
            <h2 className="font-display text-xl font-bold text-foreground mb-0.5">Start a new screening</h2>
            <p className="text-sm text-muted-foreground">Paste a JD, upload resumes, get ranked candidates.</p>
          </div>
          <Button asChild size="lg" className="bg-electric-blue hover:bg-deep-blue text-base px-6 gap-2">
            <Link href="/dashboard/project/create">
              <Plus className="h-5 w-5" />
              New Project
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* How it works — compact + clickable */}
      <div className="mb-4">
        <h2 className="font-display text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
          How it works
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          <Link href="/dashboard/project/create" className="group">
            <div className="relative rounded-xl border bg-card p-5 transition-all group-hover:border-electric-blue/30 group-hover:shadow-sm h-full">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-electric-blue/10">
                  <Sparkles className="h-4 w-4 text-electric-blue" />
                </div>
                <h3 className="font-display font-bold text-foreground">Define criteria</h3>
                <span className="ml-auto font-display text-2xl font-extrabold text-muted-foreground/10">1</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Paste a JD. AI builds a weighted rubric. Edit or approve.
              </p>
            </div>
          </Link>
          <Link href="/dashboard/project/upload" className="group">
            <div className="relative rounded-xl border bg-card p-5 transition-all group-hover:border-electric-blue/30 group-hover:shadow-sm h-full">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-electric-blue/10">
                  <Upload className="h-4 w-4 text-electric-blue" />
                </div>
                <h3 className="font-display font-bold text-foreground">Upload resumes</h3>
                <span className="ml-auto font-display text-2xl font-extrabold text-muted-foreground/10">2</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Drop a ZIP of PDFs. Each one scored by Claude AI.
              </p>
            </div>
          </Link>
          <Link href="/dashboard/project/results" className="group">
            <div className="relative rounded-xl border bg-card p-5 transition-all group-hover:border-electric-blue/30 group-hover:shadow-sm h-full">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-electric-blue/10">
                  <BarChart3 className="h-4 w-4 text-electric-blue" />
                </div>
                <h3 className="font-display font-bold text-foreground">Review & shortlist</h3>
                <span className="ml-auto font-display text-2xl font-extrabold text-muted-foreground/10">3</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Ranked results with scores and reasoning. Shortlist, hold, or reject.
              </p>
            </div>
          </Link>
        </div>
      </div>

      {/* Bottom row: Recent Project + Stats — ultra compact */}
      <div className="flex items-center gap-3 rounded-xl border bg-card px-5 py-3">
        {/* Recent Project */}
        <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
        {recentProjects.length > 0 ? (
          <div
            className={`flex items-center gap-2 min-w-0 ${
              recentProjects[0].status === 'complete' ? 'cursor-pointer hover:opacity-80' : ''
            }`}
            onClick={() => recentProjects[0] && handleViewProject(recentProjects[0])}
          >
            <span className="text-sm font-medium truncate">{recentProjects[0].project_name}</span>
            <Badge variant="outline" className={`text-xs shrink-0 ${(statusConfig[recentProjects[0].status] || statusConfig.draft).className}`}>
              {(statusConfig[recentProjects[0].status] || statusConfig.draft).label}
            </Badge>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">No projects yet</span>
        )}
        <Button variant="ghost" asChild size="sm" className="text-xs h-6 px-2 ml-auto shrink-0">
          <Link href="/dashboard/projects">View All</Link>
        </Button>

        {/* Divider */}
        <div className="h-6 w-px bg-border shrink-0" />

        {/* Quick Stats inline */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-center">
            <span className="font-display text-sm font-bold">{stats.projects}</span>
            <span className="text-xs text-muted-foreground ml-1">projects</span>
          </div>
          <div className="text-center">
            <span className="font-display text-sm font-bold">{stats.candidates}</span>
            <span className="text-xs text-muted-foreground ml-1">screened</span>
          </div>
          <div className="text-center">
            <span className="font-display text-sm font-bold text-electric-blue">{stats.avgTopScore || '—'}</span>
            <span className="text-xs text-muted-foreground ml-1">avg top</span>
          </div>
        </div>
      </div>
    </div>
  );
}
