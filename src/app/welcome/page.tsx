'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Car, Zap, ArrowLeftRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

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

// Allows letters (including Unicode for Indian scripts) and spaces, 2–50 chars
const NAME_REGEX = /^[\p{L}\s]{2,50}$/u;

function validateName(v: string): string | null {
  const trimmed = v.trim();
  if (!trimmed) return 'Name is required.';
  if (trimmed.length < 2) return 'Name must be at least 2 characters.';
  if (trimmed.length > 50) return 'Name must be 50 characters or fewer.';
  if (!NAME_REGEX.test(trimmed)) return 'Name can only contain letters and spaces.';
  return null;
}

export default function WelcomePage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameTouched, setNameTouched] = useState(false);
  const [selected, setSelected] = useState<Role | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameValid = validateName(name) === null;
  const canSubmit = nameValid && selected !== null;

  function handleNameBlur() {
    setNameTouched(true);
    setNameError(validateName(name));
  }

  function handleNameChange(v: string) {
    setName(v);
    if (nameTouched) setNameError(validateName(v));
  }

  async function handleContinue() {
    if (!canSubmit) return;
    const nameErr = validateName(name);
    if (nameErr) {
      setNameTouched(true);
      setNameError(nameErr);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: selected, name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.');
        setLoading(false);
        return;
      }
      if (selected === 'lender' || selected === 'both') {
        router.push('/lender/chargers/new');
      } else {
        router.push('/chargers');
      }
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col px-6 py-12">
      <h1 className="font-display font-extrabold text-3xl text-ink">Let&apos;s get started</h1>
      <p className="mt-2 text-muted">You can update these anytime in Profile.</p>

      {/* Name input */}
      <div className="mt-10 space-y-1.5">
        <label htmlFor="display-name" className="block text-sm font-semibold text-ink">
          What should we call you?
        </label>
        <input
          id="display-name"
          type="text"
          value={name}
          onChange={e => handleNameChange(e.target.value)}
          onBlur={handleNameBlur}
          placeholder="Your name"
          maxLength={50}
          autoComplete="name"
          className={cn(
            'w-full px-4 py-3 rounded-2xl border text-sm font-medium text-ink placeholder:text-muted',
            'focus:outline-none focus:ring-2 focus:ring-volt transition-colors',
            nameError && nameTouched ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white',
          )}
        />
        {nameError && nameTouched ? (
          <p className="text-xs text-red-600 font-medium">{nameError}</p>
        ) : (
          <p className="text-xs text-muted">
            This is how others on the platform will see you. You can use your nickname or first name.
          </p>
        )}
      </div>

      {/* Role selection */}
      <div className="mt-8 flex flex-col gap-4">
        <p className="text-sm font-semibold text-ink">How will you use this?</p>
        {ROLES.map(({ value, label, description, Icon }) => (
          <button
            key={value}
            onClick={() => setSelected(value)}
            className={cn(
              'flex items-center gap-4 p-5 rounded-2xl border-2 text-left transition-colors',
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
          onClick={handleContinue}
          variant="secondary"
          size="lg"
          disabled={!canSubmit || loading}
        >
          {loading ? 'Setting up your account…' : 'Continue'}
        </Button>
        <p className="mt-3 text-xs text-center text-muted">You can update both anytime in Profile</p>
      </div>
    </main>
  );
}
