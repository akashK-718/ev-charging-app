'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
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
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  if (loading) {
    return (
      <header className="h-14 border-b border-border bg-surface-card sticky top-0 z-40">
        <div className="hidden lg:flex items-center h-full px-6 gap-4">
          <Logo />
          <div className="flex items-center gap-2 ml-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="w-20 h-6 rounded bg-surface-page animate-pulse" />
            ))}
          </div>
        </div>
        {/* Mobile: just logo */}
        <div className="flex items-center justify-center h-full px-4 lg:hidden">
          <Logo />
        </div>
      </header>
    );
  }

  return (
    <header className="h-14 border-b border-border bg-surface-card sticky top-0 z-40">
      {/* ── Mobile: logo centred, no hamburger (BottomNav handles navigation) ── */}
      <div className="flex items-center justify-center h-full px-4 lg:hidden">
        <Logo />
      </div>

      {/* ── Desktop: logo + 5 links + sign-out + avatar ─────────────────────── */}
      <div className="hidden lg:flex items-center h-full px-6 gap-6">
        <Logo />

        {user && (
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

        {user && (
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
              href="/login"
              className="px-4 py-2 rounded-token text-sm font-semibold bg-green text-white hover:bg-green-deep transition-colors"
            >
              Log in
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}

function Logo() {
  return (
    <Link href="/home" className="flex items-center shrink-0" aria-label="Kirin">
      <img src="/brand/kirin-icon.svg" alt="Kirin" className="h-7 w-auto" />
    </Link>
  );
}
