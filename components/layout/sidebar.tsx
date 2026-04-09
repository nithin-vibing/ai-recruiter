'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Plus, FolderOpen, CreditCard, User, LogOut } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/lib/auth-context';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/project/create', label: 'New Role', icon: Plus },
  { href: '/dashboard/projects', label: 'Past Roles', icon: FolderOpen },
  { href: '/dashboard/pricing', label: 'Pricing', icon: CreditCard },
];

function MugIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 640 640" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fill="#1B6FEE" d="M184 48C170.7 48 160 58.7 160 72C160 110.9 183.4 131.4 199.1 145.1L200.2 146.1C216.5 160.4 224 167.9 224 184C224 197.3 234.7 208 248 208C261.3 208 272 197.3 272 184C272 145.1 248.6 124.6 232.9 110.9L231.8 109.9C215.5 95.7 208 88.1 208 72C208 58.7 197.3 48 184 48zM128 256C110.3 256 96 270.3 96 288L96 480C96 533 139 576 192 576L384 576C425.8 576 461.4 549.3 474.5 512L480 512C550.7 512 608 454.7 608 384C608 313.3 550.7 256 480 256L128 256zM480 448L480 320C515.3 320 544 348.7 544 384C544 419.3 515.3 448 480 448zM320 72C320 58.7 309.3 48 296 48C282.7 48 272 58.7 272 72C272 110.9 295.4 131.4 311.1 145.1L312.2 146.1C328.5 160.4 336 167.9 336 184C336 197.3 346.7 208 360 208C373.3 208 384 197.3 384 184C384 145.1 360.6 124.6 344.9 110.9L343.8 109.9C327.5 95.7 320 88.1 320 72z"/>
    </svg>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const initials = displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarUrl = user?.user_metadata?.avatar_url;

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
        <MugIcon size={28} />
        <span className="font-display text-xl font-extrabold" style={{ letterSpacing: '-0.035em' }}>
          <span className="text-white">Shortlist</span>
          <span className="text-electric-blue">AI</span>
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          // Exact match for /dashboard to avoid highlighting on all sub-routes
          const isActive = item.href === '/dashboard'
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
            <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{displayName}</p>
            <p className="text-xs text-sidebar-foreground/60 truncate">{user?.email}</p>
          </div>
          <button
            onClick={signOut}
            className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-sidebar-accent/50 transition-colors shrink-0"
            title="Sign out"
          >
            <LogOut className="h-4 w-4 text-sidebar-foreground/60" />
          </button>
        </div>
      </div>
    </aside>
  );
}
