'use client';

import { forwardRef, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, LogOut, Menu, X } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const AUTH_PAGES = ['/login', '/verify-otp'];

interface NavLink {
  href: string;
  label: string;
}

const DRIVER_LINKS: NavLink[] = [
  { href: '/chargers', label: 'Find chargers' },
  { href: '/bookings', label: 'My bookings' },
  { href: '/profile', label: 'Profile' },
];

const LENDER_LINKS: NavLink[] = [
  { href: '/lender/dashboard', label: 'Dashboard' },
  { href: '/lender/chargers', label: 'My chargers' },
  { href: '/lender/bookings', label: 'Bookings' },
  { href: '/lender/earnings', label: 'Earnings' },
  { href: '/profile', label: 'Profile' },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'driver' | 'lender'>('driver');
  const drawerRef = useRef<HTMLDivElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  const isAuthPage = AUTH_PAGES.some(p => pathname === p) || pathname.startsWith('/welcome');
  // Landing and design pages have their own nav — suppress the shared navbar
  const isLandingPage = pathname === '/';
  const isDesignPage = pathname === '/design';

  // Close drawer on route change
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  // ESC closes drawer
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  // Lock body scroll while drawer is open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  // Basic focus trap: cycle focus within drawer
  useEffect(() => {
    if (!drawerOpen) return;
    firstLinkRef.current?.focus();

    const drawer = drawerRef.current;
    if (!drawer) return;

    const onTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusable = Array.from(
        drawer.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onTab);
    return () => document.removeEventListener('keydown', onTab);
  }, [drawerOpen]);

  // All hooks above — conditional renders below
  if (isAuthPage || isLandingPage || isDesignPage) return null;

  if (loading) {
    return (
      <header className="h-14 border-b border-gray-100 bg-white sticky top-0 z-40">
        {/* Mobile skeleton */}
        <div className="flex items-center justify-between h-full px-4 lg:hidden">
          <div className="w-9" aria-hidden="true" />
          <Logo href="/" />
          <div className="w-9 h-8 rounded-xl bg-gray-100 animate-pulse" aria-hidden="true" />
        </div>
        {/* Desktop skeleton */}
        <div className="hidden lg:flex items-center h-full px-6 gap-4">
          <Logo href="/" />
          <div className="flex items-center gap-2 ml-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="w-20 h-7 rounded-lg bg-gray-100 animate-pulse" />
            ))}
          </div>
        </div>
      </header>
    );
  }

  if (!user) {
    return (
      <header className="h-14 border-b border-gray-100 bg-white sticky top-0 z-40">
        {/* Mobile: logo only */}
        <div className="flex items-center h-full px-4 lg:hidden">
          <Logo href="/" />
        </div>
        {/* Desktop: full shell with public nav links */}
        <div className="hidden lg:flex items-center h-full px-6 gap-6">
          <Logo href="/" />
          <nav className="flex items-center gap-0.5" aria-label="Main navigation">
            {[
              { href: '/chargers', label: 'Explore' },
              { href: '/bookings', label: 'My Chargers' },
              { href: '/bookings', label: 'Bookings' },
            ].map(link => (
              <Link
                key={link.label}
                href={link.href}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold text-muted hover:text-ink hover:bg-gray-50 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <button
              className="p-2 rounded-lg text-muted hover:text-ink hover:bg-gray-50 transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
            </button>
            <Link href="/login" className="ml-1" aria-label="Sign in">
              <Avatar avatarUrl={null} name={null} size="sm" />
            </Link>
          </div>
        </div>
      </header>
    );
  }

  const isBoth = user.role === 'both';
  const activeMode = isBoth ? viewMode : (user.role === 'lender' ? 'lender' : 'driver');
  const baseLinks = activeMode === 'lender' ? LENDER_LINKS : DRIVER_LINKS;
  const links: NavLink[] = user.is_admin
    ? [...baseLinks, { href: '/admin', label: 'Admin' }]
    : baseLinks;
  const homeHref = user.role === 'driver' ? '/chargers' : '/lender/dashboard';

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  return (
    <>
      <header className="h-14 border-b border-gray-100 bg-white sticky top-0 z-40">
        {/* ── Mobile layout ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between h-full px-4 lg:hidden">
          {/* Spacer balances the hamburger so logo stays centered */}
          <div className="w-9" aria-hidden="true" />

          <Logo href={homeHref} />

          <button
            onClick={() => setDrawerOpen(true)}
            className="p-2 -mr-2 rounded-xl hover:bg-volt-soft transition-colors"
            aria-label="Open navigation"
            aria-expanded={drawerOpen}
            aria-controls="nav-drawer"
          >
            <Menu className="w-5 h-5 text-ink" />
          </button>
        </div>

        {/* ── Desktop layout ────────────────────────────────────────── */}
        <div className="hidden lg:flex items-center h-full px-6 gap-6">
          <Logo href={homeHref} />

          {isBoth && (
            <ViewToggle viewMode={viewMode} onToggle={setViewMode} />
          )}

          <nav className="flex items-center gap-0.5" aria-label="Main navigation">
            {links.map(link => (
              <NavItem key={link.href} {...link} pathname={pathname} />
            ))}
          </nav>

          {/* Right rail: sign-out · bell · avatar */}
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={handleSignOut}
              className="p-2 rounded-lg text-muted hover:text-ink hover:bg-gray-50 transition-colors"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
            <button
              className="p-2 rounded-lg text-muted hover:text-ink hover:bg-gray-50 transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
            </button>
            <Link href="/profile" className="ml-1" aria-label="Your profile">
              <Avatar avatarUrl={null} name={user.name} size="sm" />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Mobile drawer backdrop ────────────────────────────────────── */}
      <div
        className={cn(
          'fixed inset-0 bg-black/40 z-50 lg:hidden transition-opacity duration-200',
          drawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        aria-hidden="true"
        onClick={() => setDrawerOpen(false)}
      />

      {/* ── Mobile drawer panel ───────────────────────────────────────── */}
      <div
        id="nav-drawer"
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className={cn(
          'fixed inset-y-0 right-0 w-4/5 max-w-xs bg-white z-50 lg:hidden',
          'flex flex-col shadow-2xl',
          'transition-transform duration-200 ease-out',
          drawerOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Drawer header */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-gray-100 shrink-0">
          <Logo href={homeHref} onClick={() => setDrawerOpen(false)} />
          <button
            onClick={() => setDrawerOpen(false)}
            className="p-2 -mr-2 rounded-xl hover:bg-volt-soft transition-colors"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5 text-ink" />
          </button>
        </div>

        {/* View toggle for "both" role */}
        {isBoth && (
          <div className="px-4 pt-4 pb-2 shrink-0">
            <ViewToggle viewMode={viewMode} onToggle={setViewMode} />
          </div>
        )}

        {/* Links */}
        <nav className="flex-1 overflow-y-auto p-3" aria-label="Main navigation">
          {links.map((link, i) => (
            <NavItem
              key={link.href}
              {...link}
              pathname={pathname}
              mobile
              onClick={() => setDrawerOpen(false)}
              ref={i === 0 ? firstLinkRef : undefined}
            />
          ))}
        </nav>

        {/* Sign out */}
        <div className="p-3 border-t border-gray-100 shrink-0">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-muted hover:text-ink hover:bg-gray-50 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sign out
          </button>
        </div>
      </div>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Logo({ href, onClick }: { href: string; onClick?: () => void }) {
  return (
    <Link href={href} onClick={onClick} className="flex items-center gap-2 shrink-0">
      <img src="/logo.png" alt="EV Charging" className="w-8 h-8 object-contain" />
      <span className="font-display font-bold text-lg text-ink leading-none">BrandName</span>
    </Link>
  );
}

interface NavItemProps {
  href: string;
  label: string;
  pathname: string;
  mobile?: boolean;
  onClick?: () => void;
}

const NavItem = forwardRef<HTMLAnchorElement, NavItemProps>(function NavItem(
  { href, label, pathname, mobile, onClick },
  ref,
) {
  const isActive = pathname === href || (href.length > 1 && pathname.startsWith(href));
  const isAdmin = href === '/admin';

  return (
    <Link
      ref={ref}
      href={href}
      onClick={onClick}
      className={cn(
        'font-semibold text-sm transition-colors',
        mobile
          ? 'flex items-center px-4 py-3 rounded-xl mb-0.5 tap-target'
          : 'px-3 py-1.5 rounded-lg',
        isAdmin
          ? isActive
            ? 'bg-slate-800 text-white'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          : isActive
            ? 'bg-volt-soft text-ink'
            : 'text-muted hover:text-ink hover:bg-gray-50',
      )}
    >
      {isAdmin ? (
        <span className="flex items-center gap-1.5">
          <span className="text-xs font-bold tracking-widest uppercase opacity-70">Admin</span>
        </span>
      ) : label}
    </Link>
  );
});

function ViewToggle({
  viewMode,
  onToggle,
}: {
  viewMode: 'driver' | 'lender';
  onToggle: (m: 'driver' | 'lender') => void;
}) {
  return (
    <div
      className="flex items-center bg-gray-100 rounded-xl p-1 shrink-0"
      role="group"
      aria-label="Switch view"
    >
      {(['driver', 'lender'] as const).map(mode => (
        <button
          key={mode}
          onClick={() => onToggle(mode)}
          aria-pressed={viewMode === mode}
          className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors',
            viewMode === mode
              ? 'bg-white text-ink shadow-sm'
              : 'text-muted hover:text-ink',
          )}
        >
          {mode}
        </button>
      ))}
    </div>
  );
}
