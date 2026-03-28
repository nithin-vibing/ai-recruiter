import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty';
import { Plus, FolderOpen } from 'lucide-react';

export default function ProjectsPage() {
  // In a real app, this would fetch from Supabase
  const projects: unknown[] = [];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Past Projects
          </h1>
          <p className="mt-1 text-muted-foreground">
            View and manage your previous recruitment evaluations
          </p>
        </div>
        <Button asChild className="bg-electric-blue hover:bg-deep-blue">
          <Link href="/dashboard/project/create">
            <Plus className="h-4 w-4" />
            New Project
          </Link>
        </Button>
      </div>

      {/* Content */}
      {projects.length === 0 ? (
        <Card>
          <CardContent className="py-16">
            <Empty>
              <FolderOpen className="h-12 w-12 text-muted-foreground/50" />
              <EmptyTitle>No projects yet</EmptyTitle>
              <EmptyDescription>
                Create your first project to start evaluating candidates with AI
              </EmptyDescription>
              <Button asChild className="mt-4 bg-electric-blue hover:bg-deep-blue">
                <Link href="/dashboard/project/create">
                  <Plus className="h-4 w-4" />
                  Create Project
                </Link>
              </Button>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Project cards would go here */}
        </div>
      )}
    </div>
  );
}
