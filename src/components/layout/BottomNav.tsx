'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Map, ActivityIcon, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';

const SUPPRESSED: string[] = ['/login', '/verify-otp', '/', '/design'];

const TABS = [
  { href: '/home',     Icon: Home,         label: 'Home'    },
  { href: '/chargers', Icon: Map,          label: 'Explore' },
  { href: '/activity', Icon: ActivityIcon, label: 'Activity'},
  { href: '/profile',  Icon: User,         label: 'Profile' },
] as const;

function isTabActive(href: string, pathname: string) {
  if (href === '/home') return pathname === '/home';
  return pathname === href || pathname.startsWith(href + '/') || pathname.startsWith(href + '?');
}

export function BottomNav() {
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
    SUPPRESSED.includes(pathname) ||
    pathname.startsWith('/welcome')
  ) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-surface-card border-t border-border"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Main navigation"
    >
      <div className="flex">
        {TABS.map(({ href, Icon, label }) => {
          const active = isTabActive(href, pathname);
          const showBadge = href === '/activity' && unreadCount > 0;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex flex-col items-center gap-[3px] flex-1 px-1 py-2.5',
                'text-[10px] font-semibold tracking-wide transition-colors tap-target',
                active ? 'text-copper' : 'text-muted',
              )}
            >
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute top-0 left-1/4 right-1/4 h-[2px] rounded-b-sm bg-copper"
                />
              )}
              <span className="relative">
                <Icon
                  className="w-[22px] h-[22px] shrink-0"
                  strokeWidth={active ? 2.2 : 1.8}
                  aria-hidden
                />
                {showBadge && (
                  <span
                    aria-label={`${unreadCount} unread`}
                    className="absolute -top-1 -right-1.5 min-w-[14px] h-[14px] rounded-pill bg-copper text-white text-[9px] font-bold leading-[14px] text-center px-0.5"
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </span>
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
