'use client';

import { useEffect, useState } from 'react';

export type KycStatus = 'not_started' | 'pending' | 'approved' | 'rejected';

export interface UserProfile {
  id: string;
  phone: string | null;
  name: string | null;
  role: 'driver' | 'lender' | 'both' | 'admin';
  kyc_status: KycStatus;
}

export function useProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(async res => {
        if (!res.ok) {
          setProfile(null);
          return;
        }
        const json = await res.json() as { data: UserProfile };
        setProfile(json.data);
      })
      .catch(() => {
        setError('Failed to load profile');
      })
      .finally(() => setLoading(false));
  }, []);

  function refresh() {
    setLoading(true);
    fetch('/api/auth/me')
      .then(async res => {
        if (!res.ok) { setProfile(null); return; }
        const json = await res.json() as { data: UserProfile };
        setProfile(json.data);
      })
      .catch(() => setError('Failed to load profile'))
      .finally(() => setLoading(false));
  }

  return { profile, loading, error, refresh };
}
