import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient, createAdminClient } from '@/lib/supabase/server';

const ADMIN_NAV = [
  { href: '/admin',               label: 'Overview' },
  { href: '/admin/kyc',           label: 'KYC' },
  { href: '/admin/payouts',       label: 'Payouts' },
  { href: '/admin/users',         label: 'Users' },
  { href: '/admin/review-queue',  label: 'Review queue' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('users')
    .select('is_admin, name')
    .eq('id', user.id)
    .single();

  if (!(profile as { is_admin: boolean } | null)?.is_admin) redirect('/');

  const adminName = (profile as { name: string | null }).name ?? 'Admin';

  return (
    <div>
      {/* Admin top bar */}
      <div className="bg-slate-900 text-white sticky top-14 z-30">
        <div className="flex items-center justify-between px-4 py-1.5">
          <div className="flex items-center gap-3 overflow-x-auto scrollbar-none">
            <span className="text-xs font-bold tracking-widest text-slate-400 uppercase shrink-0">
              Admin
            </span>
            <span className="text-slate-600 shrink-0">·</span>
            {ADMIN_NAV.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className="text-xs font-semibold text-slate-300 hover:text-white transition-colors whitespace-nowrap px-1 py-0.5"
              >
                {link.label}
              </Link>
            ))}
          </div>
          <span className="text-xs text-slate-500 shrink-0 pl-4">{adminName}</span>
        </div>
      </div>
      {children}
    </div>
  );
}
