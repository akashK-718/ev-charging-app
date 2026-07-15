import { createClient, createAdminClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { MapPin, Zap, PlusCircle } from 'lucide-react';

export default async function HomePage() {
  const supabase = createClient();
  const adminSupabase = createAdminClient();

  const { data: { user: rawUser } } = await supabase.auth.getUser();
  if (!rawUser) redirect('/login');

  const role  = (rawUser.user_metadata?.role as string | undefined) ?? 'driver';
  const name  = (rawUser.user_metadata?.name as string | undefined) ?? '';
  const isDriver = role === 'driver' || role === 'both';
  const isLender = role === 'lender' || role === 'both';

  const firstName = name.split(' ')[0] || 'there';

  return (
    <div
      className="min-h-screen bg-surface-page"
      style={{ paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}
    >
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-6">

        {/* Greeting */}
        <h1 className="text-2xl font-bold text-ink mb-0.5">Hey, {firstName}</h1>
        <p className="text-sm text-muted mb-7">Here's what's happening.</p>

        {/* Quick actions */}
        <section className="mb-7">
          <p className="text-xs font-mono font-semibold tracking-widest uppercase text-muted mb-3">
            Quick actions
          </p>
          <div className="grid grid-cols-3 gap-2">
            <Link
              href="/chargers"
              className="flex flex-col items-center gap-2 p-4 rounded-token bg-surface-card border border-border text-center hover:bg-green-soft transition-colors"
            >
              <MapPin className="w-5 h-5 text-green" />
              <span className="text-xs font-semibold text-ink">Find charger</span>
            </Link>
            {isLender && (
              <Link
                href="/lender/chargers"
                className="flex flex-col items-center gap-2 p-4 rounded-token bg-surface-card border border-border text-center hover:bg-surface-page transition-colors"
              >
                <Zap className="w-5 h-5 text-copper" />
                <span className="text-xs font-semibold text-ink">My chargers</span>
              </Link>
            )}
            {isLender && (
              <Link
                href="/lender/chargers/new"
                className="flex flex-col items-center gap-2 p-4 rounded-token bg-surface-card border border-border text-center hover:bg-surface-page transition-colors"
              >
                <PlusCircle className="w-5 h-5 text-muted" />
                <span className="text-xs font-semibold text-ink">Add charger</span>
              </Link>
            )}
            {!isLender && (
              <>
                <Link
                  href="/activity"
                  className="flex flex-col items-center gap-2 p-4 rounded-token bg-surface-card border border-border text-center hover:bg-surface-page transition-colors"
                >
                  <Zap className="w-5 h-5 text-muted" />
                  <span className="text-xs font-semibold text-ink">Activity</span>
                </Link>
                <Link
                  href="/profile"
                  className="flex flex-col items-center gap-2 p-4 rounded-token bg-surface-card border border-border text-center hover:bg-surface-page transition-colors"
                >
                  <PlusCircle className="w-5 h-5 text-muted" />
                  <span className="text-xs font-semibold text-ink">Profile</span>
                </Link>
              </>
            )}
          </div>
        </section>

        {/* Driving section */}
        {isDriver && (
          <section className="mb-7">
            <p className="text-xs font-mono font-semibold tracking-widest uppercase text-muted mb-3">
              Driving
            </p>
            <div className="rounded-token bg-surface-card border border-border divide-y divide-border">
              <Link
                href="/chargers"
                className="flex items-center gap-3 px-4 py-4 hover:bg-surface-page transition-colors"
              >
                <MapPin className="w-4 h-4 text-green shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink">Find a charger nearby</p>
                  <p className="text-xs text-muted">Browse available home chargers</p>
                </div>
                <span className="text-xs text-muted">→</span>
              </Link>
              <Link
                href="/activity"
                className="flex items-center gap-3 px-4 py-4 hover:bg-surface-page transition-colors"
              >
                <Zap className="w-4 h-4 text-muted shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink">Recent sessions</p>
                  <p className="text-xs text-muted">View your charging history</p>
                </div>
                <span className="text-xs text-muted">→</span>
              </Link>
            </div>
          </section>
        )}

        {/* Hosting section */}
        {isLender && (
          <section className="mb-7">
            <p className="text-xs font-mono font-semibold tracking-widest uppercase text-muted mb-3">
              Hosting
            </p>
            <div className="rounded-token bg-surface-card border border-border divide-y divide-border">
              <Link
                href="/lender/dashboard"
                className="flex items-center gap-3 px-4 py-4 hover:bg-surface-page transition-colors"
              >
                <Zap className="w-4 h-4 text-copper shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink">Dashboard</p>
                  <p className="text-xs text-muted">Earnings, bookings, charger status</p>
                </div>
                <span className="text-xs text-muted">→</span>
              </Link>
              <Link
                href="/lender/bookings"
                className="flex items-center gap-3 px-4 py-4 hover:bg-surface-page transition-colors"
              >
                <MapPin className="w-4 h-4 text-muted shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink">Upcoming bookings</p>
                  <p className="text-xs text-muted">See who's charging next</p>
                </div>
                <span className="text-xs text-muted">→</span>
              </Link>
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
