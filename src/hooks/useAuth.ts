'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

export interface AuthUser {
  id: string;
  phone: string | null;
  name: string | null;
  role: 'driver' | 'lender' | 'both';
}

async function resolveAuthUser(rawUser: User): Promise<AuthUser> {
  const role = rawUser.user_metadata?.role as AuthUser['role'] | undefined;
  const name = (rawUser.user_metadata?.name as string | undefined) ?? null;

  if (role) {
    // Fast path: role is in JWT metadata — no extra network call needed
    return { id: rawUser.id, phone: rawUser.phone ?? null, name, role };
  }

  // Slow path: role missing from metadata (users created before metadata sync).
  // Fetch from DB so we never show the wrong menu items due to the ?? 'driver' fallback.
  try {
    const res = await fetch('/api/auth/me');
    const data = (await res.json()) as { data?: { role?: string; name?: string | null } };
    return {
      id: rawUser.id,
      phone: rawUser.phone ?? null,
      name: data.data?.name ?? name,
      role: (data.data?.role as AuthUser['role']) ?? 'driver',
    };
  } catch {
    return { id: rawUser.id, phone: rawUser.phone ?? null, name, role: 'driver' };
  }
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        setUser(null);
        setLoading(false);
        return;
      }
      void resolveAuthUser(data.user).then(u => {
        setUser(u);
        setLoading(false);
      });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setUser(null);
        return;
      }
      // When session refreshes (e.g. after role change), re-derive user from updated metadata
      void resolveAuthUser(session.user).then(setUser);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, loading };
}
