/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
/**
 * Supabase Database Types
 *
 * Auto-generiert von Supabase CLI
 * NICHT MANUELL BEARBEITEN!
 *
 * Regenerieren mit:
 * npx supabase gen types typescript --project-id amtlqicosscsjnnthvzm > src/types/supabase.ts
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
      match_corrections: {
        Row: {
          corrected_at: string | null
          corrected_by: string | null
          id: string
          match_id: string
          new_score_a: number
          new_score_b: number
          note: string | null
          previous_score_a: number
          previous_score_b: number
          reason_type: string | null
        }
        Insert: {
          corrected_at?: string | null
          corrected_by?: string | null
          id?: string
          match_id: string
          new_score_a: number
          new_score_b: number
          note?: string | null
          previous_score_a: number
          previous_score_b: number
          reason_type?: string | null
        }
        Update: {
          corrected_at?: string | null
          corrected_by?: string | null
          id?: string
          match_id?: string
          new_score_a?: number
          new_score_b?: number
          note?: string | null
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
      match_events: {
        Row: {
          created_at: string | null
          id: string
          incomplete: boolean | null
          is_deleted: boolean | null
          match_id: string
          payload: Json
          period: string | null
          player_id: string | null
          score_away: number
          score_home: number
          team_id: string | null
          timestamp_seconds: number
          type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          incomplete?: boolean | null
          is_deleted?: boolean | null
          match_id: string
          payload?: Json
          period?: string | null
          player_id?: string | null
          score_away: number
          score_home: number
          team_id?: string | null
          timestamp_seconds: number
          type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          incomplete?: boolean | null
          is_deleted?: boolean | null
          match_id?: string
          payload?: Json
          period?: string | null
          player_id?: string | null
          score_away?: number
          score_home?: number
          team_id?: string | null
          timestamp_seconds?: number
          type?: string
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
            foreignKeyName: "match_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
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
          label: string | null
          last_modified_by: string | null
          match_number: number | null
          match_status: string | null
          overtime_score_a: number | null
          overtime_score_b: number | null
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
          label?: string | null
          last_modified_by?: string | null
          match_number?: number | null
          match_status?: string | null
          overtime_score_a?: number | null
          overtime_score_b?: number | null
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
          label?: string | null
          last_modified_by?: string | null
          match_number?: number | null
          match_status?: string | null
          overtime_score_a?: number | null
          overtime_score_b?: number | null
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
      monitors: {
        Row: {
          access_code: string | null
          config: Json
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          tournament_id: string
          type: string
          updated_at: string | null
        }
        Insert: {
          access_code?: string | null
          config?: Json
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          tournament_id: string
          type?: string
          updated_at?: string | null
        }
        Update: {
          access_code?: string | null
          config?: Json
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          tournament_id?: string
          type?: string
          updated_at?: string | null
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
          role: string | null
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
          role?: string | null
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
          role?: string | null
          updated_at?: string | null
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
          logo_path: string | null
          name: string
          show_on_monitor: boolean | null
          show_on_pdf: boolean | null
          show_on_schedule: boolean | null
          tier: string | null
          tournament_id: string
          updated_at: string | null
          website_url: string | null
        }
        Insert: {
          clicks?: number | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          impressions?: number | null
          is_active?: boolean | null
          logo_path?: string | null
          name: string
          show_on_monitor?: boolean | null
          show_on_pdf?: boolean | null
          show_on_schedule?: boolean | null
          tier?: string | null
          tournament_id: string
          updated_at?: string | null
          website_url?: string | null
        }
        Update: {
          clicks?: number | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          impressions?: number | null
          is_active?: boolean | null
          logo_path?: string | null
          name?: string
          show_on_monitor?: boolean | null
          show_on_pdf?: boolean | null
          show_on_schedule?: boolean | null
          tier?: string | null
          tournament_id?: string
          updated_at?: string | null
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
          is_removed: boolean | null
          logo_background_color: string | null
          logo_path: string | null
          name: string
          removed_at: string | null
          removed_reason: string | null
          sort_order: number | null
          tournament_id: string
          updated_at: string | null
          version: number | null
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
          is_removed?: boolean | null
          logo_background_color?: string | null
          logo_path?: string | null
          name: string
          removed_at?: string | null
          removed_reason?: string | null
          sort_order?: number | null
          tournament_id: string
          updated_at?: string | null
          version?: number | null
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
          is_removed?: boolean | null
          logo_background_color?: string | null
          logo_path?: string | null
          name?: string
          removed_at?: string | null
          removed_reason?: string | null
          sort_order?: number | null
          tournament_id?: string
          updated_at?: string | null
          version?: number | null
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
          id: string
          invite_code: string | null
          invite_email: string | null
          invited_at: string | null
          invited_by: string | null
          role: string
          tournament_id: string
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          allowed_fields?: number[] | null
          allowed_groups?: string[] | null
          created_at?: string | null
          declined_at?: string | null
          id?: string
          invite_code?: string | null
          invite_email?: string | null
          invited_at?: string | null
          invited_by?: string | null
          role?: string
          tournament_id: string
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          allowed_fields?: number[] | null
          allowed_groups?: string[] | null
          created_at?: string | null
          declined_at?: string | null
          id?: string
          invite_code?: string | null
          invite_email?: string | null
          invited_at?: string | null
          invited_by?: string | null
          role?: string
          tournament_id?: string
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
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
    DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
  : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
  : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
  : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
  : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
  : never = never,
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
