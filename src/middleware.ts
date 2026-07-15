import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/lib/supabase/types';

function roleHome(_role: string, isAdmin: boolean): string {
  if (isAdmin) return '/admin';
  return '/home';
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // Standard Supabase SSR middleware pattern.
  // IMPORTANT: Do not put any logic between createServerClient and getUser —
  // the cookie refresh that keeps sessions alive happens inside getUser.
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as Parameters<typeof supabaseResponse.cookies.set>[2])
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // ── 1. Auth gate ──────────────────────────────────────────────────────────────

  const requiresAuth =
    pathname.startsWith('/home') ||
    pathname.startsWith('/activity') ||
    pathname.startsWith('/notifications') ||
    pathname.startsWith('/lender') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/bookings') ||
    pathname.startsWith('/welcome') ||
    pathname.startsWith('/chargers') ||
    pathname.startsWith('/profile');

  if (requiresAuth && !user) {
    const url = new URL('/login', request.url);
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // All checks below require an authenticated user.
  if (!user) return supabaseResponse;

  const isAdmin = (user.user_metadata?.is_admin as boolean | undefined) ?? false;
  const role = (user.user_metadata?.role as string | undefined) ?? '';

  // ── 2. Admin-only routes ──────────────────────────────────────────────────────
  // The is_admin flag is synced to JWT metadata when admin access is granted (migration 012).
  if (pathname.startsWith('/admin') && !isAdmin) {
    const dest = role === 'lender' || role === 'both' ? '/lender/dashboard' : '/chargers';
    const url = new URL(dest, request.url);
    url.searchParams.set('error', 'admin_required');
    return NextResponse.redirect(url);
  }

  // ── 3. Root redirect ──────────────────────────────────────────────────────────
  // Redirect logged-in users to their role's home page.
  // Logged-out users fall through to the marketing/landing page.
  if (pathname === '/') {
    return NextResponse.redirect(new URL(roleHome(role, isAdmin), request.url));
  }

  // ── 4. Auth screen redirect ───────────────────────────────────────────────────
  // Redirect logged-in users away from auth screens.
  // Honour ?next= for internal paths so a failed page load doesn't silently land on /chargers.
  if (pathname === '/login' || pathname === '/verify-otp') {
    const nextParam = request.nextUrl.searchParams.get('next');
    const safeNext = nextParam?.startsWith('/') && !nextParam.startsWith('//') ? nextParam : null;
    const dest = safeNext ?? roleHome(role, isAdmin);
    return NextResponse.redirect(new URL(dest, request.url));
  }

  // ── 5. Welcome flow gating ────────────────────────────────────────────────────
  // Legacy entry points always forward to the first step.
  if (pathname === '/welcome' || pathname === '/profile/name') {
    return NextResponse.redirect(new URL('/welcome/name', request.url));
  }

  const name = user.user_metadata?.name as string | undefined;
  // `onboarded` is explicitly false only for accounts mid-welcome-flow (set at signup,
  // cleared once a role is chosen). Undefined means either pre-existing or already complete.
  const onboarded = user.user_metadata?.onboarded;

  const isWelcomeName = pathname === '/welcome/name';
  const isWelcomeRole = pathname === '/welcome/role';

  if (!name && !isWelcomeName) {
    const url = new URL('/welcome/name', request.url);
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (name && onboarded === false && !isWelcomeRole && !isWelcomeName) {
    const url = new URL('/welcome/role', request.url);
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // ── 6. Role-based route guards ────────────────────────────────────────────────
  // Admins bypass all role checks — they can access any route.
  // Read role exclusively from JWT metadata: no DB query, stays fast at the edge.
  if (!isAdmin) {
    const canAccessLender = role === 'lender' || role === 'both';
    const canAccessDriver = role === 'driver' || role === 'both';

    const isLenderRoute = pathname.startsWith('/lender');
    const isDriverRoute = pathname.startsWith('/chargers') || pathname.startsWith('/bookings');

    if (isLenderRoute || isDriverRoute) {
      // No role set yet → mid-onboarding, send to role selection.
      if (!role) {
        console.warn(`[middleware] No role set — blocking ${pathname}, redirecting to /welcome/role`);
        const url = new URL('/welcome/role', request.url);
        // Anti-loop guard: if we'd set next= to the destination itself, go to root instead.
        const nextVal = pathname !== '/welcome/role' ? pathname : '/';
        url.searchParams.set('next', nextVal);
        return NextResponse.redirect(url);
      }

      if (isLenderRoute && !canAccessLender) {
        const dest = canAccessDriver ? '/chargers' : '/welcome/role';
        console.warn(`[middleware] Role '${role}' blocked from lender route ${pathname} → ${dest}`);
        return NextResponse.redirect(new URL(dest, request.url));
      }

      if (isDriverRoute && !canAccessDriver) {
        const dest = canAccessLender ? '/lender/dashboard' : '/welcome/role';
        console.warn(`[middleware] Role '${role}' blocked from driver route ${pathname} → ${dest}`);
        return NextResponse.redirect(new URL(dest, request.url));
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'
  ]
};
