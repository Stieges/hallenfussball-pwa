/**
 * Antwort der Server-Funktion `public_final_standings(share_code)` (R3-6; @LZ-074, @LZ-075, @ZM-011, @ZM-012): der beim Abschluss
 * gespeicherte Endstand für Zuschauer. `{status:'none'}` bis zum Abschluss (auch für unbekannte oder nicht geteilte Turniere,
 * kein Existenz-Orakel). Ohne Torschützen-Schalter fehlt `scorers` in der Antwort; das Format prüft das Schema des Endstands.
 * Rein ohne React, wirft nie.
 */
import { FinalStandingsSnapshotSchema } from '../models/schemas/FinalStandingsSchema';
import type { FinalStandingsSnapshot } from '../standings/finalStandings/types';

export type PublicFinalStandings =
  | { status: 'none' }
  | {
    status: 'final';
    finishedAt: string;
    snapshot: FinalStandingsSnapshot;
    /** Torschützen-Schalter an: die Antwort trägt die Liste (auch leer, wenn kein Tor fiel). */
    scorersPublic: boolean;
  };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** Prüft die Antwort; `null` = nicht lesbar (Abweichung vom Vertrag), nie ein halb gelesener Endstand. */
export function parsePublicFinalStandings(raw: unknown): PublicFinalStandings | null {
  if (!isRecord(raw)) {
    return null;
  }
  if (raw.status === 'none') {
    return { status: 'none' };
  }
  if (raw.status !== 'final' || typeof raw.finishedAt !== 'string' || !isRecord(raw.standings)) {
    return null;
  }
  const scorersPublic = 'scorers' in raw.standings;
  const parsed = FinalStandingsSnapshotSchema.safeParse(scorersPublic ? raw.standings : { ...raw.standings, scorers: [] });
  return parsed.success ? { status: 'final', finishedAt: raw.finishedAt, snapshot: parsed.data, scorersPublic } : null;
}
