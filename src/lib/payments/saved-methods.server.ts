import type { createAdminClient } from '@/lib/supabase/server';
import { getRazorpay } from '@/lib/razorpay';
import { transformToken } from './tokens';
import type { SavedMethod } from '@/types/payment';
import type { Database } from '@/lib/supabase/types';

type PaymentProfile = Pick<Database['public']['Tables']['users']['Row'],
  'name' | 'phone' | 'razorpay_customer_id'>;

/** Shared server-side loading for the profile page and saved-methods API. */
export async function fetchSavedMethods(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  profile: PaymentProfile,
): Promise<{ methods: SavedMethod[]; customerId: string | null }> {
  let customerId = profile.razorpay_customer_id;
  try {
    const rp = getRazorpay();
    if (!customerId) {
      // fail_existing:0 reuses a customer registered with this contact.
      const customer = await rp.customers.create({
        name: profile.name ?? 'Kirin User',
        contact: profile.phone,
        fail_existing: 0,
      });
      customerId = customer.id;
      await admin.from('users').update({ razorpay_customer_id: customerId }).eq('id', userId);
    }
    const response = await rp.customers.fetchTokens(customerId) as unknown as {
      items?: Record<string, unknown>[];
    };
    const methods = (response.items ?? []).reduce<SavedMethod[]>((items, token) => {
      const method = transformToken(token);
      if (method) items.push(method);
      return items;
    }, []);
    return { methods, customerId };
  } catch (error) {
    console.warn('[saved-methods] Razorpay error:', error);
    // Preserve the existing graceful fallback when payments are unavailable.
    return { methods: [], customerId };
  }
}
