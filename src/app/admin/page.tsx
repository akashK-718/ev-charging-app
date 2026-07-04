import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { ChevronRight } from 'lucide-react';
import { formatINR } from '@/lib/currency';

export default async function AdminDashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = createAdminClient();

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [kycRes, payoutsRes, activeUsersRes, activeChargersRes, profileRes] = await Promise.all([
    admin.from('kyc_submissions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    admin.from('payouts').select('id, amount_paise').eq('status', 'pending'),
    admin.from('bookings').select('driver_id').gte('created_at', weekAgo).in('status', ['confirmed', 'in_progress', 'completed']),
    admin.from('chargers').select('id', { count: 'exact', head: true }).eq('status', 'active').is('deleted_at', null),
    admin.from('users').select('name').eq('id', user.id).single(),
  ]);

  const pendingKyc = kycRes.count ?? 0;

  const pendingPayouts = (payoutsRes.data ?? []) as Array<{ id: string; amount_paise: number }>;
  const pendingPayoutTotal = pendingPayouts.reduce((s, p) => s + p.amount_paise, 0);

  const activeBookings = (activeUsersRes.data ?? []) as Array<{ driver_id: string }>;
  const activeUsersThisWeek = new Set(activeBookings.map(b => b.driver_id)).size;

  const totalActiveChargers = activeChargersRes.count ?? 0;

  const adminName = (profileRes.data as { name: string | null } | null)?.name ?? 'Admin';

  const stats: Array<{ label: string; value: string; sub: string; href: string; urgent: boolean }> = [
    {
      label: 'Pending KYC',
      value: String(pendingKyc),
      sub: pendingKyc === 1 ? '1 submission awaiting review' : `${pendingKyc} submissions awaiting review`,
      href: '/admin/kyc',
      urgent: pendingKyc > 0,
    },
    {
      label: 'Pending payouts',
      value: pendingPayouts.length > 0 ? formatINR(pendingPayoutTotal) : '₹0',
      sub: pendingPayouts.length === 0
        ? 'No pending payouts'
        : `across ${pendingPayouts.length} lender${pendingPayouts.length !== 1 ? 's' : ''}`,
      href: '/admin/payouts',
      urgent: false,
    },
    {
      label: 'Active users this week',
      value: String(activeUsersThisWeek),
      sub: 'drivers with bookings in the last 7 days',
      href: '/admin/users',
      urgent: false,
    },
    {
      label: 'Active chargers',
      value: String(totalActiveChargers),
      sub: 'currently live on the platform',
      href: '/admin/chargers',
      urgent: false,
    },
  ];

  return (
    <main className="min-h-screen px-6 py-10 space-y-6">
      <div>
        <p className="text-xs font-bold tracking-widest text-slate-400 uppercase">Admin dashboard</p>
        <h1 className="font-display font-extrabold text-3xl text-ink mt-1">
          Hi, {adminName.split(' ')[0]}
        </h1>
      </div>

      <div className="space-y-3">
        {stats.map(stat => (
          <Link
            key={stat.href}
            href={stat.href}
            className="group flex items-center justify-between bg-white rounded-2xl border border-gray-100 px-5 py-4 hover:border-gray-200 transition-colors"
          >
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-wide">{stat.label}</p>
              <p className={`text-3xl font-display font-extrabold mt-0.5 ${stat.urgent ? 'text-amber-600' : 'text-ink'}`}>
                {stat.value}
              </p>
              <p className="text-xs text-muted mt-0.5">{stat.sub}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted group-hover:text-ink transition-colors shrink-0" />
          </Link>
        ))}
      </div>
    </main>
  );
}
