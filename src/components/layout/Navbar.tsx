'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LogOut, Home, Map, ActivityIcon, User } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { createClient } from '@/lib/supabase/client';
import { clearExploreSession } from '@/lib/user-storage';
import { useAuth } from '@/hooks/useAuth';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/haptics';

const HIDDEN_ROUTES = ['/', '/login', '/verify-otp', '/auth', '/design'];

const TABS = [
  { href: '/home',     Icon: Home,         label: 'Home'    },
  { href: '/explore',  Icon: Map,          label: 'Explore' },
  { href: '/activity', Icon: ActivityIcon, label: 'Activity'},
  { href: '/profile',  Icon: User,         label: 'Profile' },
] as const;

function isTabActive(href: string, pathname: string) {
  if (href === '/home') return pathname === '/home';
  return pathname === href || pathname.startsWith(href + '/') || pathname.startsWith(href + '?');
}

/**
 * Top navigation bar visible at tablet and desktop (≥ 768px). The four nav
 * tabs sit centered in the bar; sign-out and profile avatar sit on the right.
 * The left region is intentionally empty — no logo or wordmark, consistent
 * with the in-app branding-removal rule. Hidden on landing, auth, and design pages.
 *
 * Navigation axis: tablet + desktop share this bar (threshold: 768px / md:).
 * Content-composition axis is independent and governed by desk: (1200px).
 */
export function Navbar() {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false)
      .then(({ count }) => setUnreadCount(count ?? 0));
  }, [user]);

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
      <header className="hidden md:flex h-14 border-b border-border bg-surface-card sticky top-0 z-40 items-center px-6">
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          {TABS.map(t => (
            <div key={t.href} className="w-20 h-8 rounded-token-sm bg-surface-page animate-pulse" />
          ))}
        </div>
        <div className="flex-1 flex justify-end">
          <div className="w-8 h-8 rounded-full bg-surface-page animate-pulse" />
        </div>
      </header>
    );
  }

  return (
    <header className="hidden md:flex h-14 border-b border-border bg-surface-card sticky top-0 z-40 items-center px-6">
      {/* Left: intentionally empty — no wordmark; reserved for a future utility element */}
      <div className="flex-1" />

      {/* Center: four nav tabs */}
      {user?.onboarded && (
        <nav className="flex items-center gap-1" aria-label="Main navigation">
          {TABS.map(({ href, Icon, label }) => {
            const active = isTabActive(href, pathname);
            const showBadge = href === '/activity' && unreadCount > 0;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                onClick={() => haptic('light')}
                className={cn(
                  'relative flex items-center gap-2 px-3 py-2 rounded-token-sm',
                  'text-sm font-semibold tap-light transition-colors',
                  active
                    ? 'text-green'
                    : 'text-muted hover:text-ink hover:bg-surface-page',
                )}
              >
                {/* Bottom accent bar — mirrors BottomNav's top accent bar */}
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 left-1/4 right-1/4 h-[2px] rounded-t-sm bg-green"
                  />
                )}
                <span className="relative shrink-0">
                  <Icon
                    className="w-[18px] h-[18px]"
                    strokeWidth={active ? 2.2 : 1.8}
                    aria-hidden
                  />
                  {showBadge && (
                    <span
                      aria-label={`${unreadCount} unread`}
                      className="absolute -top-1 -right-1.5 min-w-[14px] h-[14px] rounded-pill bg-green text-white text-[9px] font-bold leading-[14px] text-center px-0.5"
                    >
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </span>
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      )}

      {/* Right: sign-out + avatar (preserved exactly from previous Navbar) */}
      <div className="flex-1 flex justify-end">
        {user?.onboarded && (
          <div className="flex items-center gap-1">
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
          <Link
            href="/auth"
            className="px-4 py-2 rounded-token text-sm font-semibold bg-green text-white hover:bg-green-deep transition-colors"
          >
            Log in
          </Link>
        )}
      </div>
    </header>
  );
}
