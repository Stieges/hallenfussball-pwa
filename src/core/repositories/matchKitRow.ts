/**
 * Spalten `kit_color_a/kit_color_b/bib_side` (A-30a, `supabase/migrations/20261028_004_match_kit_colors.sql`):
 * beim Anpfiff getragene Farben, gesetzt NUR vom Server-Trigger aus dem gespeicherten MATCH_START.
 *
 * Der Mapper LIEST sie nach `Match.kit` und SENDET sie nie – weder beim Anlegen noch beim Ändern (sonst
 * schlägt der Schutz-Trigger `matches_guard_kit_columns` an, Fehlercode HF003). Die Schreibwege in
 * `supabaseMappers.ts` führen ihre Spalten einzeln auf; `kit` steht in keinem davon.
 */
import { MatchKitSchema, type MatchKit } from '../models/kit';
import { captureFeatureError } from '../../lib/sentry';

/**
 * Von Hand ergänzt: `src/types/supabase.ts` wird erst nach dem Einspielen der Migration neu erzeugt
 * (Controller, Skill supabase-types-regen). Vor dem Einspielen fehlen die Spalten in der Zeile ganz.
 */
export interface MatchKitColumns {
  kit_color_a?: string | null;
  kit_color_b?: string | null;
  bib_side?: string | null;
}

/**
 * Lesen aus der Cloud-Zeile. Alle drei NULL → kein `kit`. Fehlerpolitik (Brief A-30 Schritt 3): ungültiger
 * Wert → diese Angabe fehlt (Anzeige fällt auf die Vorgabe zurück), EINE Meldung je Zeile (Bereich sync).
 */
export function kitFromRow(row: { id: string } & MatchKitColumns): { kit?: MatchKit } {
  const raw = { a: row.kit_color_a ?? undefined, b: row.kit_color_b ?? undefined, bibSide: row.bib_side ?? undefined };
  if (raw.a === undefined && raw.b === undefined && raw.bibSide === undefined) {
    return {};
  }
  const kit: MatchKit = {};
  let invalid = false;
  for (const key of ['a', 'b', 'bibSide'] as const) {
    if (raw[key] === undefined) {
      continue;
    }
    const parsed = MatchKitSchema.shape[key].safeParse(raw[key]);
    if (parsed.success && parsed.data !== undefined) {
      Object.assign(kit, { [key]: parsed.data });
    } else {
      invalid = true;
    }
  }
  if (invalid) {
    captureFeatureError(new Error(`Spiel ${row.id}: getragene Farbe aus der Cloud ungültig`), 'sync', 'mapMatchKit', {
      matchId: row.id,
    });
  }
  return { kit };
}
