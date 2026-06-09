import { NextResponse, type NextRequest } from 'next/server';

/**
 * Middleware runs on every request before the page renders.
 * Use it for auth checks, redirects, and refreshing Supabase sessions.
 *
 * TODO (Milestone 1):
 *   - refresh Supabase session cookie
 *   - protect /lender/* and /admin/* routes (redirect to /login if not authed)
 *   - check admin role for /admin/*
 */
export async function middleware(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'
  ]
};
