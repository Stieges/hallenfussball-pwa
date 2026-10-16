/**
 * Spalten `origin_a/origin_b` (A-36a, `supabase/migrations/20261026_001_match_origin.sql`): Herkunft des
 * PLATZES, beim Anlegen gesetzt, danach unveränderlich (Trigger `matches_keep_origin`, Fehlercode HF002).
 *
 * Schreiben nur beim Anlegen einer Zeile (`mapMatchToSupabase`); die Update-Wege (`mapMatchToScheduleUpdate`,
 * `mapMatchUpdateToSupabase`) senden die Spalten nie.
 */
import type { Json } from '../../types/supabase';
import { matchOrigins, type MatchOrigins } from '../models/matchOrigin';
import { SlotSourceSchema, type SlotSource } from '../models/schemas/MatchSlotSchema';
import { captureFeatureError } from '../../lib/sentry';

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

/**
 * Lesen aus der Cloud-Zeile. Fehlerpolitik (Brief A-36a Schritt 3): ungültige Form → Herkunft fehlt,
 * Meldung über `captureFeatureError` (Bereich sync); das Spiel bleibt stehen, kein Ablehnen des Turniers.
 */
export function originFromRow(row: { id: string } & MatchOriginColumns): MatchOrigins {
  return matchOrigins({ originA: parseOrigin(row.id, 'A', row.origin_a), originB: parseOrigin(row.id, 'B', row.origin_b) });
}

function parseOrigin(matchId: string, side: 'A' | 'B', raw: Json | null | undefined): SlotSource | undefined {
  if (raw === null || raw === undefined) {
    return undefined;
  }
  const parsed = SlotSourceSchema.safeParse(raw);
  if (parsed.success) {
    return parsed.data;
  }
  captureFeatureError(new Error(`Spiel ${matchId}, Seite ${side}: Herkunft des Platzes ungültig`), 'sync', 'mapMatchOrigin', {
    matchId,
    side,
  });
  return undefined;
}
