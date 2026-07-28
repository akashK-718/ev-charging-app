'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

export function StartHostingButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/profile/enable-hosting', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setError(data.error ?? 'Could not enable hosting. Please try again.');
        return;
      }
      router.push('/profile');
    } catch {
      setError('Could not enable hosting. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button onClick={handleStart} loading={loading} className="w-full">
        {!loading && 'Start hosting'}
      </Button>
      {error && (
        <p className="text-xs text-danger font-medium text-center">{error}</p>
      )}
    </div>
  );
}
