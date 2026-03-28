import { Sidebar } from '@/components/layout/sidebar';
import { ProjectProvider } from '@/lib/project-context';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProjectProvider>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="ml-64 flex-1">
          {children}
        </main>
      </div>
    </ProjectProvider>
  );
}
