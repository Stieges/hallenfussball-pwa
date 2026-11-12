/**
 * applyEngineOverlay (C3a-2a, B3/W7): projiziert den Engine-Zustand EINES Spiels in die
 * Turnierkopie -- rein lokal (kein `syncUp`, kein Versionssprung, keine MutationQueue, PC16).
 *
 * B3 (Plan-Review, ersetzt die Feldliste aus dem urspruenglichen Brief): die Projektion ist
 * EXAKT `cacheColumns(state, ctx)`, abgebildet auf die Turnier-Felder -- also genau der
 * Server-Zwischenspeicher (RPC), NICHT der "effektive Stand" (`calculations.ts:274` addiert
 * Verlaengerung selbst dazu -- eine effektive Projektion wuerde sie doppelt zaehlen).
 *
 * `match_status` kennt am Server/Engine `'paused'` (auch die Turnierkopie, `MatchStatus`); die Ueberlagerung bildet es
 * unveraendert auf `'running'` ab ("laeuft, nicht fertig"; Verwaltung und Cockpit lesen den Feinstatus aus der Engine).
 *
 * Framework-frei (LAYERING core/hooks); die aufrufende Seite (Hook) baut die `MatchContext`s
 * (W4: Platzhalter-Teams -> keine Kopie, IDs klein) und liefert `view`s aus `engine.view(matchId)`.
 */
import { cacheColumns, type CacheDecidedBy, type CacheMatchStatus } from './cacheColumns';
import { kitStartsOf, projectKitState, type KitStart } from './matchKitFromEvents';
import type { KitDecision, MatchKit } from '../../models/kit';
import type { ForfeitAbsent, MatchContext } from '../types';
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
  /**
   * A-25n (Review A-25c, @W2A-024/@TM-063): wer bei einer Wertung fehlte (`forfeit_absent`). Ohne das Feld zählte die
   * Tabelle eine Wertung beider (0:0) als Remis, solange der lokale Eintrag vor der Server-Zeile gilt; `undefined`
   * räumt ein altes Merkmal nach Rücknahme oder Korrektur ab.
   */
  forfeitAbsent: ForfeitAbsent | undefined;
  /**
   * A-30a / Leibchen 2b: die Anpfiffe mit `kit` aus dem eigenen Log (TS-Gegenstück zum Server-Trigger). Sie wirken auf den Stand der Wahl am Spiel
   * (`projectKitState`), statt ihn zu überschreiben: ohne Anpfiff bleibt die vor dem Anpfiff bestätigte Wahl stehen (C-KIT-OVERLAY-UEBERSCHREIBT-VOR-ANPFIFF).
   */
  kitStarts: readonly KitStart[];
  /**
   * C-OVERLAY-LIVESTATE-BLEIBT (@OB-066): der Server leert `live_state` beim Beenden (und es gibt keinen
   * beim geplanten/abgesetzten Spiel); `true` heißt: auch den Feinstatus am Datensatz leeren. Sonst bleibt er
   * unberührt (er kommt vom Server, nicht aus der Überlagerung).
   */
  clearLiveState?: boolean;
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
    forfeitAbsent: nullToUndefined(columns.forfeit_absent),
    kitStarts: kitStartsOf(view.log, view.confirmedCount),
    clearLiveState: columns.live_state === null,
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
  forfeitAbsent?: string;
  kit?: MatchKit;
  kitDecision?: KitDecision;
  /** `matches.live_state` (Feinstatus fuer Abzeichen); die Ueberlagerung leert ihn nur (`clearLiveState`). */
  liveState?: unknown;
}

export interface OverlayableTournament<TMatch extends OverlayableMatch> {
  matches: TMatch[];
}

/** A-30a: Farben je Wert vergleichen (neues Objekt je Lauf darf die Referenzstabilitaet nicht brechen, W7). */
function kitEqual(left: MatchKit | undefined, right: MatchKit | undefined): boolean {
  return left?.a === right?.a && left?.b === right?.b && left?.bibSide === right?.bibSide && (left === undefined) === (right === undefined);
}

/** Stand der Wahl nach der Projektion der Anpfiffe; `kit` nur, wenn es etwas zu zeigen gibt. */
function projectedKit(match: OverlayableMatch, fields: EngineOverlayFields): { kit: MatchKit | undefined; kitDecision: KitDecision | undefined } {
  const projected = projectKitState({ ...(match.kit === undefined ? {} : { kit: match.kit }), ...(match.kitDecision === undefined ? {} : { decision: match.kitDecision }) }, fields.kitStarts);
  return { kit: projected.kit, kitDecision: projected.decision };
}

function fieldsEqual(match: OverlayableMatch, fields: EngineOverlayFields): boolean {
  const projected = projectedKit(match, fields);
  return (
    match.scoreA === fields.scoreA &&
    match.scoreB === fields.scoreB &&
    match.overtimeScoreA === fields.overtimeScoreA &&
    match.overtimeScoreB === fields.overtimeScoreB &&
    match.penaltyScoreA === fields.penaltyScoreA &&
    match.penaltyScoreB === fields.penaltyScoreB &&
    match.matchStatus === fields.matchStatus &&
    match.decidedBy === fields.decidedBy &&
    match.forfeitAbsent === fields.forfeitAbsent &&
    kitEqual(match.kit, projected.kit) &&
    match.kitDecision === projected.kitDecision &&
    (!fields.clearLiveState || match.liveState === undefined)
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
    const { clearLiveState, kitStarts, ...projection } = fields;
    void kitStarts; // wirkt über `projectedKit`, nicht als Feld
    const { kit, kitDecision } = projectedKit(match, fields);
    const next = { ...match, ...projection, ...(kit === undefined ? {} : { kit }), ...(kitDecision === undefined ? {} : { kitDecision }) };
    return clearLiveState ? { ...next, liveState: undefined } : next;
  });
  return changed ? { ...tournament, matches } : tournament;
}
