import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/lib/supabase/types';
import { isEmergencyLockdown } from '@/lib/edge-config';

function roleHome(_role: string, isAdmin: boolean): string {
  if (isAdmin) return '/admin';
  return '/home';
}

const AUTH_REQUIRED = [
  '/home', '/activity', '/notifications', '/lender', '/admin',
  '/bookings', '/welcome', '/explore', '/profile',
] as const;

function requiresAuth(pathname: string) {
  return AUTH_REQUIRED.some(p => pathname.startsWith(p));
}

// Paths that remain reachable during emergency lockdown (so admin can sign in)
const LOCKDOWN_PASSTHROUGH = new Set(['/emergency', '/auth', '/login', '/verify-otp']);
// Paths that remain reachable during maintenance (so admin can sign in)
const MAINTENANCE_PASSTHROUGH = new Set(['/maintenance', '/emergency', '/auth', '/login', '/verify-otp']);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Emergency lockdown (Edge Config — Supabase-independent) ──────────────────
  // Checked first, before any other logic. Edge Config reads are cached at the
  // edge so this adds negligible latency on the hot path.
  const lockdown = await isEmergencyLockdown();

  // ── Fast path for unauthenticated requests ────────────────────────────────────
  // Supabase stores the session in a cookie starting with "sb-".
  // If no such cookie exists the user is definitely not authenticated.
  //
  // Security invariant: protected routes are NEVER served here — they always
  // redirect to /login. Only genuinely public paths (/, /login, /terms, …)
  // reach the final `return NextResponse.next()`. Any route in AUTH_REQUIRED
  // redirects to /login regardless of this fast path. Routes that carry a
  // session cookie always fall through to getUser() below, no exceptions.
  const hasSession = request.cookies.getAll().some(c => c.name.startsWith('sb-'));

  if (!hasSession) {
    if (lockdown && !LOCKDOWN_PASSTHROUGH.has(pathname)) {
      return NextResponse.redirect(new URL('/emergency', request.url));
    }
    if (requiresAuth(pathname)) {
      const url = new URL('/auth', request.url);
      url.searchParams.set('next', pathname);
      return NextResponse.redirect(url);
    }
    // Public path with no session (/, /login, /terms, etc.) — serve directly.
    return NextResponse.next();
  }

  // ── Authenticated path — validate session and handle role-based routing ───────
  // IMPORTANT: Do not put any logic between createServerClient and getUser —
  // the cookie refresh that keeps sessions alive happens inside getUser.
  let supabaseResponse = NextResponse.next({ request });

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

  // Run auth check and platform_mode read in parallel to keep middleware fast.
  // platform_mode is readable by the anon client thanks to the public SELECT
  // RLS policy added in migration 028.
  const [{ data: { user } }, settingsResult] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'platform_mode')
      .maybeSingle(),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const platformMode = ((settingsResult.data as any)?.value as string | undefined) ?? 'normal';

  // ── 1. Auth gate ──────────────────────────────────────────────────────────────

  if (requiresAuth(pathname) && !user) {
    const url = new URL('/auth', request.url);
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // All checks below require an authenticated user.
  if (!user) return supabaseResponse;

  const isAdmin = (user.user_metadata?.is_admin as boolean | undefined) ?? false;
  const role = (user.user_metadata?.role as string | undefined) ?? '';

  // ── 2. Emergency lockdown gate (authenticated) ────────────────────────────────
  if (lockdown && !isAdmin && !LOCKDOWN_PASSTHROUGH.has(pathname)) {
    return NextResponse.redirect(new URL('/emergency', request.url));
  }

  // ── 3. Maintenance mode gate ──────────────────────────────────────────────────
  if (platformMode === 'maintenance' && !isAdmin && !MAINTENANCE_PASSTHROUGH.has(pathname)) {
    return NextResponse.redirect(new URL('/maintenance', request.url));
  }

  // ── 4. Admin-only routes ──────────────────────────────────────────────────────
  // The is_admin flag is synced to JWT metadata when admin access is granted (migration 012).
  if (pathname.startsWith('/admin') && !isAdmin) {
    const dest = role === 'lender' || role === 'both' ? '/lender/chargers' : '/explore';
    const url = new URL(dest, request.url);
    url.searchParams.set('error', 'admin_required');
    return NextResponse.redirect(url);
  }

  // ── 5. Root redirect ──────────────────────────────────────────────────────────
  // Redirect logged-in users to their role's home page.
  if (pathname === '/') {
    return NextResponse.redirect(new URL(roleHome(role, isAdmin), request.url));
  }

  // ── 6. Auth screen redirect ───────────────────────────────────────────────────
  // Redirect logged-in users away from auth screens.
  // For /auth: only redirect when the user has a name (profile complete); if no
  // name, allow through so the page can show the profile step.
  if (pathname === '/login' || pathname === '/verify-otp') {
    const nextParam = request.nextUrl.searchParams.get('next');
    const safeNext = nextParam?.startsWith('/') && !nextParam.startsWith('//') ? nextParam : null;
    const dest = safeNext ?? roleHome(role, isAdmin);
    return NextResponse.redirect(new URL(dest, request.url));
  }
  if (pathname === '/auth') {
    const authName = user.user_metadata?.name as string | undefined;
    if (authName) {
      const nextParam = request.nextUrl.searchParams.get('next');
      const safeNext = nextParam?.startsWith('/') && !nextParam.startsWith('//') ? nextParam : null;
      const dest = safeNext ?? roleHome(role, isAdmin);
      return NextResponse.redirect(new URL(dest, request.url));
    }
    // No name — let /auth show the profile step
  }

  // ── 7. Welcome flow gating ────────────────────────────────────────────────────
  if (pathname === '/welcome' || pathname === '/profile/name') {
    return NextResponse.redirect(new URL('/auth', request.url));
  }

  const name = user.user_metadata?.name as string | undefined;

  const isWelcomeName = pathname === '/welcome/name'; // redirects to /auth; kept to avoid redirect loop
  const isAuthPage = pathname === '/auth';

  if (!name && !isWelcomeName && !isAuthPage) {
    return NextResponse.redirect(new URL('/auth', request.url));
  }

  // ── 8. Role-based route guards ────────────────────────────────────────────────
  // Admins bypass all role checks — they can access any route.
  if (!isAdmin) {
    const canAccessLender = role === 'lender' || role === 'both';
    const canAccessDriver = role === 'driver' || role === 'both';

    const isLenderRoute = pathname.startsWith('/lender');
    const isDriverRoute = pathname.startsWith('/bookings');

    if (isLenderRoute || isDriverRoute) {
      if (!role) {
        console.warn(`[middleware] No role set — blocking ${pathname}, redirecting to /home`);
        return NextResponse.redirect(new URL('/home', request.url));
      }

      if (isLenderRoute && !canAccessLender) {
        const dest = canAccessDriver ? '/explore' : '/home';
        console.warn(`[middleware] Role '${role}' blocked from lender route ${pathname} → ${dest}`);
        return NextResponse.redirect(new URL(dest, request.url));
      }

      if (isDriverRoute && !canAccessDriver) {
        const dest = canAccessLender ? '/lender/chargers' : '/home';
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
