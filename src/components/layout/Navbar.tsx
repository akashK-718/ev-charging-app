'use client';

import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { createClient } from '@/lib/supabase/client';
import { clearExploreSession } from '@/lib/user-storage';
import { useAuth } from '@/hooks/useAuth';
import { usePathname } from 'next/navigation';

const HIDDEN_ROUTES = ['/', '/login', '/verify-otp', '/design'];

/**
 * Slim utility bar visible only at desktop (≥ 1200px). Navigation is handled
 * by DesktopSidebar — this bar provides sign-out and profile access only.
 * Hidden on landing, auth, and design pages. No logo — consistent with the
 * in-app branding-removal rule.
 */
export function Navbar() {
  const pathname = usePathname();
  const { user, loading } = useAuth();

  const suppress =
    HIDDEN_ROUTES.includes(pathname) ||
    pathname.startsWith('/welcome');

  if (suppress) return null;

  async function handleSignOut() {
    clearExploreSession();
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  if (loading) {
    return (
      <header className="hidden desk:flex h-14 border-b border-border bg-surface-card sticky top-0 z-40 items-center px-6">
        <div className="ml-auto w-8 h-8 rounded-full bg-surface-page animate-pulse" />
      </header>
    );
  }

  return (
    <header className="hidden desk:flex h-14 border-b border-border bg-surface-card sticky top-0 z-40 items-center px-6">
      {user?.onboarded && (
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={handleSignOut}
            className="p-2 rounded-token text-muted hover:text-ink hover:bg-surface-page transition-colors"
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
          <Link href="/profile" className="ml-1" aria-label="Your profile">
            <Avatar avatarUrl={null} name={user.name} size="sm" />
          </Link>
        </div>
      )}

      {!user && (
        <div className="ml-auto">
          <Link
            href="/auth"
            className="px-4 py-2 rounded-token text-sm font-semibold bg-green text-white hover:bg-green-deep transition-colors"
          >
            Log in
          </Link>
        </div>
      )}
    </header>
  );
}
