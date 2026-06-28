'use client';

import { useState } from 'react';
import { Pencil, X, Car, Zap, ArrowLeftRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

type Role = 'driver' | 'lender' | 'both';

const ROLES: Array<{ value: Role; label: string; description: string; Icon: React.ElementType }> = [
  { value: 'driver', label: 'Driver', description: 'Find nearby chargers and book sessions', Icon: Car },
  { value: 'lender', label: 'Lender', description: 'List your home charger and earn money', Icon: Zap },
  { value: 'both', label: 'Both', description: 'Drive an EV and share your charger', Icon: ArrowLeftRight },
];

const ROLE_LABELS: Record<Role, string> = {
  driver: 'Driver',
  lender: 'Lender',
  both: 'Driver & Lender',
};

export function RoleEditor({ initialRole }: { initialRole: Role }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Role>(initialRole);
  const [displayRole, setDisplayRole] = useState<Role>(initialRole);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function openModal() {
    setSelected(displayRole);
    setError(null);
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
    setError(null);
  }

  async function save() {
    if (selected === displayRole) { closeModal(); return; }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: selected }),
      });
      const data = (await res.json()) as {
        data?: { role?: Role };
        roleForcedBoth?: boolean;
        error?: string;
      };

      if (!res.ok) {
        setError(data.error ?? 'Could not save. Try again.');
        return;
      }

      const savedRole = data.data?.role ?? selected;
      setDisplayRole(savedRole);
      closeModal();

      // Refresh the Supabase session so useAuth picks up the new role from updated metadata
      const supabase = createClient();
      await supabase.auth.refreshSession();

      const msg = data.roleForcedBoth
        ? 'You have active chargers. Keeping you in Both mode. To switch to driver-only, delete all your chargers first.'
        : 'Role updated!';
      setToast(msg);
      setTimeout(() => setToast(null), data.roleForcedBoth ? 6000 : 3000);
    } catch {
      setError('Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <p className="text-xs text-muted mb-0.5">Role</p>
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold text-ink capitalize">{ROLE_LABELS[displayRole]}</p>
        <button
          onClick={openModal}
          aria-label="Edit role"
          className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <Pencil className="w-3.5 h-3.5 text-muted" />
        </button>
      </div>

      {toast && (
        <p className={cn(
          'text-xs font-medium mt-1 leading-relaxed',
          toast.includes('Keeping') ? 'text-yellow-700' : 'text-green-700',
        )}>
          {toast}
        </p>
      )}

      {/* Modal backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-lg text-ink">Change role</h2>
              <button
                onClick={closeModal}
                className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-muted" />
              </button>
            </div>

            <div className="space-y-3">
              {ROLES.map(({ value, label, description, Icon }) => (
                <button
                  key={value}
                  onClick={() => setSelected(value)}
                  className={cn(
                    'flex items-center gap-3 w-full p-4 rounded-2xl border-2 text-left transition-colors',
                    selected === value
                      ? 'border-volt bg-volt-soft'
                      : 'border-gray-200 bg-white hover:border-gray-300',
                  )}
                >
                  <span className={cn(
                    'flex items-center justify-center w-10 h-10 rounded-xl shrink-0',
                    selected === value ? 'bg-volt text-ink' : 'bg-gray-100 text-ink',
                  )}>
                    <Icon size={20} />
                  </span>
                  <div>
                    <p className="font-semibold text-sm text-ink">{label}</p>
                    <p className="text-xs text-muted mt-0.5">{description}</p>
                  </div>
                </button>
              ))}
            </div>

            {error && <p className="text-xs text-red-600 font-medium">{error}</p>}

            <div className="flex gap-3 pt-1">
              <button
                onClick={closeModal}
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-sm font-semibold text-muted hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { void save(); }}
                disabled={saving}
                className="flex-1 py-3 rounded-2xl bg-ink text-white text-sm font-bold hover:bg-ink/90 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
