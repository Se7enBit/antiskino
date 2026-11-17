export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      booking_events: {
        Row: {
          actor_kind: Database['public']['Enums']['booking_actor'];
          actor_user_id: string | null;
          at: string;
          booking_id: string;
          from_status: Database['public']['Enums']['booking_status'] | null;
          id: number;
          note: string | null;
          to_status: Database['public']['Enums']['booking_status'];
        };
        ComputedFields: never;
        Insert: {
          actor_kind: Database['public']['Enums']['booking_actor'];
          actor_user_id?: string | null;
          at?: string;
          booking_id: string;
          from_status?: Database['public']['Enums']['booking_status'] | null;
          id?: never;
          note?: string | null;
          to_status: Database['public']['Enums']['booking_status'];
        };
        Update: {
          actor_kind?: Database['public']['Enums']['booking_actor'];
          actor_user_id?: string | null;
          at?: string;
          booking_id?: string;
          from_status?: Database['public']['Enums']['booking_status'] | null;
          id?: never;
          note?: string | null;
          to_status?: Database['public']['Enums']['booking_status'];
        };
        Relationships: [
          {
            foreignKeyName: 'booking_events_booking_id_fkey';
            columns: ['booking_id'];
            isOneToOne: false;
            referencedRelation: 'bookings';
            referencedColumns: ['id'];
          },
        ];
      };
      bookings: {
        Row: {
          arrival: string;
          arrival_eta: string | null;
          assigned_pitch: string | null;
          camping_id: string;
          cancel_reason: string | null;
          cancellation_policy: Database['public']['Enums']['cancellation_policy'];
          commission_bps: number;
          commission_cents: number;
          created_at: string;
          currency: string;
          departure: string;
          due_online_cents: number;
          equipment: Database['public']['Enums']['equipment'];
          extras: NonNullable<Json>;
          guest_country: string;
          guest_email: string;
          guest_name: string;
          guest_note: string | null;
          guest_phone: string;
          hold_expires_at: string | null;
          id: string;
          internal_note: string | null;
          locale: string;
          manage_token_hash: string;
          nights: number | null;
          paid_cents: number;
          party: NonNullable<Json>;
          party_size: number;
          payment_mode: Database['public']['Enums']['payment_mode'];
          pitch_type_id: string;
          price_breakdown: NonNullable<Json>;
          ref: string;
          refunded_cents: number;
          request_expires_at: string | null;
          status: Database['public']['Enums']['booking_status'];
          total_cents: number;
          updated_at: string;
          user_id: string | null;
          vehicle_plate: string | null;
        };
        ComputedFields: never;
        Insert: {
          arrival: string;
          arrival_eta?: string | null;
          assigned_pitch?: string | null;
          camping_id: string;
          cancel_reason?: string | null;
          cancellation_policy: Database['public']['Enums']['cancellation_policy'];
          commission_bps: number;
          commission_cents: number;
          created_at?: string;
          currency?: string;
          departure: string;
          due_online_cents?: number;
          equipment: Database['public']['Enums']['equipment'];
          extras?: NonNullable<Json>;
          guest_country: string;
          guest_email: string;
          guest_name: string;
          guest_note?: string | null;
          guest_phone: string;
          hold_expires_at?: string | null;
          id?: string;
          internal_note?: string | null;
          locale: string;
          manage_token_hash: string;
          nights?: never;
          paid_cents?: number;
          party: NonNullable<Json>;
          party_size: number;
          payment_mode: Database['public']['Enums']['payment_mode'];
          pitch_type_id: string;
          price_breakdown: NonNullable<Json>;
          ref: string;
          refunded_cents?: number;
          request_expires_at?: string | null;
          status: Database['public']['Enums']['booking_status'];
          total_cents: number;
          updated_at?: string;
          user_id?: string | null;
          vehicle_plate?: string | null;
        };
        Update: {
          arrival?: string;
          arrival_eta?: string | null;
          assigned_pitch?: string | null;
          camping_id?: string;
          cancel_reason?: string | null;
          cancellation_policy?: Database['public']['Enums']['cancellation_policy'];
          commission_bps?: number;
          commission_cents?: number;
          created_at?: string;
          currency?: string;
          departure?: string;
          due_online_cents?: number;
          equipment?: Database['public']['Enums']['equipment'];
          extras?: NonNullable<Json>;
          guest_country?: string;
          guest_email?: string;
          guest_name?: string;
          guest_note?: string | null;
          guest_phone?: string;
          hold_expires_at?: string | null;
          id?: string;
          internal_note?: string | null;
          locale?: string;
          manage_token_hash?: string;
          nights?: never;
          paid_cents?: number;
          party?: NonNullable<Json>;
          party_size?: number;
          payment_mode?: Database['public']['Enums']['payment_mode'];
          pitch_type_id?: string;
          price_breakdown?: NonNullable<Json>;
          ref?: string;
          refunded_cents?: number;
          request_expires_at?: string | null;
          status?: Database['public']['Enums']['booking_status'];
          total_cents?: number;
          updated_at?: string;
          user_id?: string | null;
          vehicle_plate?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'bookings_camping_id_fkey';
            columns: ['camping_id'];
            isOneToOne: false;
            referencedRelation: 'campings';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bookings_pitch_type_id_fkey';
            columns: ['pitch_type_id'];
            isOneToOne: false;
            referencedRelation: 'pitch_types';
            referencedColumns: ['id'];
          },
        ];
      };
      camping_photos: {
        Row: {
          camping_id: string;
          created_at: string;
          id: string;
          sort: number;
          storage_path: string;
        };
        ComputedFields: never;
        Insert: {
          camping_id: string;
          created_at?: string;
          id?: string;
          sort?: number;
          storage_path: string;
        };
        Update: {
          camping_id?: string;
          created_at?: string;
          id?: string;
          sort?: number;
          storage_path?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'camping_photos_camping_id_fkey';
            columns: ['camping_id'];
            isOneToOne: false;
            referencedRelation: 'campings';
            referencedColumns: ['id'];
          },
        ];
      };
      campings: {
        Row: {
          address: string | null;
          amenities: string[];
          cancellation_policy: Database['public']['Enums']['cancellation_policy'];
          check_in_from: string | null;
          check_out_until: string | null;
          confirmation_mode: Database['public']['Enums']['confirmation_mode'];
          created_at: string;
          deposit_percent: number | null;
          descr: NonNullable<Json>;
          email: string | null;
          house_rules: NonNullable<Json>;
          id: string;
          lat: number | null;
          lng: number | null;
          name: string;
          partner_id: string;
          payment_mode: Database['public']['Enums']['payment_mode'];
          phone: string | null;
          region: string | null;
          request_expiry_hours: number;
          same_day_cutoff: string;
          short_descr: NonNullable<Json>;
          slug: string;
          status: Database['public']['Enums']['camping_status'];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          address?: string | null;
          amenities?: string[];
          cancellation_policy?: Database['public']['Enums']['cancellation_policy'];
          check_in_from?: string | null;
          check_out_until?: string | null;
          confirmation_mode?: Database['public']['Enums']['confirmation_mode'];
          created_at?: string;
          deposit_percent?: number | null;
          descr?: NonNullable<Json>;
          email?: string | null;
          house_rules?: NonNullable<Json>;
          id?: string;
          lat?: number | null;
          lng?: number | null;
          name: string;
          partner_id: string;
          payment_mode?: Database['public']['Enums']['payment_mode'];
          phone?: string | null;
          region?: string | null;
          request_expiry_hours?: number;
          same_day_cutoff?: string;
          short_descr?: NonNullable<Json>;
          slug: string;
          status?: Database['public']['Enums']['camping_status'];
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          amenities?: string[];
          cancellation_policy?: Database['public']['Enums']['cancellation_policy'];
          check_in_from?: string | null;
          check_out_until?: string | null;
          confirmation_mode?: Database['public']['Enums']['confirmation_mode'];
          created_at?: string;
          deposit_percent?: number | null;
          descr?: NonNullable<Json>;
          email?: string | null;
          house_rules?: NonNullable<Json>;
          id?: string;
          lat?: number | null;
          lng?: number | null;
          name?: string;
          partner_id?: string;
          payment_mode?: Database['public']['Enums']['payment_mode'];
          phone?: string | null;
          region?: string | null;
          request_expiry_hours?: number;
          same_day_cutoff?: string;
          short_descr?: NonNullable<Json>;
          slug?: string;
          status?: Database['public']['Enums']['camping_status'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'campings_partner_id_fkey';
            columns: ['partner_id'];
            isOneToOne: false;
            referencedRelation: 'partners';
            referencedColumns: ['id'];
          },
        ];
      };
      extras: {
        Row: {
          active: boolean;
          camping_id: string;
          id: string;
          max_qty: number;
          name: NonNullable<Json>;
          sort: number;
          unit: Database['public']['Enums']['extra_unit'];
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          camping_id: string;
          id?: string;
          max_qty?: number;
          name: NonNullable<Json>;
          sort?: number;
          unit: Database['public']['Enums']['extra_unit'];
        };
        Update: {
          active?: boolean;
          camping_id?: string;
          id?: string;
          max_qty?: number;
          name?: NonNullable<Json>;
          sort?: number;
          unit?: Database['public']['Enums']['extra_unit'];
        };
        Relationships: [
          {
            foreignKeyName: 'extras_camping_id_fkey';
            columns: ['camping_id'];
            isOneToOne: false;
            referencedRelation: 'campings';
            referencedColumns: ['id'];
          },
        ];
      };
      fees: {
        Row: {
          amount_cents: number;
          camping_id: string;
          id: string;
          name: NonNullable<Json>;
          unit: Database['public']['Enums']['fee_unit'];
        };
        ComputedFields: never;
        Insert: {
          amount_cents: number;
          camping_id: string;
          id?: string;
          name: NonNullable<Json>;
          unit: Database['public']['Enums']['fee_unit'];
        };
        Update: {
          amount_cents?: number;
          camping_id?: string;
          id?: string;
          name?: NonNullable<Json>;
          unit?: Database['public']['Enums']['fee_unit'];
        };
        Relationships: [
          {
            foreignKeyName: 'fees_camping_id_fkey';
            columns: ['camping_id'];
            isOneToOne: false;
            referencedRelation: 'campings';
            referencedColumns: ['id'];
          },
        ];
      };
      guest_categories: {
        Row: {
          camping_id: string;
          id: string;
          max_age: number | null;
          min_age: number;
          name: NonNullable<Json>;
          sort: number;
        };
        ComputedFields: never;
        Insert: {
          camping_id: string;
          id?: string;
          max_age?: number | null;
          min_age: number;
          name: NonNullable<Json>;
          sort?: number;
        };
        Update: {
          camping_id?: string;
          id?: string;
          max_age?: number | null;
          min_age?: number;
          name?: NonNullable<Json>;
          sort?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'guest_categories_camping_id_fkey';
            columns: ['camping_id'];
            isOneToOne: false;
            referencedRelation: 'campings';
            referencedColumns: ['id'];
          },
        ];
      };
      inventory_nights: {
        Row: {
          allotment: number;
          booked: number;
          closed: boolean;
          night: string;
          pitch_type_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          allotment: number;
          booked?: number;
          closed?: boolean;
          night: string;
          pitch_type_id: string;
          updated_at?: string;
        };
        Update: {
          allotment?: number;
          booked?: number;
          closed?: boolean;
          night?: string;
          pitch_type_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'inventory_nights_pitch_type_id_fkey';
            columns: ['pitch_type_id'];
            isOneToOne: false;
            referencedRelation: 'pitch_types';
            referencedColumns: ['id'];
          },
        ];
      };
      notification_queue: {
        Row: {
          attempts: number;
          audience: string;
          booking_id: string;
          channel: string;
          created_at: string;
          id: number;
          kind: string;
          last_error: string | null;
          next_attempt_at: string;
          sent_at: string | null;
          status: string;
        };
        ComputedFields: never;
        Insert: {
          attempts?: number;
          audience: string;
          booking_id: string;
          channel: string;
          created_at?: string;
          id?: never;
          kind: string;
          last_error?: string | null;
          next_attempt_at?: string;
          sent_at?: string | null;
          status?: string;
        };
        Update: {
          attempts?: number;
          audience?: string;
          booking_id?: string;
          channel?: string;
          created_at?: string;
          id?: never;
          kind?: string;
          last_error?: string | null;
          next_attempt_at?: string;
          sent_at?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notification_queue_booking_id_fkey';
            columns: ['booking_id'];
            isOneToOne: false;
            referencedRelation: 'bookings';
            referencedColumns: ['id'];
          },
        ];
      };
      partner_invites: {
        Row: {
          accepted_at: string | null;
          created_at: string;
          email: string;
          expires_at: string;
          id: string;
          partner_id: string;
          role: Database['public']['Enums']['partner_role'];
          token_hash: string;
        };
        ComputedFields: never;
        Insert: {
          accepted_at?: string | null;
          created_at?: string;
          email: string;
          expires_at: string;
          id?: string;
          partner_id: string;
          role: Database['public']['Enums']['partner_role'];
          token_hash: string;
        };
        Update: {
          accepted_at?: string | null;
          created_at?: string;
          email?: string;
          expires_at?: string;
          id?: string;
          partner_id?: string;
          role?: Database['public']['Enums']['partner_role'];
          token_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'partner_invites_partner_id_fkey';
            columns: ['partner_id'];
            isOneToOne: false;
            referencedRelation: 'partners';
            referencedColumns: ['id'];
          },
        ];
      };
      partner_members: {
        Row: {
          created_at: string;
          email_prefs: NonNullable<Json>;
          partner_id: string;
          role: Database['public']['Enums']['partner_role'];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          email_prefs?: NonNullable<Json>;
          partner_id: string;
          role: Database['public']['Enums']['partner_role'];
          user_id: string;
        };
        Update: {
          created_at?: string;
          email_prefs?: NonNullable<Json>;
          partner_id?: string;
          role?: Database['public']['Enums']['partner_role'];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'partner_members_partner_id_fkey';
            columns: ['partner_id'];
            isOneToOne: false;
            referencedRelation: 'partners';
            referencedColumns: ['id'];
          },
        ];
      };
      partners: {
        Row: {
          billing_email: string | null;
          commission_bps: number | null;
          created_at: string;
          id: string;
          legal_name: string | null;
          name: string;
          payout_account_ref: string | null;
          status: Database['public']['Enums']['partner_status'];
          updated_at: string;
          vat_number: string | null;
        };
        ComputedFields: never;
        Insert: {
          billing_email?: string | null;
          commission_bps?: number | null;
          created_at?: string;
          id?: string;
          legal_name?: string | null;
          name: string;
          payout_account_ref?: string | null;
          status?: Database['public']['Enums']['partner_status'];
          updated_at?: string;
          vat_number?: string | null;
        };
        Update: {
          billing_email?: string | null;
          commission_bps?: number | null;
          created_at?: string;
          id?: string;
          legal_name?: string | null;
          name?: string;
          payout_account_ref?: string | null;
          status?: Database['public']['Enums']['partner_status'];
          updated_at?: string;
          vat_number?: string | null;
        };
        Relationships: [];
      };
      pitch_types: {
        Row: {
          accepts: Database['public']['Enums']['equipment'][];
          active: boolean;
          camping_id: string;
          created_at: string;
          descr: NonNullable<Json>;
          id: string;
          included: NonNullable<Json>;
          max_people: number;
          name: NonNullable<Json>;
          photos: string[];
          size_m2: number | null;
          sort: number;
          unit_category: Database['public']['Enums']['unit_category'];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          accepts: Database['public']['Enums']['equipment'][];
          active?: boolean;
          camping_id: string;
          created_at?: string;
          descr?: NonNullable<Json>;
          id?: string;
          included?: NonNullable<Json>;
          max_people: number;
          name: NonNullable<Json>;
          photos?: string[];
          size_m2?: number | null;
          sort?: number;
          unit_category?: Database['public']['Enums']['unit_category'];
          updated_at?: string;
        };
        Update: {
          accepts?: Database['public']['Enums']['equipment'][];
          active?: boolean;
          camping_id?: string;
          created_at?: string;
          descr?: NonNullable<Json>;
          id?: string;
          included?: NonNullable<Json>;
          max_people?: number;
          name?: NonNullable<Json>;
          photos?: string[];
          size_m2?: number | null;
          sort?: number;
          unit_category?: Database['public']['Enums']['unit_category'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'pitch_types_camping_id_fkey';
            columns: ['camping_id'];
            isOneToOne: false;
            referencedRelation: 'campings';
            referencedColumns: ['id'];
          },
        ];
      };
      platform_settings: {
        Row: {
          default_commission_bps: number;
          id: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          default_commission_bps: number;
          id?: number;
          updated_at?: string;
        };
        Update: {
          default_commission_bps?: number;
          id?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      prices: {
        Row: {
          amount_cents: number;
          item_id: string;
          item_type: Database['public']['Enums']['price_item_type'];
          season_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount_cents: number;
          item_id: string;
          item_type: Database['public']['Enums']['price_item_type'];
          season_id: string;
        };
        Update: {
          amount_cents?: number;
          item_id?: string;
          item_type?: Database['public']['Enums']['price_item_type'];
          season_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'prices_season_id_fkey';
            columns: ['season_id'];
            isOneToOne: false;
            referencedRelation: 'seasons';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          country: string | null;
          created_at: string;
          full_name: string | null;
          id: string;
          is_platform_admin: boolean;
          locale: string;
          phone: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          country?: string | null;
          created_at?: string;
          full_name?: string | null;
          id: string;
          is_platform_admin?: boolean;
          locale?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          country?: string | null;
          created_at?: string;
          full_name?: string | null;
          id?: string;
          is_platform_admin?: boolean;
          locale?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      seasons: {
        Row: {
          camping_id: string;
          dates: unknown;
          id: string;
          min_nights: number;
          name: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          camping_id: string;
          dates: unknown;
          id?: string;
          min_nights?: number;
          name: NonNullable<Json>;
        };
        Update: {
          camping_id?: string;
          dates?: unknown;
          id?: string;
          min_nights?: number;
          name?: NonNullable<Json>;
        };
        Relationships: [
          {
            foreignKeyName: 'seasons_camping_id_fkey';
            columns: ['camping_id'];
            isOneToOne: false;
            referencedRelation: 'campings';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_partner_invite: { Args: { p_token: string }; Returns: Json };
      athens_today: { Args: Record<PropertyKey, never>; Returns: string };
      booking_view: { Args: { p_booking_id: string }; Returns: Json };
      camping_is_live: { Args: { p_camping_id: string }; Returns: boolean };
      camping_partner: { Args: { p_camping_id: string }; Returns: string };
      can_manage_camping_files: { Args: { p_object_name: string }; Returns: boolean };
      cancel_my_booking: {
        Args: { p_booking_id: string };
        Returns: Database['public']['Enums']['booking_status'];
      };
      check_night_range: {
        Args: { p_first_night: string; p_last_night: string };
        Returns: undefined;
      };
      claim_bookings: { Args: Record<PropertyKey, never>; Returns: number };
      complete_past_stays: { Args: Record<PropertyKey, never>; Returns: number };
      create_partner_invite: {
        Args: {
          p_email: string;
          p_partner_id: string;
          p_role: Database['public']['Enums']['partner_role'];
        };
        Returns: string;
      };
      expire_overdue_bookings: { Args: Record<PropertyKey, never>; Returns: number };
      guest_booking: { Args: { p_ref: string; p_token: string }; Returns: Json };
      guest_can_cancel: {
        Args: { p_arrival: string; p_status: Database['public']['Enums']['booking_status'] };
        Returns: boolean;
      };
      guest_cancel_booking: {
        Args: { p_ref: string; p_token: string };
        Returns: Database['public']['Enums']['booking_status'];
      };
      invite_token_hash: { Args: { p_token: string }; Returns: string };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_localized_text: { Args: { p_required?: boolean; p_value: Json }; Returns: boolean };
      is_partner_member: { Args: { p_partner_id: string }; Returns: boolean };
      is_partner_owner: { Args: { p_partner_id: string }; Returns: boolean };
      my_booking: { Args: { p_ref: string }; Returns: Json };
      new_booking_ref: { Args: Record<PropertyKey, never>; Returns: string };
      partner_booking_action: {
        Args: { p_action: string; p_booking_id: string; p_note: string };
        Returns: Database['public']['Enums']['booking_status'];
      };
      queue_booking_notifications: {
        Args: { p_booking_id: string; p_status: Database['public']['Enums']['booking_status'] };
        Returns: undefined;
      };
      record_booking_event: {
        Args: {
          p_actor: Database['public']['Enums']['booking_actor'];
          p_actor_user_id: string;
          p_booking_id: string;
          p_from: Database['public']['Enums']['booking_status'];
          p_note: string;
          p_to: Database['public']['Enums']['booking_status'];
        };
        Returns: undefined;
      };
      reserve_and_create_booking: {
        Args: {
          p_arrival: string;
          p_departure: string;
          p_equipment: Database['public']['Enums']['equipment'];
          p_extras: Json;
          p_guest: Json;
          p_manage_token_hash: string;
          p_party: Json;
          p_pitch_type_id: string;
          p_price_breakdown: Json;
          p_total_cents: number;
          p_user_id: string;
        };
        Returns: {
          booking_id: string;
          ref: string;
          request_expires_at: string;
          status: Database['public']['Enums']['booking_status'];
        }[];
      };
      sellable_pitch_types: {
        Args: {
          p_arrival: string;
          p_camping_id?: string;
          p_departure: string;
          p_equipment: Database['public']['Enums']['equipment'];
          p_party_size: number;
        };
        Returns: {
          camping_id: string;
          pitch_type_id: string;
        }[];
      };
      sellable_pitch_types_at: {
        Args: {
          p_arrival: string;
          p_camping_id?: string;
          p_departure: string;
          p_equipment: Database['public']['Enums']['equipment'];
          p_now: string;
          p_party_size: number;
        };
        Returns: {
          camping_id: string;
          pitch_type_id: string;
        }[];
      };
      set_allotment: {
        Args: {
          p_allotment: number;
          p_first_night: string;
          p_last_night: string;
          p_pitch_type_id: string;
        };
        Returns: number;
      };
      set_camping_status: {
        Args: { p_camping_id: string; p_status: Database['public']['Enums']['camping_status'] };
        Returns: undefined;
      };
      set_closed: {
        Args: {
          p_closed: boolean;
          p_first_night: string;
          p_last_night: string;
          p_pitch_type_id: string;
        };
        Returns: number;
      };
      set_season_prices: { Args: { p_prices: Json; p_season_id: string }; Returns: number };
      sha256_hex: { Args: { p_text: string }; Returns: string };
      transition_booking: {
        Args: {
          p_actor: Database['public']['Enums']['booking_actor'];
          p_actor_user_id: string;
          p_booking_id: string;
          p_note: string;
          p_to: Database['public']['Enums']['booking_status'];
        };
        Returns: Database['public']['Enums']['booking_status'];
      };
    };
    Enums: {
      booking_actor: 'guest' | 'partner' | 'admin' | 'system';
      booking_status:
        | 'held'
        | 'requested'
        | 'confirmed'
        | 'declined'
        | 'expired'
        | 'cancelled'
        | 'checked_in'
        | 'completed'
        | 'no_show';
      camping_status: 'draft' | 'live' | 'paused';
      cancellation_policy: 'flexible' | 'moderate' | 'strict';
      confirmation_mode: 'instant' | 'request';
      equipment: 'tent' | 'caravan' | 'camper';
      extra_unit: 'per_night' | 'per_stay';
      fee_unit: 'per_person_night' | 'per_pitch_night' | 'per_stay';
      partner_role: 'owner' | 'staff';
      partner_status: 'active' | 'suspended';
      payment_mode: 'on_site' | 'deposit' | 'full';
      price_item_type: 'pitch' | 'guest' | 'extra';
      unit_category: 'pitch';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      booking_actor: ['guest', 'partner', 'admin', 'system'],
      booking_status: [
        'held',
        'requested',
        'confirmed',
        'declined',
        'expired',
        'cancelled',
        'checked_in',
        'completed',
        'no_show',
      ],
      camping_status: ['draft', 'live', 'paused'],
      cancellation_policy: ['flexible', 'moderate', 'strict'],
      confirmation_mode: ['instant', 'request'],
      equipment: ['tent', 'caravan', 'camper'],
      extra_unit: ['per_night', 'per_stay'],
      fee_unit: ['per_person_night', 'per_pitch_night', 'per_stay'],
      partner_role: ['owner', 'staff'],
      partner_status: ['active', 'suspended'],
      payment_mode: ['on_site', 'deposit', 'full'],
      price_item_type: ['pitch', 'guest', 'extra'],
      unit_category: ['pitch'],
    },
  },
} as const;
