/**
 * Database types.
 *
 * In production, these are auto-generated from your Supabase schema:
 *   npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/lib/supabase/types.ts
 *
 * For now, this is a hand-written stub to get the project compiling.
 */

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          phone: string;
          name: string | null;
          role: 'driver' | 'lender' | 'both';
          kyc_status: 'pending' | 'verified' | 'rejected';
          avg_rating: number | null;
          created_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['users']['Row'],
          'id' | 'created_at' | 'avg_rating'
        >;
        Update: Partial<Database['public']['Tables']['users']['Insert']>;
      };
      chargers: {
        Row: {
          id: string;
          lender_id: string;
          title: string;
          charger_type: 'AC_3.3kW' | 'AC_7kW' | 'AC_22kW' | 'DC_fast';
          connector_type: 'Type2' | 'BharatAC' | 'CCS2' | 'CHAdeMO' | 'Type1';
          price_per_kwh: number;
          address: string;
          location: unknown; // PostGIS point
          photos: string[];
          status: 'active' | 'paused' | 'suspended';
          created_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['chargers']['Row'],
          'id' | 'created_at'
        >;
        Update: Partial<Database['public']['Tables']['chargers']['Insert']>;
      };
      bookings: {
        Row: {
          id: string;
          charger_id: string;
          driver_id: string;
          lender_id: string;
          scheduled_start: string;
          scheduled_end: string;
          actual_start: string | null;
          actual_end: string | null;
          kwh_delivered: number | null;
          status:
            | 'pending'
            | 'confirmed'
            | 'active'
            | 'completed'
            | 'cancelled'
            | 'disputed';
          confirmation_code: string;
          created_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['bookings']['Row'],
          'id' | 'created_at'
        >;
        Update: Partial<Database['public']['Tables']['bookings']['Insert']>;
      };
    };
  };
};
