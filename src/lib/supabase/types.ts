/**
 * Database types.
 *
 * In production, auto-generate from your Supabase schema:
 *   npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/lib/supabase/types.ts
 *
 * This is a hand-written stub that matches 001_initial_schema.sql + 008_lender_complete_flow.sql
 * + 010_booking_lifecycle.sql.
 */

type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'rejected'
  | 'auto_rejected'
  | 'cancelled'
  | 'awaiting_driver_confirmation'
  | 'in_progress'
  | 'completed'
  | 'no_show';

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          phone: string;
          name: string | null;
          role: 'driver' | 'lender' | 'both' | 'admin';
          kyc_status: 'not_started' | 'pending' | 'approved' | 'rejected' | 'resubmission_required';
          kyc_doc_url: string | null;
          avg_rating: number | null;
          razorpay_contact_id: string | null;
          razorpay_fund_account_id: string | null;
          is_admin: boolean;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          phone: string;
          name?: string | null;
          role?: 'driver' | 'lender' | 'both' | 'admin';
          kyc_status?: 'not_started' | 'pending' | 'approved' | 'rejected' | 'resubmission_required';
          kyc_doc_url?: string | null;
          is_admin?: boolean;
          avatar_url?: string | null;
        };
        Update: Partial<Database['public']['Tables']['users']['Insert']>;
        Relationships: [];
      };
      app_settings: {
        Row: {
          key: string;
          value: unknown;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: unknown;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['app_settings']['Insert']>;
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: string;
          admin_user_id: string;
          action_type: string;
          target_user_id: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          admin_user_id: string;
          action_type: string;
          target_user_id?: string | null;
          metadata?: Record<string, unknown>;
        };
        Update: Partial<Database['public']['Tables']['audit_log']['Insert']>;
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
          status: 'draft' | 'active' | 'paused' | 'suspended';
          avg_rating: number | null;
          total_sessions: number;
          deleted_at: string | null;
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
          deleted_at?: string | null;
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
          status: BookingStatus;
          cancellation_reason: string | null;
          confirmation_code: string;
          confirmed_at: string | null;
          rejected_at: string | null;
          started_at: string | null;
          ended_at: string | null;
          no_show_at: string | null;
          cancelled_at: string | null;
          rejection_reason: string | null;
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
          status?: BookingStatus;
          cancellation_reason?: string | null;
          confirmation_code: string;
          confirmed_at?: string | null;
          rejected_at?: string | null;
          started_at?: string | null;
          ended_at?: string | null;
          no_show_at?: string | null;
          cancelled_at?: string | null;
          rejection_reason?: string | null;
        };
        Update: Partial<Database['public']['Tables']['bookings']['Insert']>;
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          booking_id: string;
          razorpay_order_id: string | null;
          razorpay_payment_id: string | null;
          razorpay_transfer_id: string | null;
          razorpay_refund_id: string | null;
          gross_amount: number;
          platform_fee: number;
          lender_payout: number;
          gateway_fee: number | null;
          status: 'created' | 'paid' | 'transferred' | 'refunded' | 'failed';
          payout_released_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          booking_id: string;
          razorpay_order_id?: string | null;
          razorpay_payment_id?: string | null;
          razorpay_transfer_id?: string | null;
          razorpay_refund_id?: string | null;
          gross_amount: number;
          platform_fee: number;
          lender_payout: number;
          gateway_fee?: number | null;
          status?: 'created' | 'paid' | 'transferred' | 'refunded' | 'failed';
          payout_released_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['payments']['Insert']>;
        Relationships: [];
      };
      kyc_submissions: {
        Row: {
          id: string;
          user_id: string;
          aadhaar_photo_url: string;
          pan_photo_url: string;
          selfie_url: string;
          pan_number: string;
          aadhaar_last_4: string;
          bank_account_number: string | null;
          bank_ifsc: string | null;
          upi_id: string | null;
          status: 'pending' | 'approved' | 'rejected' | 'resubmission_required';
          rejection_reason: string | null;
          submitted_at: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          aadhaar_photo_url: string;
          pan_photo_url: string;
          selfie_url: string;
          pan_number: string;
          aadhaar_last_4: string;
          bank_account_number?: string | null;
          bank_ifsc?: string | null;
          upi_id?: string | null;
          status: 'pending' | 'approved' | 'rejected' | 'resubmission_required';
          rejection_reason?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
        };
        Update: Partial<Database['public']['Tables']['kyc_submissions']['Insert']>;
        Relationships: [];
      };
      payouts: {
        Row: {
          id: string;
          user_id: string;
          amount_paise: number;
          status: 'pending' | 'processing' | 'completed' | 'failed';
          bank_or_upi: string;
          razorpay_payout_id: string | null;
          booking_ids: string[];
          created_at: string;
          processed_at: string | null;
          failed_reason: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          amount_paise: number;
          status: 'pending' | 'processing' | 'completed' | 'failed';
          bank_or_upi: string;
          razorpay_payout_id?: string | null;
          booking_ids: string[];
          processed_at?: string | null;
          failed_reason?: string | null;
        };
        Update: Partial<Database['public']['Tables']['payouts']['Insert']>;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          data: Record<string, unknown>;
          read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          data?: Record<string, unknown>;
          read?: boolean;
        };
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>;
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
      create_booking_with_payment: {
        Args: {
          p_charger_id: string;
          p_driver_id: string;
          p_lender_id: string;
          p_scheduled_start: string;
          p_scheduled_end: string;
          p_confirmation_code: string;
          p_gross_amount: number;
          p_platform_fee: number;
          p_lender_payout: number;
          p_razorpay_order_id: string;
          p_razorpay_payment_id: string;
        };
        Returns: string; // new booking UUID
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
