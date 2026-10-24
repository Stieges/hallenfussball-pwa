/**
 * Supabase Database Types
 *
 * Auto-generiert aus dem Live-Schema (project: amtlqicosscsjnnthvzm).
 * Letzte Regeneration: 2026-10-24, nach dem Einspielen von 20261117_005 (A-35 Klaerungsliste: match_reviews,
 * field_control_log, revoked_device_contacts, list_match_reviews) -- aus Produktion per Supabase-MCP
 * (generate_typescript_types), nicht aus einem Wegwerf-Container. Damit ist die Datei wieder
 * deckungsgleich mit der Produktion. PostgrestVersion "14.1": so liefern sie seit dem 23.10.
 * MCP-Werkzeug UND CLI (Typ-Drift-Check, Lauf 40012473086, Live-Seite "14.1").
 * NICHT MANUELL BEARBEITEN!
 *
 * Regenerieren mit:
 * npx supabase gen types typescript --project-id amtlqicosscsjnnthvzm > src/types/supabase.ts
 * (Kopf danach wieder voranstellen — der Drift-Check blendet ihn beidseitig aus.)
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      app_config: {
        Row: {
          key: string
          value: Json
        }
        Insert: {
          key: string
          value: Json
        }
        Update: {
          key?: string
          value?: Json
        }
        Relationships: []
      }
      bracket_log: {
        Row: {
          actor: string | null
          created_at: string
          detail: Json
          group_id: string | null
          id: number
          kind: string
          match_id: string | null
          reason: string | null
          tournament_id: string
        }
        Insert: {
          actor?: string | null
          created_at?: string
          detail?: Json
          group_id?: string | null
          id?: never
          kind: string
          match_id?: string | null
          reason?: string | null
          tournament_id: string
        }
        Update: {
          actor?: string | null
          created_at?: string
          detail?: Json
          group_id?: string | null
          id?: never
          kind?: string
          match_id?: string | null
          reason?: string | null
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bracket_log_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bracket_log_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      bracket_notices: {
        Row: {
          created_at: string
          current_team_id: string | null
          id: number
          kind: string
          match_id: string
          origin_team_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          side: string
          tournament_id: string
        }
        Insert: {
          created_at?: string
          current_team_id?: string | null
          id?: never
          kind: string
          match_id: string
          origin_team_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          side: string
          tournament_id: string
        }
        Update: {
          created_at?: string
          current_team_id?: string | null
          id?: never
          kind?: string
          match_id?: string
          origin_team_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          side?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bracket_notices_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bracket_notices_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      clarifications: {
        Row: {
          conflict_code: string
          created_at: string
          group_id: string | null
          id: number
          kind: string
          match_id: string | null
          requested: Json
          requested_by: string
          resolved_at: string | null
          resolved_by: string | null
          server_last: Json | null
          tournament_id: string
        }
        Insert: {
          conflict_code: string
          created_at?: string
          group_id?: string | null
          id?: never
          kind: string
          match_id?: string | null
          requested: Json
          requested_by: string
          resolved_at?: string | null
          resolved_by?: string | null
          server_last?: Json | null
          tournament_id: string
        }
        Update: {
          conflict_code?: string
          created_at?: string
          group_id?: string | null
          id?: never
          kind?: string
          match_id?: string | null
          requested?: Json
          requested_by?: string
          resolved_at?: string | null
          resolved_by?: string | null
          server_last?: Json | null
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clarifications_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clarifications_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      device_outbox_reports: {
        Row: {
          device_id: string
          field: number | null
          pending: number
          reported_at: string
          tournament_id: string
          user_id: string
        }
        Insert: {
          device_id: string
          field?: number | null
          pending: number
          reported_at?: string
          tournament_id: string
          user_id: string
        }
        Update: {
          device_id?: string
          field?: number | null
          pending?: number
          reported_at?: string
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_outbox_reports_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      field_control: {
        Row: {
          claimed_at: string
          epoch: number
          field: number
          holder_device_id: string | null
          holder_device_label: string | null
          holder_user_id: string | null
          tournament_id: string
        }
        Insert: {
          claimed_at?: string
          epoch?: number
          field: number
          holder_device_id?: string | null
          holder_device_label?: string | null
          holder_user_id?: string | null
          tournament_id: string
        }
        Update: {
          claimed_at?: string
          epoch?: number
          field?: number
          holder_device_id?: string | null
          holder_device_label?: string | null
          holder_user_id?: string | null
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_control_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      field_control_log: {
        Row: {
          claimed_at: string
          epoch: number
          field: number
          holder_device_id: string | null
          holder_user_id: string | null
          tournament_id: string
        }
        Insert: {
          claimed_at: string
          epoch: number
          field: number
          holder_device_id?: string | null
          holder_user_id?: string | null
          tournament_id: string
        }
        Update: {
          claimed_at?: string
          epoch?: number
          field?: number
          holder_device_id?: string | null
          holder_user_id?: string | null
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_control_log_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      group_completions: {
        Row: {
          based_on_state: Json
          completed_at: string
          completed_by: string
          group_id: string
          open_ranks: number[]
          ranking: string[]
          reopened_at: string | null
          reopened_by: string | null
          stale: boolean
          tie_orders: Json
          tournament_id: string
        }
        Insert: {
          based_on_state: Json
          completed_at?: string
          completed_by: string
          group_id: string
          open_ranks?: number[]
          ranking: string[]
          reopened_at?: string | null
          reopened_by?: string | null
          stale?: boolean
          tie_orders?: Json
          tournament_id: string
        }
        Update: {
          based_on_state?: Json
          completed_at?: string
          completed_by?: string
          group_id?: string
          open_ranks?: number[]
          ranking?: string[]
          reopened_at?: string | null
          reopened_by?: string | null
          stale?: boolean
          tie_orders?: Json
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_completions_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      late_entries: {
        Row: {
          actor: string
          device_id: string | null
          event: Json
          event_id: string
          id: number
          match_id: string
          received_at: string
          resolved_at: string | null
          resolved_by: string | null
          tournament_id: string
        }
        Insert: {
          actor: string
          device_id?: string | null
          event: Json
          event_id: string
          id?: never
          match_id: string
          received_at?: string
          resolved_at?: string | null
          resolved_by?: string | null
          tournament_id: string
        }
        Update: {
          actor?: string
          device_id?: string | null
          event?: Json
          event_id?: string
          id?: never
          match_id?: string
          received_at?: string
          resolved_at?: string | null
          resolved_by?: string | null
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "late_entries_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "late_entries_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      match_corrections: {
        Row: {
          corrected_at: string | null
          corrected_by: string | null
          id: string
          is_public: boolean | null
          match_id: string
          new_score_a: number
          new_score_b: number
          note: string | null
          owner_id: string | null
          previous_score_a: number
          previous_score_b: number
          reason_type: string | null
        }
        Insert: {
          corrected_at?: string | null
          corrected_by?: string | null
          id?: string
          is_public?: boolean | null
          match_id: string
          new_score_a: number
          new_score_b: number
          note?: string | null
          owner_id?: string | null
          previous_score_a: number
          previous_score_b: number
          reason_type?: string | null
        }
        Update: {
          corrected_at?: string | null
          corrected_by?: string | null
          id?: string
          is_public?: boolean | null
          match_id?: string
          new_score_a?: number
          new_score_b?: number
          note?: string | null
          owner_id?: string | null
          previous_score_a?: number
          previous_score_b?: number
          reason_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_corrections_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_event_authors: {
        Row: {
          base_state: Json | null
          created_at: string | null
          device_id: string | null
          event_id: string
          tournament_id: string
          user_id: string | null
        }
        Insert: {
          base_state?: Json | null
          created_at?: string | null
          device_id?: string | null
          event_id: string
          tournament_id: string
          user_id?: string | null
        }
        Update: {
          base_state?: Json | null
          created_at?: string | null
          device_id?: string | null
          event_id?: string
          tournament_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_event_authors_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "match_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_event_authors_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      match_events: {
        Row: {
          base_seq: number | null
          client_time: string | null
          clock_ms: number | null
          control_epoch: number | null
          created_at: string | null
          event_format: number | null
          id: string
          incomplete: boolean | null
          is_deleted: boolean | null
          is_public: boolean | null
          match_id: string
          owner_id: string | null
          payload: Json
          period: string | null
          player_id: string | null
          recorded_at: string | null
          review_state: string | null
          score_away: number
          score_home: number
          section: number | null
          seq: number
          target_event_id: string | null
          team_id: string | null
          timestamp_seconds: number
          type: string
          version: number
        }
        Insert: {
          base_seq?: number | null
          client_time?: string | null
          clock_ms?: number | null
          control_epoch?: number | null
          created_at?: string | null
          event_format?: number | null
          id?: string
          incomplete?: boolean | null
          is_deleted?: boolean | null
          is_public?: boolean | null
          match_id: string
          owner_id?: string | null
          payload?: Json
          period?: string | null
          player_id?: string | null
          recorded_at?: string | null
          review_state?: string | null
          score_away: number
          score_home: number
          section?: number | null
          seq?: never
          target_event_id?: string | null
          team_id?: string | null
          timestamp_seconds: number
          type: string
          version?: number
        }
        Update: {
          base_seq?: number | null
          client_time?: string | null
          clock_ms?: number | null
          control_epoch?: number | null
          created_at?: string | null
          event_format?: number | null
          id?: string
          incomplete?: boolean | null
          is_deleted?: boolean | null
          is_public?: boolean | null
          match_id?: string
          owner_id?: string | null
          payload?: Json
          period?: string | null
          player_id?: string | null
          recorded_at?: string | null
          review_state?: string | null
          score_away?: number
          score_home?: number
          section?: number | null
          seq?: never
          target_event_id?: string | null
          team_id?: string | null
          timestamp_seconds?: number
          type?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "match_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "team_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_target_event_id_fkey"
            columns: ["target_event_id"]
            isOneToOne: false
            referencedRelation: "match_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      match_reviews: {
        Row: {
          created_at: string
          detail: Json
          device_id: string | null
          event_id: string
          field: number | null
          kind: string
          match_id: string
          reason: string
          tournament_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          detail?: Json
          device_id?: string | null
          event_id: string
          field?: number | null
          kind: string
          match_id: string
          reason: string
          tournament_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          detail?: Json
          device_id?: string | null
          event_id?: string
          field?: number | null
          kind?: string
          match_id?: string
          reason?: string
          tournament_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_reviews_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "match_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_reviews_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_reviews_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      match_transitions: {
        Row: {
          actor: string
          event_type: string
          from_status: string
          to_status: string
        }
        Insert: {
          actor: string
          event_type: string
          from_status: string
          to_status: string
        }
        Update: {
          actor?: string
          event_type?: string
          from_status?: string
          to_status?: string
        }
        Relationships: []
      }
      matches: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          bib_side: string | null
          created_at: string | null
          decided_by: string | null
          duration_minutes: number | null
          field: number
          final_type: string | null
          forfeit_absent: string | null
          group_letter: string | null
          id: string
          is_final: boolean | null
          is_public: boolean | null
          kit_color_a: string | null
          kit_color_b: string | null
          label: string | null
          last_modified_by: string | null
          live_state: Json | null
          match_number: number | null
          match_status: string | null
          origin_a: Json | null
          origin_b: Json | null
          original_start: string | null
          overtime_score_a: number | null
          overtime_score_b: number | null
          owner_id: string | null
          penalty_score_a: number | null
          penalty_score_b: number | null
          phase: string | null
          reassigned_at: string | null
          referee_number: number | null
          referee_team_id: string | null
          round: number
          scheduled_start: string | null
          score_a: number | null
          score_b: number | null
          skipped_at: string | null
          skipped_reason: string | null
          slot: number | null
          slot_a_source: Json | null
          slot_b_source: Json | null
          team_a_id: string | null
          team_a_placeholder: string | null
          team_b_id: string | null
          team_b_placeholder: string | null
          timer_elapsed_seconds: number | null
          timer_paused_at: string | null
          timer_start_time: string | null
          tournament_id: string
          updated_at: string | null
          version: number | null
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          bib_side?: string | null
          created_at?: string | null
          decided_by?: string | null
          duration_minutes?: number | null
          field: number
          final_type?: string | null
          forfeit_absent?: string | null
          group_letter?: string | null
          id?: string
          is_final?: boolean | null
          is_public?: boolean | null
          kit_color_a?: string | null
          kit_color_b?: string | null
          label?: string | null
          last_modified_by?: string | null
          live_state?: Json | null
          match_number?: number | null
          match_status?: string | null
          origin_a?: Json | null
          origin_b?: Json | null
          original_start?: string | null
          overtime_score_a?: number | null
          overtime_score_b?: number | null
          owner_id?: string | null
          penalty_score_a?: number | null
          penalty_score_b?: number | null
          phase?: string | null
          reassigned_at?: string | null
          referee_number?: number | null
          referee_team_id?: string | null
          round: number
          scheduled_start?: string | null
          score_a?: number | null
          score_b?: number | null
          skipped_at?: string | null
          skipped_reason?: string | null
          slot?: number | null
          slot_a_source?: Json | null
          slot_b_source?: Json | null
          team_a_id?: string | null
          team_a_placeholder?: string | null
          team_b_id?: string | null
          team_b_placeholder?: string | null
          timer_elapsed_seconds?: number | null
          timer_paused_at?: string | null
          timer_start_time?: string | null
          tournament_id: string
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          bib_side?: string | null
          created_at?: string | null
          decided_by?: string | null
          duration_minutes?: number | null
          field?: number
          final_type?: string | null
          forfeit_absent?: string | null
          group_letter?: string | null
          id?: string
          is_final?: boolean | null
          is_public?: boolean | null
          kit_color_a?: string | null
          kit_color_b?: string | null
          label?: string | null
          last_modified_by?: string | null
          live_state?: Json | null
          match_number?: number | null
          match_status?: string | null
          origin_a?: Json | null
          origin_b?: Json | null
          original_start?: string | null
          overtime_score_a?: number | null
          overtime_score_b?: number | null
          owner_id?: string | null
          penalty_score_a?: number | null
          penalty_score_b?: number | null
          phase?: string | null
          reassigned_at?: string | null
          referee_number?: number | null
          referee_team_id?: string | null
          round?: number
          scheduled_start?: string | null
          score_a?: number | null
          score_b?: number | null
          skipped_at?: string | null
          skipped_reason?: string | null
          slot?: number | null
          slot_a_source?: Json | null
          slot_b_source?: Json | null
          team_a_id?: string | null
          team_a_placeholder?: string | null
          team_b_id?: string | null
          team_b_placeholder?: string | null
          timer_elapsed_seconds?: number | null
          timer_paused_at?: string | null
          timer_start_time?: string | null
          tournament_id?: string
          updated_at?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_referee_team_id_fkey"
            columns: ["referee_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_team_a_id_fkey"
            columns: ["team_a_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_team_b_id_fkey"
            columns: ["team_b_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      monitor_heartbeats: {
        Row: {
          cache_status: string | null
          created_at: string | null
          last_seen: string
          monitor_id: string
          slide_index: number | null
          tournament_id: string
          user_agent: string | null
          wake_lock: string | null
        }
        Insert: {
          cache_status?: string | null
          created_at?: string | null
          last_seen?: string
          monitor_id: string
          slide_index?: number | null
          tournament_id: string
          user_agent?: string | null
          wake_lock?: string | null
        }
        Update: {
          cache_status?: string | null
          created_at?: string | null
          last_seen?: string
          monitor_id?: string
          slide_index?: number | null
          tournament_id?: string
          user_agent?: string | null
          wake_lock?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "monitor_heartbeats_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      monitors: {
        Row: {
          access_code: string | null
          config: Json
          created_at: string | null
          id: string
          is_active: boolean | null
          is_public: boolean | null
          name: string
          owner_id: string | null
          tournament_id: string
          type: string
          updated_at: string | null
          version: number
        }
        Insert: {
          access_code?: string | null
          config?: Json
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_public?: boolean | null
          name: string
          owner_id?: string | null
          tournament_id: string
          type?: string
          updated_at?: string | null
          version?: number
        }
        Update: {
          access_code?: string | null
          config?: Json
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_public?: boolean | null
          name?: string
          owner_id?: string | null
          tournament_id?: string
          type?: string
          updated_at?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "monitors_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          auth_provider: string | null
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          email: string | null
          id: string
          preferences: Json | null
          role: string
          updated_at: string | null
        }
        Insert: {
          auth_provider?: string | null
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          id: string
          preferences?: Json | null
          role?: string
          updated_at?: string | null
        }
        Update: {
          auth_provider?: string | null
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          preferences?: Json | null
          role?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      revoked_device_contacts: {
        Row: {
          first_contact_at: string
          first_device_id: string | null
          revoked_since: string | null
          tournament_id: string
          user_id: string
        }
        Insert: {
          first_contact_at?: string
          first_device_id?: string | null
          revoked_since?: string | null
          tournament_id: string
          user_id: string
        }
        Update: {
          first_contact_at?: string
          first_device_id?: string | null
          revoked_since?: string | null
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "revoked_device_contacts_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission: string
          role: string
        }
        Insert: {
          permission: string
          role: string
        }
        Update: {
          permission?: string
          role?: string
        }
        Relationships: []
      }
      sponsors: {
        Row: {
          clicks: number | null
          created_at: string | null
          display_order: number | null
          id: string
          impressions: number | null
          is_active: boolean | null
          is_public: boolean | null
          logo_path: string | null
          name: string
          owner_id: string | null
          show_on_monitor: boolean | null
          show_on_pdf: boolean | null
          show_on_schedule: boolean | null
          tier: string | null
          tournament_id: string
          updated_at: string | null
          version: number
          website_url: string | null
        }
        Insert: {
          clicks?: number | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          impressions?: number | null
          is_active?: boolean | null
          is_public?: boolean | null
          logo_path?: string | null
          name: string
          owner_id?: string | null
          show_on_monitor?: boolean | null
          show_on_pdf?: boolean | null
          show_on_schedule?: boolean | null
          tier?: string | null
          tournament_id: string
          updated_at?: string | null
          version?: number
          website_url?: string | null
        }
        Update: {
          clicks?: number | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          impressions?: number | null
          is_active?: boolean | null
          is_public?: boolean | null
          logo_path?: string | null
          name?: string
          owner_id?: string | null
          show_on_monitor?: boolean | null
          show_on_pdf?: boolean | null
          show_on_schedule?: boolean | null
          tier?: string | null
          tournament_id?: string
          updated_at?: string | null
          version?: number
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sponsors_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_queue: {
        Row: {
          base_data: Json | null
          base_version: number | null
          changed_fields: string[]
          conflict_data: Json | null
          conflict_resolution: string | null
          conflicting_fields: string[] | null
          created_at: string | null
          error_message: string | null
          id: string
          local_timestamp: string
          operation: string
          payload: Json
          processed_at: string | null
          record_id: string
          resolved_at: string | null
          retry_count: number | null
          server_timestamp: string | null
          status: string | null
          table_name: string
          user_id: string
        }
        Insert: {
          base_data?: Json | null
          base_version?: number | null
          changed_fields?: string[]
          conflict_data?: Json | null
          conflict_resolution?: string | null
          conflicting_fields?: string[] | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          local_timestamp: string
          operation: string
          payload: Json
          processed_at?: string | null
          record_id: string
          resolved_at?: string | null
          retry_count?: number | null
          server_timestamp?: string | null
          status?: string | null
          table_name: string
          user_id: string
        }
        Update: {
          base_data?: Json | null
          base_version?: number | null
          changed_fields?: string[]
          conflict_data?: Json | null
          conflict_resolution?: string | null
          conflicting_fields?: string[] | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          local_timestamp?: string
          operation?: string
          payload?: Json
          processed_at?: string | null
          record_id?: string
          resolved_at?: string | null
          retry_count?: number | null
          server_timestamp?: string | null
          status?: string | null
          table_name?: string
          user_id?: string
        }
        Relationships: []
      }
      team_players: {
        Row: {
          assists: number | null
          created_at: string | null
          goals: number | null
          id: string
          is_captain: boolean | null
          matches_played: number | null
          name: string | null
          number: number
          position: string | null
          red_cards: number | null
          team_id: string
          time_penalties_count: number | null
          time_penalties_minutes: number | null
          updated_at: string | null
          yellow_cards: number | null
        }
        Insert: {
          assists?: number | null
          created_at?: string | null
          goals?: number | null
          id?: string
          is_captain?: boolean | null
          matches_played?: number | null
          name?: string | null
          number: number
          position?: string | null
          red_cards?: number | null
          team_id: string
          time_penalties_count?: number | null
          time_penalties_minutes?: number | null
          updated_at?: string | null
          yellow_cards?: number | null
        }
        Update: {
          assists?: number | null
          created_at?: string | null
          goals?: number | null
          id?: string
          is_captain?: boolean | null
          matches_played?: number | null
          name?: string | null
          number?: number
          position?: string | null
          red_cards?: number | null
          team_id?: string
          time_penalties_count?: number | null
          time_penalties_minutes?: number | null
          updated_at?: string | null
          yellow_cards?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "team_players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          color_primary: string | null
          color_secondary: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          group_letter: string | null
          id: string
          is_public: boolean | null
          is_removed: boolean | null
          logo_background_color: string | null
          logo_path: string | null
          name: string
          owner_id: string | null
          removed_at: string | null
          removed_reason: string | null
          sort_order: number | null
          tournament_id: string
          updated_at: string | null
          version: number
        }
        Insert: {
          color_primary?: string | null
          color_secondary?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          group_letter?: string | null
          id?: string
          is_public?: boolean | null
          is_removed?: boolean | null
          logo_background_color?: string | null
          logo_path?: string | null
          name: string
          owner_id?: string | null
          removed_at?: string | null
          removed_reason?: string | null
          sort_order?: number | null
          tournament_id: string
          updated_at?: string | null
          version?: number
        }
        Update: {
          color_primary?: string | null
          color_secondary?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          group_letter?: string | null
          id?: string
          is_public?: boolean | null
          is_removed?: boolean | null
          logo_background_color?: string | null
          logo_path?: string | null
          name?: string
          owner_id?: string | null
          removed_at?: string | null
          removed_reason?: string | null
          sort_order?: number | null
          tournament_id?: string
          updated_at?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "teams_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_collaborators: {
        Row: {
          accepted_at: string | null
          allowed_fields: number[] | null
          allowed_groups: string[] | null
          created_at: string | null
          declined_at: string | null
          expires_at: string | null
          id: string
          invite_code: string | null
          invite_email: string | null
          invited_at: string | null
          invited_by: string | null
          label: string | null
          max_uses: number | null
          role: string
          team_ids: string[] | null
          tournament_id: string
          use_count: number | null
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          allowed_fields?: number[] | null
          allowed_groups?: string[] | null
          created_at?: string | null
          declined_at?: string | null
          expires_at?: string | null
          id?: string
          invite_code?: string | null
          invite_email?: string | null
          invited_at?: string | null
          invited_by?: string | null
          label?: string | null
          max_uses?: number | null
          role?: string
          team_ids?: string[] | null
          tournament_id: string
          use_count?: number | null
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          allowed_fields?: number[] | null
          allowed_groups?: string[] | null
          created_at?: string | null
          declined_at?: string | null
          expires_at?: string | null
          id?: string
          invite_code?: string | null
          invite_email?: string | null
          invited_at?: string | null
          invited_by?: string | null
          label?: string | null
          max_uses?: number | null
          role?: string
          team_ids?: string[] | null
          tournament_id?: string
          use_count?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_collaborators_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_final_standings: {
        Row: {
          finished_at: string
          finished_by: string
          request_id: string
          snapshot: Json
          tournament_id: string
        }
        Insert: {
          finished_at: string
          finished_by: string
          request_id: string
          snapshot: Json
          tournament_id: string
        }
        Update: {
          finished_at?: string
          finished_by?: string
          request_id?: string
          snapshot?: Json
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_final_standings_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: true
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_join_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          revoked_at: string | null
          revoked_by: string | null
          tournament_id: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          tournament_id: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_join_codes_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_join_requests: {
        Row: {
          check_number: number
          code: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decline_reason: string | null
          device_label: string | null
          device_user_id: string
          display_name: string
          id: string
          last_seen_at: string | null
          member_id: string | null
          status: string
          tournament_id: string
        }
        Insert: {
          check_number: number
          code: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decline_reason?: string | null
          device_label?: string | null
          device_user_id: string
          display_name: string
          id?: string
          last_seen_at?: string | null
          member_id?: string | null
          status?: string
          tournament_id: string
        }
        Update: {
          check_number?: number
          code?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decline_reason?: string | null
          device_label?: string | null
          device_user_id?: string
          display_name?: string
          id?: string
          last_seen_at?: string | null
          member_id?: string | null
          status?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_join_requests_code_fkey"
            columns: ["code"]
            isOneToOne: false
            referencedRelation: "tournament_join_codes"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "tournament_join_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "tournament_collaborators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_join_requests_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_lifecycle_log: {
        Row: {
          actor: string
          created_at: string
          finished_at_before: string | null
          id: number
          kind: string
          reason: string | null
          request_id: string
          tournament_id: string
        }
        Insert: {
          actor: string
          created_at?: string
          finished_at_before?: string | null
          id?: never
          kind: string
          reason?: string | null
          request_id: string
          tournament_id: string
        }
        Update: {
          actor?: string
          created_at?: string
          finished_at_before?: string | null
          id?: never
          kind?: string
          reason?: string | null
          request_id?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_lifecycle_log_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_templates: {
        Row: {
          config: Json
          created_at: string | null
          description: string | null
          id: string
          is_public: boolean | null
          name: string
          owner_id: string
          sport: string
          tags: string[] | null
          team_names: Json | null
          times_used: number | null
          updated_at: string | null
        }
        Insert: {
          config: Json
          created_at?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          name: string
          owner_id: string
          sport?: string
          tags?: string[] | null
          team_names?: Json | null
          times_used?: number | null
          updated_at?: string | null
        }
        Update: {
          config?: Json
          created_at?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          name?: string
          owner_id?: string
          sport?: string
          tags?: string[] | null
          team_names?: Json | null
          times_used?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      tournaments: {
        Row: {
          change_revision: number
          completed_at: string | null
          config: Json
          created_at: string | null
          date: string
          deleted_at: string | null
          final_round_break: number | null
          final_round_duration: number | null
          finals_config: Json | null
          finished_at: string | null
          group_phase_break: number | null
          group_phase_duration: number
          id: string
          is_public: boolean | null
          last_modified_by: string | null
          lifecycle_status: string
          location_city: string | null
          location_country: string | null
          location_name: string | null
          location_postal_code: string | null
          location_street: string | null
          number_of_fields: number
          number_of_groups: number | null
          number_of_teams: number
          owner_id: string
          point_system: Json
          referee_config: Json | null
          share_code: string | null
          share_code_created_at: string | null
          sport: string
          start_time: string | null
          status: string
          title: string
          tournament_type: string
          updated_at: string | null
          version: number | null
        }
        Insert: {
          change_revision?: number
          completed_at?: string | null
          config?: Json
          created_at?: string | null
          date: string
          deleted_at?: string | null
          final_round_break?: number | null
          final_round_duration?: number | null
          finals_config?: Json | null
          finished_at?: string | null
          group_phase_break?: number | null
          group_phase_duration: number
          id?: string
          is_public?: boolean | null
          last_modified_by?: string | null
          lifecycle_status?: string
          location_city?: string | null
          location_country?: string | null
          location_name?: string | null
          location_postal_code?: string | null
          location_street?: string | null
          number_of_fields?: number
          number_of_groups?: number | null
          number_of_teams: number
          owner_id: string
          point_system?: Json
          referee_config?: Json | null
          share_code?: string | null
          share_code_created_at?: string | null
          sport?: string
          start_time?: string | null
          status?: string
          title: string
          tournament_type?: string
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          change_revision?: number
          completed_at?: string | null
          config?: Json
          created_at?: string | null
          date?: string
          deleted_at?: string | null
          final_round_break?: number | null
          final_round_duration?: number | null
          finals_config?: Json | null
          finished_at?: string | null
          group_phase_break?: number | null
          group_phase_duration?: number
          id?: string
          is_public?: boolean | null
          last_modified_by?: string | null
          lifecycle_status?: string
          location_city?: string | null
          location_country?: string | null
          location_name?: string | null
          location_postal_code?: string | null
          location_street?: string | null
          number_of_fields?: number
          number_of_groups?: number | null
          number_of_teams?: number
          owner_id?: string
          point_system?: Json
          referee_config?: Json | null
          share_code?: string | null
          share_code_created_at?: string | null
          sport?: string
          start_time?: string | null
          status?: string
          title?: string
          tournament_type?: string
          updated_at?: string | null
          version?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      append_match_events: {
        Args: {
          p_client_format: number
          p_device_id?: string
          p_events: Json
          p_match_id: string
        }
        Returns: Json
      }
      auth_provider_for_email: { Args: { p_email: string }; Returns: string }
      bracket_log_read: {
        Args: { p_tournament_id: string }
        Returns: {
          actor_name: string
          actor_role: string
          created_at: string
          detail: Json
          group_id: string
          id: number
          kind: string
          match_id: string
          reason: string
        }[]
      }
      change_helper_access: {
        Args: { p_action: string; p_member_id: string }
        Returns: Json
      }
      complete_group: {
        Args: {
          p_expected_state: Json
          p_from_queue?: boolean
          p_group_id: string
          p_known_decision_ids: string[]
          p_open_ranks: number[]
          p_ranking: string[]
          p_tie_decisions: Json
          p_tournament_id: string
        }
        Returns: Json
      }
      compute_match_state: { Args: { p_match_id: string }; Returns: Json }
      decide_join_request: {
        Args: {
          p_accept: boolean
          p_check_number?: number
          p_field?: number
          p_request_id: string
        }
        Returns: Json
      }
      display_final_standings: {
        Args: { p_tournament_id: string }
        Returns: Json
      }
      display_tournament: {
        Args: {
          monitor_id: string
          since_version?: number
          tournament_id: string
        }
        Returns: Json
      }
      ensure_helper_code: { Args: { p_tournament_id: string }; Returns: Json }
      field_control_info: {
        Args: { p_device_id: string; p_field: number; p_tournament_id: string }
        Returns: Json
      }
      field_control_state: {
        Args: { p_device_id?: string; p_tournament_id: string }
        Returns: Json
      }
      finish_preflight: { Args: { p_tournament_id: string }; Returns: Json }
      finish_tournament: {
        Args: {
          p_expected_state: Json
          p_final_standings: Json
          p_request_id: string
          p_tournament_id: string
        }
        Returns: Json
      }
      generate_helper_code: { Args: never; Returns: string }
      generate_share_code: { Args: never; Returns: string }
      has_tournament_permission: {
        Args: { p_permission: string; p_tournament_id: string }
        Returns: boolean
      }
      helper_access_status: { Args: { p_tournament_id: string }; Returns: Json }
      helper_code_cutoff: { Args: { p_date: string }; Returns: string }
      helper_request_count: {
        Args: { p_tournament_id: string }
        Returns: number
      }
      hook_before_user_created: { Args: { event: Json }; Returns: Json }
      is_active_tournament_member: {
        Args: { p_tournament_id: string }
        Returns: boolean
      }
      is_device_membership: {
        Args: { p_member_id: string; p_role: string }
        Returns: boolean
      }
      is_reading_member: { Args: { p_tournament_id: string }; Returns: boolean }
      is_real_account: { Args: never; Returns: boolean }
      is_tournament_admin: {
        Args: { p_tournament_id: string }
        Returns: boolean
      }
      is_tournament_collaborator: {
        Args: { p_tournament_id: string }
        Returns: boolean
      }
      is_tournament_owner: {
        Args: { p_tournament_id: string }
        Returns: boolean
      }
      join_code_info: { Args: { p_code: string }; Returns: Json }
      list_helper_access: { Args: { p_tournament_id: string }; Returns: Json }
      list_match_reviews: { Args: { p_tournament_id: string }; Returns: Json }
      make_tournament_private: {
        Args: { tournament_id: string }
        Returns: undefined
      }
      make_tournament_public: {
        Args: { tournament_id: string }
        Returns: {
          share_code: string
          share_code_created_at: string
        }[]
      }
      match_apply_event: {
        Args: { ctx: Json; event: Json; state: Json; transitions: Json }
        Returns: Json
      }
      match_continue: {
        Args: {
          ctx: Json
          events: Json
          mode?: string
          state: Json
          transitions: Json
        }
        Returns: Json
      }
      match_event_author_devices: {
        Args: { p_match_id: string }
        Returns: {
          device_label: string
          event_id: string
        }[]
      }
      match_event_author_names: {
        Args: { p_match_id: string }
        Returns: {
          author_name: string
          author_role: string
          event_id: string
        }[]
      }
      match_has_engine_events: {
        Args: { p_match_id: string }
        Returns: boolean
      }
      match_initial_state: { Args: { ctx: Json }; Returns: Json }
      match_reduce: {
        Args: { ctx: Json; events: Json; mode?: string; transitions: Json }
        Returns: Json
      }
      match_server_state: { Args: { state: Json }; Returns: Json }
      merge_user_data: {
        Args: { p_source_user_id: string; p_target_user_id: string }
        Returns: Json
      }
      profile_visible_to_viewer: {
        Args: { p_profile_id: string }
        Returns: boolean
      }
      public_final_standings: { Args: { p_share_code: string }; Returns: Json }
      public_tournament: {
        Args: { share_code: string; since_version?: number }
        Returns: Json
      }
      record_monitor_heartbeat: {
        Args: {
          p_cache_status?: string
          p_monitor_key: string
          p_slide_index?: number
          p_tournament_id: string
          p_user_agent?: string
          p_wake_lock?: string
        }
        Returns: undefined
      }
      record_standing_decision: {
        Args: {
          p_action: string
          p_decision: Json
          p_expected_version: number
          p_reason: string
          p_tournament_id: string
        }
        Returns: Json
      }
      regenerate_share_code: {
        Args: { tournament_id: string }
        Returns: {
          share_code: string
          share_code_created_at: string
        }[]
      }
      reopen_group: {
        Args: {
          p_from_queue?: boolean
          p_group_id: string
          p_reason: string
          p_tournament_id: string
        }
        Returns: Json
      }
      reopen_tournament: {
        Args: {
          p_reason: string
          p_request_id: string
          p_tournament_id: string
        }
        Returns: Json
      }
      report_device_outbox: {
        Args: {
          p_device_id: string
          p_field: number
          p_pending: number
          p_tournament_id: string
        }
        Returns: undefined
      }
      request_helper_access: {
        Args: {
          p_code: string
          p_device_label?: string
          p_display_name: string
        }
        Returns: Json
      }
      reset_match_results: {
        Args: { p_match_ids: string[]; p_tournament_id: string }
        Returns: Json
      }
      resolve_bracket_notice: { Args: { p_notice_id: number }; Returns: Json }
      resolve_clarification: { Args: { p_id: number }; Returns: Json }
      rotate_helper_code: {
        Args: { p_open_requests?: string; p_tournament_id: string }
        Returns: Json
      }
      server_time: { Args: never; Returns: Json }
      take_field_control: {
        Args: {
          p_device_id: string
          p_device_label?: string
          p_expected_epoch?: number
          p_field: number
          p_tournament_id: string
        }
        Returns: Json
      }
      tournament_closed_for_helpers: {
        Args: { p_tournament_id: string }
        Returns: boolean
      }
      tournament_has_started: {
        Args: { p_tournament_id: string }
        Returns: boolean
      }
      tournament_is_closed: {
        Args: { p_tournament_id: string }
        Returns: boolean
      }
      tournament_lifecycle: {
        Args: { p_tournament_id: string }
        Returns: string
      }
      user_owns_tournament: {
        Args: { p_tournament_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
