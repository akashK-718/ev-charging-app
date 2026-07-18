'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Car, Zap, ArrowLeftRight, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';

type Role = 'driver' | 'lender' | 'both';

const ROLES: Array<{ value: Role; label: string; description: string; Icon: React.ElementType }> = [
  {
    value: 'driver',
    label: 'I need to charge',
    description: 'Find nearby chargers and book sessions',
    Icon: Car,
  },
  {
    value: 'lender',
    label: 'I have a charger',
    description: 'List your home charger and earn money',
    Icon: Zap,
  },
  {
    value: 'both',
    label: 'Both',
    description: 'I drive an EV and want to share my charger',
    Icon: ArrowLeftRight,
  },
];

export function WelcomeRoleForm({ intent }: { intent?: string }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Role | null>(intent === 'lender' ? 'lender' : null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    if (!selected) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: selected }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.');
        setLoading(false);
        return;
      }

      // Refresh the session so the navbar (useAuth) picks up the new role immediately
      const supabase = createClient();
      await supabase.auth.refreshSession();

      // Lender intent from landing page CTA → go straight to charger setup
      if (intent === 'lender' && (selected === 'lender' || selected === 'both')) {
        router.push('/lender/chargers/new');
      } else {
        // Drivers tend to use the app more often — "both" lands on the driver view
        router.push(selected === 'lender' ? '/lender/dashboard' : '/explore');
      }
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col px-6 py-12 max-w-sm mx-auto w-full">
      <Link
        href="/welcome/name"
        className="flex items-center gap-1 -ml-2 p-2 w-fit rounded-xl text-muted hover:text-ink hover:bg-gray-50 transition-colors"
        aria-label="Back"
      >
        <ChevronLeft className="w-5 h-5" />
      </Link>

      <div className="mt-4">
        <h1 className="text-2xl font-medium text-ink">How will you use this?</h1>
        <p className="mt-2 text-muted">You can update this anytime in Profile.</p>
      </div>

      <div className="mt-10 flex flex-col gap-4">
        {ROLES.map(({ value, label, description, Icon }) => (
          <button
            key={value}
            onClick={() => setSelected(value)}
            className={cn(
              'flex items-center gap-4 p-5 rounded-xl border-2 text-left transition-colors',
              selected === value
                ? 'border-volt bg-volt-soft'
                : 'border-gray-200 bg-white hover:border-gray-300',
            )}
          >
            <span
              className={cn(
                'flex items-center justify-center w-12 h-12 rounded-xl shrink-0',
                selected === value ? 'bg-volt text-ink' : 'bg-gray-100 text-ink',
              )}
            >
              <Icon size={24} />
            </span>
            <div>
              <p className="font-display font-bold text-ink">{label}</p>
              <p className="text-sm text-muted mt-0.5">{description}</p>
            </div>
          </button>
        ))}
      </div>

      {error && <p className="mt-4 text-red-600 text-sm font-semibold">{error}</p>}

      <div className="mt-8">
        <Button
          onClick={() => { void handleContinue(); }}
          variant="secondary"
          size="lg"
          disabled={!selected || loading}
        >
          {loading ? 'Setting up your account…' : 'Continue'}
        </Button>
      </div>
    </main>
  );
}
