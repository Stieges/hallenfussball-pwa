/**
 * Supabase Database Types
 *
 * Auto-generiert aus dem Live-Schema (project: amtlqicosscsjnnthvzm)
 * Letzte Regeneration: 2026-09-28 (B3a, .superpowers/sdd/2026-09-25-pr-b-schreibweg/task-B3a-brief.md:
 * Funktionen der SQL-Rechenfunktion aus 20260928_002_match_engine.sql; davor B2 Fixrunde 1, Ruling G4)
 * -- ausnahmsweise NICHT aus Produktion (B2: `--local`; B3a: `--db-url` gegen einen Wegwerf-Container
 * supabase/postgres mit Baseline + allen neueren Migrationen; nicht `--project-id`), weil
 * supabase/migrations/20260928_001_match_event_log.sql und 20260928_002_match_engine.sql noch NICHT
 * in Produktion eingespielt sind
 * (nur lokal/Container, siehe Kopfkommentar dieser Migration). Diese Datei ist damit bewusst der
 * Produktion voraus (match_event_authors/match_transitions/app_config + neue match_events-Spalten).
 * WICHTIG (I4, korrigiert): Der Typ-Drift-Check (.github/workflows/supabase-drift-check.yml, Job
 * "drift-check") vergleicht die per `--project-id` erzeugten Typen byteweise nach `strip_header`
 * -- er bleibt deshalb ROT, bis (1) diese Migration in Produktion angewendet UND (2) diese Datei
 * danach regulär mit `--project-id` (nicht `--local`) neu erzeugt wurde. Das ist erwartet, keine
 * Aussage über das Schema selbst (scripts/db-drift-check.sh prüft das Schema unabhängig davon).
 * Controller-Checkliste beim Live-Apply: (1) Migration anwenden, (2) diese Datei mit
 * --project-id neu erzeugen und committen.
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
    PostgrestVersion: "14.5"
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
          created_at: string | null
          decided_by: string | null
          duration_minutes: number | null
          field: number
          final_type: string | null
          group_letter: string | null
          id: string
          is_final: boolean | null
          is_public: boolean | null
          label: string | null
          last_modified_by: string | null
          live_state: Json | null
          match_number: number | null
          match_status: string | null
          overtime_score_a: number | null
          overtime_score_b: number | null
          owner_id: string | null
          penalty_score_a: number | null
          penalty_score_b: number | null
          phase: string | null
          referee_number: number | null
          referee_team_id: string | null
          round: number
          scheduled_start: string | null
          score_a: number | null
          score_b: number | null
          skipped_at: string | null
          skipped_reason: string | null
          slot: number | null
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
          created_at?: string | null
          decided_by?: string | null
          duration_minutes?: number | null
          field: number
          final_type?: string | null
          group_letter?: string | null
          id?: string
          is_final?: boolean | null
          is_public?: boolean | null
          label?: string | null
          last_modified_by?: string | null
          live_state?: Json | null
          match_number?: number | null
          match_status?: string | null
          overtime_score_a?: number | null
          overtime_score_b?: number | null
          owner_id?: string | null
          penalty_score_a?: number | null
          penalty_score_b?: number | null
          phase?: string | null
          referee_number?: number | null
          referee_team_id?: string | null
          round: number
          scheduled_start?: string | null
          score_a?: number | null
          score_b?: number | null
          skipped_at?: string | null
          skipped_reason?: string | null
          slot?: number | null
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
          created_at?: string | null
          decided_by?: string | null
          duration_minutes?: number | null
          field?: number
          final_type?: string | null
          group_letter?: string | null
          id?: string
          is_final?: boolean | null
          is_public?: boolean | null
          label?: string | null
          last_modified_by?: string | null
          live_state?: Json | null
          match_number?: number | null
          match_status?: string | null
          overtime_score_a?: number | null
          overtime_score_b?: number | null
          owner_id?: string | null
          penalty_score_a?: number | null
          penalty_score_b?: number | null
          phase?: string | null
          referee_number?: number | null
          referee_team_id?: string | null
          round?: number
          scheduled_start?: string | null
          score_a?: number | null
          score_b?: number | null
          skipped_at?: string | null
          skipped_reason?: string | null
          slot?: number | null
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
        }
        Insert: {
          cache_status?: string | null
          created_at?: string | null
          last_seen?: string
          monitor_id: string
          slide_index?: number | null
          tournament_id: string
          user_agent?: string | null
        }
        Update: {
          cache_status?: string | null
          created_at?: string | null
          last_seen?: string
          monitor_id?: string
          slide_index?: number | null
          tournament_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "monitor_heartbeats_monitor_id_fkey"
            columns: ["monitor_id"]
            isOneToOne: true
            referencedRelation: "monitors"
            referencedColumns: ["id"]
          },
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
          completed_at: string | null
          config: Json
          created_at: string | null
          date: string
          deleted_at: string | null
          final_round_break: number | null
          final_round_duration: number | null
          finals_config: Json | null
          group_phase_break: number | null
          group_phase_duration: number
          id: string
          is_public: boolean | null
          last_modified_by: string | null
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
          completed_at?: string | null
          config?: Json
          created_at?: string | null
          date: string
          deleted_at?: string | null
          final_round_break?: number | null
          final_round_duration?: number | null
          finals_config?: Json | null
          group_phase_break?: number | null
          group_phase_duration: number
          id?: string
          is_public?: boolean | null
          last_modified_by?: string | null
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
          completed_at?: string | null
          config?: Json
          created_at?: string | null
          date?: string
          deleted_at?: string | null
          final_round_break?: number | null
          final_round_duration?: number | null
          finals_config?: Json | null
          group_phase_break?: number | null
          group_phase_duration?: number
          id?: string
          is_public?: boolean | null
          last_modified_by?: string | null
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
      anonymous_tournament_limit: { Args: never; Returns: number }
      auth_provider_for_email: { Args: { p_email: string }; Returns: string }
      can_create_tournament: { Args: never; Returns: Json }
      compute_match_state: { Args: { p_match_id: string }; Returns: Json }
      count_active_tournaments: { Args: { user_id: string }; Returns: number }
      generate_share_code: { Args: never; Returns: string }
      has_tournament_permission: {
        Args: { p_permission: string; p_tournament_id: string }
        Returns: boolean
      }
      is_active_tournament_member: {
        Args: { p_tournament_id: string }
        Returns: boolean
      }
      is_anonymous_user: { Args: never; Returns: boolean }
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
      match__adjust_clock: {
        Args: { p_clock: Json; p_event: Json }
        Returns: Json
      }
      match__apply_correction: {
        Args: { p_ctx: Json; p_event: Json; p_state: Json }
        Returns: Json
      }
      match__apply_effect: {
        Args: { p_ctx: Json; p_event: Json; p_state: Json }
        Returns: Json
      }
      match__apply_goal: {
        Args: { p_ctx: Json; p_event: Json; p_state: Json }
        Returns: Json
      }
      match__apply_result_entry: {
        Args: { p_ctx: Json; p_event: Json; p_state: Json }
        Returns: Json
      }
      match__apply_retract: {
        Args: { p_ctx: Json; p_event: Json; p_state: Json }
        Returns: Json
      }
      match__apply_section_end: {
        Args: { p_event: Json; p_state: Json }
        Returns: Json
      }
      match__apply_section_start: {
        Args: { p_event: Json; p_state: Json }
        Returns: Json
      }
      match__apply_shootout_end: {
        Args: { p_ctx: Json; p_event: Json; p_state: Json }
        Returns: Json
      }
      match__apply_shootout_kick: {
        Args: { p_ctx: Json; p_event: Json; p_state: Json }
        Returns: Json
      }
      match__canonical: { Args: { p_event: Json }; Returns: Json }
      match__computed_score: {
        Args: { p_state: Json; p_team: string }
        Returns: number
      }
      match__decided_by: { Args: { p_state: Json }; Returns: Json }
      match__effective_score: {
        Args: { p_state: Json; p_team: string }
        Returns: number
      }
      match__effective_scores: {
        Args: { p_ctx: Json; p_state: Json }
        Returns: Json
      }
      match__endcheck: {
        Args: { p_ctx: Json; p_event: Json; p_state: Json }
        Returns: Json
      }
      match__enter_decision: {
        Args: { p_mode: string; p_state: Json }
        Returns: Json
      }
      match__is_int: { Args: { p_value: Json }; Returns: boolean }
      match__is_nonneg_int: { Args: { p_value: Json }; Returns: boolean }
      match__num: { Args: { p_value: Json }; Returns: number }
      match__ok: { Args: { p_state: Json }; Returns: Json }
      match__opt_nonneg_int: {
        Args: { p_key: string; p_payload: Json }
        Returns: boolean
      }
      match__payload_valid: {
        Args: { p_ctx: Json; p_event: Json }
        Returns: boolean
      }
      match__process: {
        Args: { p_ctx: Json; p_event: Json; p_state: Json; p_transitions: Json }
        Returns: Json
      }
      match__reject: {
        Args: { p_code: string; p_detail?: Json }
        Returns: Json
      }
      match__resume_clock: {
        Args: { p_clock: Json; p_event: Json }
        Returns: Json
      }
      match__retract_target_admissible: {
        Args: { p_state: Json; p_target_id: string; p_target_type: string }
        Returns: boolean
      }
      match__rules_valid: { Args: { p_rules: Json }; Returns: boolean }
      match__shootout_winner: {
        Args: { p_ctx: Json; p_state: Json }
        Returns: string
      }
      match__snapshot: { Args: { p_ctx: Json; p_state: Json }; Returns: Json }
      match__stale_base_detail: {
        Args: { p_ctx: Json; p_state: Json }
        Returns: Json
      }
      match__start_clock: { Args: { p_event: Json }; Returns: Json }
      match__stop_clock: {
        Args: { p_clock: Json; p_event: Json }
        Returns: Json
      }
      match__team_scores_valid: {
        Args: { p_ctx: Json; p_scores: Json }
        Returns: boolean
      }
      match__truthy: { Args: { p_value: Json }; Returns: boolean }
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
      record_monitor_heartbeat: {
        Args: {
          p_cache_status?: string
          p_monitor_id: string
          p_slide_index?: number
          p_tournament_id: string
          p_user_agent?: string
        }
        Returns: undefined
      }
      regenerate_share_code: {
        Args: { tournament_id: string }
        Returns: {
          share_code: string
          share_code_created_at: string
        }[]
      }
      tournament_limit_error_message: { Args: never; Returns: string }
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
