/**
 * Spalten `origin_a/origin_b` (A-36a, `supabase/migrations/20261026_001_match_origin.sql`): Herkunft des
 * PLATZES, beim Anlegen gesetzt, danach unveränderlich (Trigger `matches_keep_origin`, Fehlercode HF002).
 *
 * Schreiben nur beim Anlegen einer Zeile (`mapMatchToSupabase`); die Update-Wege (`mapMatchToScheduleUpdate`,
 * `mapMatchUpdateToSupabase`) senden die Spalten nie.
 */
import type { Json } from '../../types/supabase';
import type { MatchOrigins } from '../models/matchOrigin';

/**
 * Von Hand ergänzt: `src/types/supabase.ts` wird erst nach dem Einspielen der Migration neu erzeugt
 * (Controller, Skill supabase-types-regen).
 */
export interface MatchOriginColumns {
  origin_a?: Json | null;
  origin_b?: Json | null;
}

/** Insert-Spalten: nur gesetzte Herkunft (Gruppenspiel → `{}`, die Spalte bleibt NULL). */
export function originToColumns(match: MatchOrigins): MatchOriginColumns {
  return {
    ...(match.originA !== undefined && { origin_a: match.originA }),
    ...(match.originB !== undefined && { origin_b: match.originB }),
  };
}
