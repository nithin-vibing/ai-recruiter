'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty';
import { Plus, FolderOpen, Users, Calendar, ArrowRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchProjects, fetchCandidates } from '@/lib/api-client';
import { supabase } from '@/lib/supabase';
import { useProject } from '@/lib/project-context';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';

interface ProjectWithCounts {
  id: string;
  project_name: string;
  role_name: string;
  status: string;
  created_at: string;
  candidateCount: number;
  topScore: number;
  shortlistedCount: number;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-muted text-muted-foreground' },
  rubric_review: { label: 'Rubric Review', className: 'bg-warning/10 text-warning border-warning/20' },
  screening: { label: 'Screening', className: 'bg-electric-blue/10 text-electric-blue border-electric-blue/20' },
  complete: { label: 'Complete', className: 'bg-success/10 text-success border-success/20' },
};

export default function ProjectsPage() {
  const router = useRouter();
  const { setCandidates, setProjectDetails, setCurrentStep } = useProject();
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProjectId, setLoadingProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    async function loadProjects() {
      try {
        const rawProjects = await fetchProjects(user!.id);

        // Single query for all candidates across all projects — avoids N+1
        const projectIds = rawProjects.map((p: Record<string, unknown>) => p.id as string);
        const { data: allCandidates } = projectIds.length > 0
          ? await supabase
              .from('candidates')
              .select('project_id, score, status')
              .in('project_id', projectIds)
          : { data: [] };

        // Group candidate data by project in JS — O(n) not O(n * 3 queries)
        const candidatesByProject = (allCandidates || []).reduce<
          Record<string, { scores: number[]; shortlisted: number }>
        >((acc, c) => {
          if (!acc[c.project_id]) acc[c.project_id] = { scores: [], shortlisted: 0 };
          acc[c.project_id].scores.push(Number(c.score));
          if (c.status === 'shortlisted') acc[c.project_id].shortlisted++;
          return acc;
        }, {});

        const projectsWithCounts = rawProjects.map((p: Record<string, unknown>) => {
          const data = candidatesByProject[p.id as string] ?? { scores: [], shortlisted: 0 };
          const topScore = data.scores.length > 0 ? Math.max(...data.scores) : 0;
          return {
            id: p.id as string,
            project_name: p.project_name as string,
            role_name: p.role_name as string,
            status: p.status as string,
            created_at: p.created_at as string,
            candidateCount: data.scores.length,
            topScore,
            shortlistedCount: data.shortlisted,
          };
        });

        setProjects(projectsWithCounts);
      } catch (error) {
        console.error('Failed to load projects:', error);
        toast.error('Failed to load projects. Please refresh and try again.');
      } finally {
        setLoading(false);
      }
    }

    loadProjects();
  }, [user]);

  const handleViewResults = async (project: ProjectWithCounts) => {
    setLoadingProjectId(project.id);
    try {
      localStorage.setItem('currentProjectId', project.id);
      setProjectDetails({
        name: project.project_name,
        roleName: project.role_name,
        jobDescription: '',
      });
      const candidates = await fetchCandidates(project.id);
      setCandidates(candidates);
      setCurrentStep(3);
      router.push('/dashboard/project/results');
    } catch (error) {
      console.error('Failed to load project:', error);
      toast.error('Failed to load project results. Please try again.');
      setLoadingProjectId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Past Roles
          </h1>
          <p className="mt-1 text-muted-foreground">
            View and manage your previous recruitment evaluations
          </p>
        </div>
        <Button asChild className="bg-electric-blue hover:bg-deep-blue">
          <Link href="/dashboard/project/create">
            <Plus className="h-4 w-4" />
            New Role
          </Link>
        </Button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-electric-blue" />
        </div>
      )}

      {/* Empty State */}
      {!loading && projects.length === 0 && (
        <Card>
          <CardContent className="py-16">
            <Empty>
              <FolderOpen className="h-12 w-12 text-muted-foreground/50" />
              <EmptyTitle>No roles yet</EmptyTitle>
              <EmptyDescription>
                Create your first role to start evaluating candidates with AI
              </EmptyDescription>
              <Button asChild className="mt-4 bg-electric-blue hover:bg-deep-blue">
                <Link href="/dashboard/project/create">
                  <Plus className="h-4 w-4" />
                  Create Role
                </Link>
              </Button>
            </Empty>
          </CardContent>
        </Card>
      )}

      {/* Project Cards */}
      {!loading && projects.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const status = statusConfig[project.status] || statusConfig.draft;
            return (
              <Card
                key={project.id}
                className={cn(
                  'group transition-all',
                  project.status === 'complete'
                    ? 'cursor-pointer hover:border-electric-blue/30 hover:shadow-md'
                    : 'cursor-default opacity-80',
                  loadingProjectId === project.id && 'border-electric-blue/50 shadow-md'
                )}
                onClick={() => {
                  if (project.status === 'complete' && !loadingProjectId) {
                    handleViewResults(project);
                  }
                }}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <Badge variant="outline" className={status.className}>
                      {status.label}
                    </Badge>
                    {project.status === 'complete' && (
                      loadingProjectId === project.id
                        ? <Loader2 className="h-4 w-4 text-electric-blue animate-spin" />
                        : <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>

                  <h3 className="font-display text-lg font-bold text-foreground mb-1 line-clamp-1">
                    {project.project_name}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {project.role_name}
                  </p>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDate(project.created_at)}
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {project.candidateCount} candidates
                    </div>
                  </div>

                  {project.status === 'complete' && project.candidateCount > 0 && (
                    <div className="mt-4 pt-4 border-t flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Top score: <span className="font-semibold text-success">{project.topScore}</span>
                      </span>
                      {project.shortlistedCount > 0 && (
                        <span className="text-success">
                          {project.shortlistedCount} shortlisted
                        </span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
