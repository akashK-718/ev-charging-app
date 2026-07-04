'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

export interface AuthUser {
  id: string;
  phone: string | null;
  name: string | null;
  role: 'driver' | 'lender' | 'both';
  is_admin: boolean;
}

async function resolveAuthUser(rawUser: User): Promise<AuthUser> {
  const role = rawUser.user_metadata?.role as AuthUser['role'] | undefined;
  const name = (rawUser.user_metadata?.name as string | undefined) ?? null;

  if (role) {
    // Fast path: role is in JWT metadata — is_admin also read from metadata.
    // When granting admin, update both public.users AND auth.users metadata (see migration 012).
    return {
      id: rawUser.id,
      phone: rawUser.phone ?? null,
      name,
      role,
      is_admin: (rawUser.user_metadata?.is_admin as boolean | undefined) ?? false,
    };
  }

  // Slow path: role missing from metadata — fetch from DB.
  try {
    const res = await fetch('/api/auth/me');
    const data = (await res.json()) as { data?: { role?: string; name?: string | null; is_admin?: boolean } };
    return {
      id: rawUser.id,
      phone: rawUser.phone ?? null,
      name: data.data?.name ?? name,
      role: (data.data?.role as AuthUser['role']) ?? 'driver',
      is_admin: data.data?.is_admin ?? false,
    };
  } catch {
    return { id: rawUser.id, phone: rawUser.phone ?? null, name, role: 'driver', is_admin: false };
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
