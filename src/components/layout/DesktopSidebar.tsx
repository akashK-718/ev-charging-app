'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Map, ActivityIcon, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/haptics';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';

const SUPPRESSED: string[] = ['/login', '/verify-otp', '/', '/design'];

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
 * Persistent left sidebar for desktop (≥ 1200px). Mirrors the same four
 * destinations as BottomNav — nothing added, nothing removed. Hidden at all
 * viewports below the 'desk' breakpoint via CSS; no JS-driven layout switching.
 *
 * Active indicator: a 2px left accent bar, the vertical counterpart of
 * BottomNav's 2px top accent bar. Same green color, same proportional inset.
 */
export function DesktopSidebar() {
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

  if (
    loading ||
    !user ||
    !user.onboarded ||
    SUPPRESSED.includes(pathname) ||
    pathname.startsWith('/welcome')
  ) return null;

  return (
    <aside
      className="hidden desk:flex flex-col fixed left-0 top-14 bottom-0 w-60 z-40 bg-surface-card border-r border-border overflow-y-auto"
      aria-label="Main navigation"
    >
      <nav className="flex flex-col gap-0.5 p-2 pt-3">
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
                'relative flex items-center gap-3 px-4 py-2.5 rounded-token-sm',
                'text-[14px] font-semibold tap-light transition-colors',
                active
                  ? 'text-green'
                  : 'text-muted hover:text-ink hover:bg-surface-page',
              )}
            >
              {/* Vertical accent bar — mirrors BottomNav's horizontal accent bar */}
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-1/4 bottom-1/4 w-[2px] rounded-r-sm bg-green"
                />
              )}
              <span className="relative shrink-0">
                <Icon
                  className="w-[22px] h-[22px]"
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
    </aside>
  );
}
