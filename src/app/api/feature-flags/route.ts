import { NextResponse } from 'next/server';
import { getFeatureFlags } from '@/lib/edge-config';

/**
 * GET /api/feature-flags
 * Public endpoint — returns current feature flag state for client components.
 * No auth required; flags themselves contain no sensitive data.
 */
export async function GET() {
  const flags = await getFeatureFlags();
  return NextResponse.json(flags, {
    headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=60' },
  });
}
