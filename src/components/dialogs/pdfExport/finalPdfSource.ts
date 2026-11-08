/**
 * Quelle des Endstands für den PDF-Dialog (@DR-011, @DR-009, @ET-045, @BM-041): die Plätze kommen IMMER aus dem beim Abschluss
 * gespeicherten Endstand (`tournament_final_standings` für Turnierleitung und Helfer, `public_final_standings` für Zuschauer),
 * nie aus einer Neuberechnung. Ist er nicht lesbar (etwa ohne Netz – eine Kopie auf dem Gerät gibt es nicht), entsteht kein
 * PDF mit falscher Platzierung, sondern der Dialog nennt den Grund. Rein, ohne React.
 */
import type { StoredFinalStandingsResult } from '../../../core/repositories/storedFinalStandingsRead';
import type { FinalStandingRow, ScorerRow } from '../../../core/standings/finalStandings/types';
import type { RankEntry } from '../../../lib/pdf/placement';
import type { Team, Tournament } from '../../../types/tournament';

export type FinalPdfSource =
  /** Nicht abgeschlossen (auch abgebrochen, @DR-049): es gibt keinen Endstand. */
  | { kind: 'open' }
  | { kind: 'loading' }
  /** Abgeschlossen, aber der gespeicherte Endstand ist nicht lesbar oder nicht zu sehen. */
  | { kind: 'unavailable' }
  /** `scorers`: Torschützenliste des gespeicherten Endstands für die Seite „Siegerehrung“ (@DR-052); leer, wenn keine gezeigt werden darf. */
  | { kind: 'ready'; ranking: RankEntry[]; scorers: ScorerRow[]; closedAt: Date };

/** Abgeschlossen heißt `lifecycleStatus = finished`; ein abgebrochenes Turnier (`cancelled`) hat keinen Endstand (@DR-049). */
export const isFinished = (tournament: Pick<Tournament, 'lifecycleStatus'>): boolean => tournament.lifecycleStatus === 'finished';

/** Plätze des gespeicherten Endstands in seiner Reihenfolge; Name wie gespeichert (@ET-045), das Team des Turniers nur für weitere Angaben. */
export function rankEntriesOf(rows: readonly FinalStandingRow[], teams: readonly Team[]): RankEntry[] {
  return rows.map((row) => {
    const team = teams.find((candidate) => candidate.id === row.teamId);
    return { place: row.place, team: { ...(team ?? { id: row.teamId }), name: row.teamName } };
  });
}

function readyOf(snapshot: { ranking: readonly FinalStandingRow[]; scorers?: readonly ScorerRow[] }, finishedAt: string, teams: readonly Team[]): FinalPdfSource {
  const closedAt = new Date(finishedAt);
  return Number.isNaN(closedAt.getTime()) ? { kind: 'unavailable' } : { kind: 'ready', ranking: rankEntriesOf(snapshot.ranking, teams), scorers: [...(snapshot.scorers ?? [])], closedAt };
}

/** Turnierleitung und Helfer: der gelesene Zustand der gespeicherten Zeile (`readStoredFinalStandings`). */
export function storedFinalSource(
  tournament: Pick<Tournament, 'lifecycleStatus' | 'teams'>,
  stored: { status: 'loading' } | StoredFinalStandingsResult,
): FinalPdfSource {
  if (!isFinished(tournament)) {
    return { kind: 'open' };
  }
  if (stored.status === 'loading') {
    return { kind: 'loading' };
  }
  return stored.status === 'ok' ? readyOf(stored.snapshot, stored.finishedAt, tournament.teams) : { kind: 'unavailable' };
}

/**
 * Zuschauer (@BM-041): der Endstand der Zuschauer-Seite, nur wenn sie ihn auch zeigen darf – im Kindermodus (Ergebnisse aus)
 * und bei ausgeblendeten Tabellen gibt es kein Endstand-PDF (Record Endstand, Kindermodus-Lecks; Record Drucken A5.3).
 */
export function publicFinalSource(
  tournament: Pick<Tournament, 'lifecycleStatus' | 'teams'>,
  shown: { results: boolean; tables: boolean; finalShown: boolean },
  standings: { status: 'none' } | { status: 'final'; finishedAt: string; snapshot: { ranking: readonly FinalStandingRow[]; scorers?: readonly ScorerRow[] } },
): FinalPdfSource {
  if (!isFinished(tournament) || !shown.results || !shown.tables || !shown.finalShown || standings.status !== 'final') {
    return { kind: 'open' };
  }
  return readyOf(standings.snapshot, standings.finishedAt, tournament.teams);
}
