'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, FolderOpen, Users, ArrowRight, Sparkles, Upload, BarChart3 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function DashboardPage() {
  const [stats, setStats] = useState({ projects: 0, candidates: 0 });

  useEffect(() => {
    async function loadStats() {
      try {
        const { count: projectCount } = await supabase
          .from('projects')
          .select('*', { count: 'exact', head: true });

        const { count: candidateCount } = await supabase
          .from('candidates')
          .select('*', { count: 'exact', head: true });

        setStats({
          projects: projectCount || 0,
          candidates: candidateCount || 0,
        });
      } catch (error) {
        console.error('Failed to load stats:', error);
      }
    }

    loadStats();
  }, []);

  return (
    <div className="p-8 max-w-5xl">
      {/* Hero */}
      <div className="mb-10">
        <h1 className="font-display text-4xl font-extrabold text-foreground" style={{ letterSpacing: '-0.03em' }}>
          Welcome to <span className="text-electric-blue">AI Recruiter</span>
        </h1>
        <p className="mt-2 text-lg text-muted-foreground max-w-xl">
          Screen hundreds of resumes in minutes. AI scores every candidate against your custom rubric — you decide who makes the cut.
        </p>
      </div>

      {/* CTA */}
      <Card className="mb-10 border-2 border-electric-blue/20 bg-gradient-to-br from-cloud-blue/40 to-white">
        <CardContent className="flex items-center justify-between p-8">
          <div>
            <h2 className="font-display text-2xl font-bold text-foreground mb-1">Start a new screening</h2>
            <p className="text-muted-foreground">Paste a JD, upload resumes, get ranked candidates.</p>
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

      {/* How it works */}
      <div className="mb-10">
        <h2 className="font-display text-sm font-bold uppercase tracking-widest text-muted-foreground mb-6">
          How it works
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          <div className="relative rounded-xl border bg-card p-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-electric-blue/10 mb-4">
              <Sparkles className="h-5 w-5 text-electric-blue" />
            </div>
            <div className="absolute top-6 right-6 font-display text-4xl font-extrabold text-muted-foreground/10">1</div>
            <h3 className="font-display font-bold text-foreground mb-1">Define criteria</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Paste the job description. AI generates a weighted scoring rubric. Edit weights, add criteria, or approve as-is.
            </p>
          </div>
          <div className="relative rounded-xl border bg-card p-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-electric-blue/10 mb-4">
              <Upload className="h-5 w-5 text-electric-blue" />
            </div>
            <div className="absolute top-6 right-6 font-display text-4xl font-extrabold text-muted-foreground/10">2</div>
            <h3 className="font-display font-bold text-foreground mb-1">Upload resumes</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Drop a ZIP of resumes. Each one is scored against your rubric by Claude AI — name, email, score, and reasoning extracted.
            </p>
          </div>
          <div className="relative rounded-xl border bg-card p-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-electric-blue/10 mb-4">
              <BarChart3 className="h-5 w-5 text-electric-blue" />
            </div>
            <div className="absolute top-6 right-6 font-display text-4xl font-extrabold text-muted-foreground/10">3</div>
            <h3 className="font-display font-bold text-foreground mb-1">Review & shortlist</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              See ranked results. Shortlist, hold, or reject. Add notes. Export your top candidates to CSV.
            </p>
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="hover:border-electric-blue/30 transition-colors">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
              Past Projects
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">View previous screenings, rubrics, and candidate results.</p>
            <Button variant="outline" asChild size="sm">
              <Link href="/dashboard/projects">View All</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:border-electric-blue/30 transition-colors">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-muted-foreground" />
              Quick Stats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Projects created</span>
                <span className="font-medium font-display">{stats.projects}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Candidates screened</span>
                <span className="font-medium font-display">{stats.candidates}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
