/**
 * Database types.
 *
 * In production, auto-generate from your Supabase schema:
 *   npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/lib/supabase/types.ts
 *
 * This is a hand-written stub that matches 001_initial_schema.sql.
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
          kyc_doc_url: string | null;
          avg_rating: number | null;
          razorpay_contact_id: string | null;
          razorpay_fund_account_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          phone: string;
          name?: string | null;
          role?: 'driver' | 'lender' | 'both';
          kyc_status?: 'pending' | 'verified' | 'rejected';
          kyc_doc_url?: string | null;
        };
        Update: Partial<Database['public']['Tables']['users']['Insert']>;
        Relationships: [];
      };
      chargers: {
        Row: {
          id: string;
          lender_id: string;
          title: string;
          charger_type: 'AC_3.3kW' | 'AC_7kW' | 'AC_22kW' | 'DC_fast';
          connector_types: ('Type2' | 'BharatAC' | 'CCS2' | 'CHAdeMO' | 'Type1')[];
          price_per_kwh: number;
          address: string;
          latitude: number;
          longitude: number;
          location: unknown;
          photos: string[];
          instructions: string | null;
          status: 'active' | 'paused' | 'suspended';
          avg_rating: number | null;
          total_sessions: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          lender_id: string;
          title: string;
          charger_type: 'AC_3.3kW' | 'AC_7kW' | 'AC_22kW' | 'DC_fast';
          connector_types: ('Type2' | 'BharatAC' | 'CCS2' | 'CHAdeMO' | 'Type1')[];
          price_per_kwh: number;
          address: string;
          latitude: number;
          longitude: number;
          photos?: string[];
          instructions?: string | null;
          status?: 'active' | 'paused' | 'suspended';
        };
        Update: Partial<Database['public']['Tables']['chargers']['Insert']>;
        Relationships: [];
      };
      availability_slots: {
        Row: {
          id: string;
          charger_id: string;
          day_of_week: number[];
          start_time: string;
          end_time: string;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          charger_id: string;
          day_of_week: number[];
          start_time: string;
          end_time: string;
          is_active?: boolean;
        };
        Update: Partial<Database['public']['Tables']['availability_slots']['Insert']>;
        Relationships: [];
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
          status: 'pending' | 'confirmed' | 'active' | 'completed' | 'cancelled' | 'disputed';
          cancellation_reason: string | null;
          confirmation_code: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          charger_id: string;
          driver_id: string;
          lender_id: string;
          scheduled_start: string;
          scheduled_end: string;
          actual_start?: string | null;
          actual_end?: string | null;
          kwh_delivered?: number | null;
          status?: 'pending' | 'confirmed' | 'active' | 'completed' | 'cancelled' | 'disputed';
          cancellation_reason?: string | null;
          confirmation_code: string;
        };
        Update: Partial<Database['public']['Tables']['bookings']['Insert']>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_charger_with_slots: {
        Args: {
          p_lender_id: string;
          p_title: string;
          p_charger_type: string;
          p_connector_types: string[];
          p_price_per_kwh: number;
          p_address: string;
          p_latitude: number;
          p_longitude: number;
          p_photos: string[];
          p_instructions: string;
          p_slots: string; // JSON string
        };
        Returns: string; // new charger UUID
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
