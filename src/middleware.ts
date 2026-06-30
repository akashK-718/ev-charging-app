import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/lib/supabase/types';

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

  const requiresAuth =
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

  // Redirect logged-in users away from auth screens and landing page
  if ((pathname === '/login' || pathname === '/verify-otp' || pathname === '/') && user) {
    return NextResponse.redirect(new URL('/chargers', request.url));
  }

  // ── Two-step welcome flow gating ──────────────────────────────────────────────
  // Legacy entry points always forward to the first step.
  if (user && (pathname === '/welcome' || pathname === '/profile/name')) {
    return NextResponse.redirect(new URL('/welcome/name', request.url));
  }

  if (user) {
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
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'
  ]
};
