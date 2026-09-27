/**
 * applyEngineOverlay (C3a-2a, B3/W7): projiziert den Engine-Zustand EINES Spiels in die
 * Turnierkopie -- rein lokal (kein `syncUp`, kein Versionssprung, keine MutationQueue, PC16).
 *
 * B3 (Plan-Review, ersetzt die Feldliste aus dem urspruenglichen Brief): die Projektion ist
 * EXAKT `cacheColumns(state, ctx)`, abgebildet auf die Turnier-Felder -- also genau der
 * Server-Zwischenspeicher (RPC), NICHT der "effektive Stand" (`calculations.ts:274` addiert
 * Verlaengerung selbst dazu -- eine effektive Projektion wuerde sie doppelt zaehlen).
 *
 * `match_status` kennt am Server/Engine `'paused'`; die Turnierkopie (`types/tournament.ts`,
 * `MatchStatus`) hat stattdessen `'waiting'` (im gesamten Repo ungenutzt) -- hier auf
 * `'running'` abgebildet (naeher an der Bedeutung "laeuft, nicht fertig" als das tote `'waiting'`).
 *
 * Framework-frei (LAYERING core/hooks); die aufrufende Seite (Hook) baut die `MatchContext`s
 * (W4: Platzhalter-Teams -> keine Kopie, IDs klein) und liefert `view`s aus `engine.view(matchId)`.
 */
import { cacheColumns, type CacheDecidedBy, type CacheMatchStatus } from './cacheColumns';
import type { MatchContext } from '../types';
import type { MatchEngineView } from './MatchEngine';

export interface EngineOverlayFields {
  scoreA: number | undefined;
  scoreB: number | undefined;
  overtimeScoreA: number | undefined;
  overtimeScoreB: number | undefined;
  penaltyScoreA: number | undefined;
  penaltyScoreB: number | undefined;
  matchStatus: 'scheduled' | 'running' | 'finished' | 'skipped';
  decidedBy: CacheDecidedBy | undefined;
}

function nullToUndefined<T>(value: T | null): T | undefined {
  return value ?? undefined;
}

function mapMatchStatus(status: CacheMatchStatus): EngineOverlayFields['matchStatus'] {
  return status === 'paused' ? 'running' : status;
}

/** B3: `cacheColumns` abgebildet auf die Turnier-Felder einer `MatchEngineView`. */
export function engineOverlayFields(view: MatchEngineView, ctx: MatchContext): EngineOverlayFields {
  const columns = cacheColumns(view.result.state, ctx);
  return {
    scoreA: nullToUndefined(columns.score_a),
    scoreB: nullToUndefined(columns.score_b),
    overtimeScoreA: nullToUndefined(columns.overtime_score_a),
    overtimeScoreB: nullToUndefined(columns.overtime_score_b),
    penaltyScoreA: nullToUndefined(columns.penalty_score_a),
    penaltyScoreB: nullToUndefined(columns.penalty_score_b),
    matchStatus: mapMatchStatus(columns.match_status),
    decidedBy: nullToUndefined(columns.decided_by),
  };
}

/** Minimaler Ausschnitt von `Tournament`, den die Ueberlagerung braucht (keine Kopplung an das
 * konkrete App-Schema ausser den Feldern, die sie tatsaechlich schreibt). */
export interface OverlayableMatch {
  id: string;
  scoreA?: number;
  scoreB?: number;
  overtimeScoreA?: number;
  overtimeScoreB?: number;
  penaltyScoreA?: number;
  penaltyScoreB?: number;
  matchStatus?: string;
  decidedBy?: string;
}

export interface OverlayableTournament<TMatch extends OverlayableMatch> {
  matches: TMatch[];
}

function fieldsEqual(match: OverlayableMatch, fields: EngineOverlayFields): boolean {
  return (
    match.scoreA === fields.scoreA &&
    match.scoreB === fields.scoreB &&
    match.overtimeScoreA === fields.overtimeScoreA &&
    match.overtimeScoreB === fields.overtimeScoreB &&
    match.penaltyScoreA === fields.penaltyScoreA &&
    match.penaltyScoreB === fields.penaltyScoreB &&
    match.matchStatus === fields.matchStatus &&
    match.decidedBy === fields.decidedBy
  );
}

/**
 * W7: liefert das UNVERAENDERTE `tournament`-Objekt zurueck, wenn kein Match tatsaechlich eine
 * andere Projektion hat (Referenzstabilitaet fuer `useMemo`/`useSyncExternalStore`-Aufrufer,
 * gleiches Muster wie `stableLiveMatches` in `useEngineMatches.ts`).
 */
export function applyEngineOverlay<TTournament extends OverlayableTournament<TMatch>, TMatch extends OverlayableMatch>(
  tournament: TTournament,
  overlays: ReadonlyMap<string, EngineOverlayFields>,
): TTournament {
  if (overlays.size === 0) {
    return tournament;
  }
  let changed = false;
  const matches = tournament.matches.map((match) => {
    const fields = overlays.get(match.id);
    if (!fields || fieldsEqual(match, fields)) {
      return match;
    }
    changed = true;
    return { ...match, ...fields };
  });
  return changed ? { ...tournament, matches } : tournament;
}
