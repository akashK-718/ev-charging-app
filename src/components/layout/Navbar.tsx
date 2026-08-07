'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { clearExploreSession } from '@/lib/user-storage';
import { useAuth } from '@/hooks/useAuth';

const AUTH_PAGES = ['/login', '/verify-otp'];

const NAV_LINKS = [
  { href: '/home',     label: 'Home'    },
  { href: '/explore',  label: 'Explore' },
  { href: '/activity', label: 'Activity'},
  { href: '/profile',  label: 'Profile' },
] as const;

function isLinkActive(href: string, pathname: string) {
  if (href === '/home') return pathname === '/home';
  return pathname === href || pathname.startsWith(href + '/');
}

export function Navbar() {
  const pathname = usePathname();
  const { user, loading } = useAuth();

  const isAuthPage    = AUTH_PAGES.some(p => pathname === p) || pathname.startsWith('/welcome');
  const isLandingPage = pathname === '/';
  const isDesignPage  = pathname === '/design';

  if (isAuthPage || isLandingPage || isDesignPage) return null;

  async function handleSignOut() {
    clearExploreSession();
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  if (loading) {
    return (
      <header className="hidden lg:flex h-14 border-b border-border bg-surface-card sticky top-0 z-40 items-center px-6 gap-4">
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="w-20 h-6 rounded bg-surface-page animate-pulse" />
          ))}
        </div>
      </header>
    );
  }

  return (
    <header className="hidden lg:flex h-14 border-b border-border bg-surface-card sticky top-0 z-40 items-center px-6 gap-6">
      {/* ── Desktop only: nav links + avatar, no logo ── */}

        {user?.onboarded && (
          <nav className="flex items-center gap-0.5 h-full" aria-label="Main navigation">
            {NAV_LINKS.map(({ href, label }) => {
              const active = isLinkActive(href, pathname);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative flex items-center px-3 h-full text-sm font-semibold transition-colors',
                    active
                      ? 'text-green'
                      : 'text-muted hover:text-ink',
                  )}
                >
                  {label}
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-0 inset-x-3 h-[2px] rounded-t-sm bg-green"
                    />
                  )}
                </Link>
              );
            })}
          </nav>
        )}

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

        {!user && !loading && (
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
