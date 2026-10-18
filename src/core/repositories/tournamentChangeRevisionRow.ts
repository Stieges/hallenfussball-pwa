/**
 * Spalte `tournaments.change_revision` (A-10, `supabase/migrations/20261028_005_guard_all_matches.sql`, @TM-027):
 * Änderungszählung des Servers für Spielplan-Änderungen ohne Versions-CAS (Befund C-SLOT-UPDATE-OHNE-VERSION).
 * Nur der Server schreibt sie (Fehler HF004); der Client LIEST sie nach `Tournament.changeRevision` und sendet sie nie.
 *
 * `src/types/supabase.ts` kennt die Spalte erst nach dem Typen-PR (nach F2b). Vor dem Einspielen fehlt sie in der
 * Zeile ganz: dann 0 – Verhalten wie heute, kein Fehler, keine Meldung (Brief A-10 § 10).
 */
import type { Tournament } from '../../types/tournament';

/** Lesen aus der Cloud-Zeile: Zahl → Wert, sonst (Spalte fehlt, NULL, kein Zahlwert) 0. */
export function changeRevisionFromRow(row: object): Required<Pick<Tournament, 'changeRevision'>> {
  const raw = (row as { change_revision?: unknown }).change_revision;
  return { changeRevision: typeof raw === 'number' && Number.isFinite(raw) ? raw : 0 };
}
