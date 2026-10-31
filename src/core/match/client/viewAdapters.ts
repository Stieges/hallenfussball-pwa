/**
 * viewAdapters (RC13): Abbildung von Engine-Zustand auf die LiveMatch-Form
 * fuer die vorhandene Cockpit-UI. Die Adapter rechnen mit Serverzeit und
 * Offset (Parameter), rufen selbst keine Uhr auf.
 */
import {
  activePenalties,
  cacheColumns,
  effectiveScoreFor,
  elapsedAt,
  otherTeamId,
  penaltyRemainingMs,
  type EngineEvent,
  type MatchContext,
  type MatchState,
} from '../';
import type { LiveMatch, MatchStatus, TournamentPhase } from '../../models/LiveMatch';
import type { RuntimeMatchEvent } from '../../../types/tournament';
import type { MatchEventTeamRef } from '../../../utils/matchEvents';
import { viewDurationSeconds } from './viewDuration';

export interface LiveMatchMeta {
  id: string;
  number: number;
  phaseLabel: string;
  tournamentPhase?: TournamentPhase;
  fieldId: string;
  scheduledKickoff: string;
  refereeName?: string;
  homeTeam: MatchEventTeamRef;
  awayTeam: MatchEventTeamRef;
  version: number;
}

export interface ViewClock {
  serverNow: number;
  offsetMs: number;
}

/** Runtime-Ereignis mit gesetzter `matchId` (in LiveMatch.events Pflichtfeld). */
export type LiveRuntimeEvent = RuntimeMatchEvent & { matchId: string };

export function toLiveMatchView(
  state: MatchState,
  meta: LiveMatchMeta,
  clock: ViewClock,
  log: readonly EngineEvent[] = [],
): LiveMatch {
  const ctx: MatchContext = { matchId: meta.id, teamAId: meta.homeTeam.id, teamBId: meta.awayTeam.id };
  const columns = cacheColumns(state, ctx);

  return {
    id: meta.id,
    number: meta.number,
    phaseLabel: meta.phaseLabel,
    fieldId: meta.fieldId,
    scheduledKickoff: meta.scheduledKickoff,
    refereeName: meta.refereeName,
    homeTeam: { id: meta.homeTeam.id, name: meta.homeTeam.name },
    awayTeam: { id: meta.awayTeam.id, name: meta.awayTeam.name },
    version: meta.version,
    homeScore: columns.score_a ?? 0,
    awayScore: columns.score_b ?? 0,
    status: mapStatus(state),
    elapsedSeconds: Math.floor(elapsedAt(state.clock, clock.serverNow) / 1000),
    durationSeconds: viewDurationSeconds(state), // Verlängerung: Regelzeit + Verlängerung (C-VERLAENGERUNG-ENDET-SOFORT)
    // timerStartTime in Geraetezeit: useMatchTimerExtended rechnet mit Date.now() (I1).
    // N6: der Millisekunden-Rest von elapsedMs wird mit abgezogen, damit
    // timerElapsedSeconds + Geraetelaufzeit nicht doppelt abrundet.
    timerStartTime: state.clock.anchorAt !== null
      ? new Date(state.clock.anchorAt - clock.offsetMs - (state.clock.elapsedMs % 1000)).toISOString()
      : undefined,
    timerPausedAt: state.clock.running
      ? undefined
      : new Date(clock.serverNow - clock.offsetMs).toISOString(),
    timerElapsedSeconds: Math.floor(state.clock.elapsedMs / 1000),
    events: toRuntimeEvents(state, log, ctx),
    // C3b-1 (G6): Zurueckgenommenes getrennt -- `events` bleibt ohne (Fouls/Offen-Zaehlung/Export).
    retractedEvents: toRetractedEvents(state, log, ctx),
    tournamentPhase: meta.tournamentPhase,
    playPhase: columns.live_state?.playPhase ?? 'regular',
    tiebreakerMode: columns.live_state?.tiebreakerMode ?? undefined,
    overtimeDurationSeconds: columns.live_state?.overtimeDurationSeconds ?? undefined,
    awaitingTiebreakerChoice: columns.live_state?.awaitingTiebreakerChoice ?? false,
    overtimeScoreA: columns.overtime_score_a ?? undefined,
    overtimeScoreB: columns.overtime_score_b ?? undefined,
    penaltyScoreA: columns.penalty_score_a ?? undefined,
    penaltyScoreB: columns.penalty_score_b ?? undefined,
  };
}

function mapStatus(state: MatchState): MatchStatus {
  switch (state.status) {
    case 'scheduled': return 'NOT_STARTED';
    case 'running': return 'RUNNING';
    case 'paused':
    case 'section_break':
    case 'decision_pending':
    case 'shootout':
      return 'PAUSED';
    case 'finished': return 'FINISHED';
    case 'skipped': return 'FINISHED';
    default: return 'NOT_STARTED';
  }
}

/** Nur diese Engine-Typen zeigt die UI; OWN_GOAL: Tor des Gegners, `ownGoal`/`ownGoalTeamId` (L2). */
function mapEventType(type: EngineEvent['type']): RuntimeMatchEvent['type'] | null {
  switch (type) {
    case 'GOAL':
    case 'OWN_GOAL':
      return 'GOAL';
    case 'YELLOW_CARD':
      return 'YELLOW_CARD';
    case 'YELLOW_RED_CARD':
    case 'RED_CARD':
      return 'RED_CARD';
    case 'TIME_PENALTY':
      return 'TIME_PENALTY';
    case 'SUBSTITUTION':
      return 'SUBSTITUTION';
    case 'FOUL':
      return 'FOUL';
    default:
      return null;
  }
}

function numberField(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((entry: unknown) => typeof entry === 'number');
}

/**
 * UI-Payload eines Ereignisses: Spielerangaben aus `state.details` (AMEND-faehig,
 * C0a V1 -- sind `details` vorhanden, sind sie die alleinige Quelle, damit ein
 * per AMEND geleertes Feld nicht aus der Roh-Payload zurueckkommt),
 * Kartentyp und Strafdauer aus der Ereignisform.
 */
function buildPayload(state: Pick<MatchState, 'details'>, event: EngineEvent, ctx: MatchContext): RuntimeMatchEvent['payload'] {
  const details = Object.hasOwn(state.details, event.id) ? state.details[event.id] : undefined;
  const raw = event.payload;
  const payload: RuntimeMatchEvent['payload'] = {};

  const teamId = event.teamId ?? null;
  if (event.type === 'OWN_GOAL') {
    Object.assign(payload, { teamId: otherTeamId(ctx, teamId ?? ''), ownGoal: true, ownGoalTeamId: teamId ?? '' });
  } else if (teamId !== null) {
    payload.teamId = teamId;
  }

  const playerNumber = details ? details.playerNumber : numberField(raw.playerNumber);
  if (playerNumber !== undefined) {
    payload.playerNumber = playerNumber;
  }
  const assists = details ? details.assists : raw.assists;
  if (isNumberArray(assists)) {
    payload.assists = assists;
  }

  if (event.type === 'YELLOW_CARD') {
    payload.cardType = 'YELLOW';
  } else if (event.type === 'YELLOW_RED_CARD') {
    // F3b1 (PO 30.09.): Gelb-Rot nicht mehr auf 'RED' abbilden -- eigener Wert, auch wenn der
    // Ereignistyp (oben in mapEventType) weiter RED_CARD bleibt (gleiche Behandlung/Icon).
    payload.cardType = 'YELLOW_RED';
  } else if (event.type === 'RED_CARD') {
    payload.cardType = 'RED';
  }
  if (event.type === 'TIME_PENALTY') {
    const durationSeconds = numberField(raw.durationSeconds);
    if (durationSeconds !== undefined) {
      payload.penaltyDuration = durationSeconds;
      payload.durationSeconds = durationSeconds;
    }
  }
  if (isNumberArray(raw.playersIn)) {
    payload.playersIn = raw.playersIn;
  }
  if (isNumberArray(raw.playersOut)) {
    payload.playersOut = raw.playersOut;
  }
  return payload;
}

interface ShownEntry {
  id: string;
  source: EngineEvent;
  type: RuntimeMatchEvent['type'];
}

/**
 * Angenommene Ereignisse der UI-Typen in Log-Reihenfolge -- `retracted` waehlt die zurueckgenommenen
 * (true) oder die wirksamen (false). Der Inhalt kommt aus `state.accepted` (nicht aus dem Log),
 * doppelte IDs erscheinen nur einmal (N7).
 */
function collectEntries(state: MatchState, log: readonly EngineEvent[], retracted: boolean): ShownEntry[] {
  const entries: ShownEntry[] = [];
  const seen = new Set<string>();
  for (const event of log) {
    if (seen.has(event.id)) {
      continue;
    }
    const source = Object.hasOwn(state.accepted, event.id) ? state.accepted[event.id] : undefined;
    if (!source || state.retracted.includes(event.id) !== retracted) {
      continue;
    }
    const type = mapEventType(source.type);
    if (type === null) {
      continue;
    }
    seen.add(event.id);
    entries.push({ id: event.id, source, type });
  }
  return entries;
}

/** Typen, bei denen die Oberflaeche eine Rueckennummer abfragt -- nur dort heisst "Nummer fehlt" = offen. */
const NUMBERED_TYPES: ReadonlySet<RuntimeMatchEvent['type']> = new Set([
  'GOAL',
  'YELLOW_CARD',
  'RED_CARD',
  'TIME_PENALTY',
]);

/**
 * "Offen" (C3b-1, Plan §8 Zeile 11+19): die Nummer fehlt -- NICHT das `incomplete`-Flag (das sendet
 * niemand mehr). Quelle ist `state.details` (AMEND-faehig), sonst die Roh-Payload.
 */
function isOpenEntry(state: MatchState, entry: ShownEntry): boolean | undefined {
  if (!NUMBERED_TYPES.has(entry.type)) {
    return undefined;
  }
  const details = state.details[entry.id];
  const number = details ? details.playerNumber : numberField(entry.source.payload.playerNumber);
  return number === undefined;
}

/**
 * Nur angenommene, nicht zurueckgenommene Ereignisse der UI-Typen, in
 * Log-Reihenfolge. `scoreAfter` laeuft vom wirksamen Kopfstand (inkl.
 * Korrekturen) rueckwaerts aus den Toren (N8) -- home ist `ctx.teamAId`.
 */
export function toRuntimeEvents(
  state: MatchState,
  log: readonly EngineEvent[],
  ctx: MatchContext,
): LiveRuntimeEvent[] {
  const entries = collectEntries(state, log, false);
  let home = effectiveScoreFor(state, ctx.teamAId);
  let away = effectiveScoreFor(state, ctx.teamBId);
  const events: LiveRuntimeEvent[] = new Array<LiveRuntimeEvent>(entries.length);
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    const open = isOpenEntry(state, entry);
    events[i] = {
      id: entry.id,
      matchId: ctx.matchId,
      timestampSeconds: Math.floor((entry.source.clockMs ?? 0) / 1000),
      type: entry.type,
      payload: buildPayload(state, entry.source, ctx),
      scoreAfter: { home, away },
      ...(entry.source.section !== null ? { section: entry.source.section } : {}),
      ...(open !== undefined ? { incomplete: open } : {}),
    };
    if (entry.source.type === 'GOAL' || entry.source.type === 'OWN_GOAL') {
      const scoringTeamId =
        entry.source.type === 'OWN_GOAL' ? otherTeamId(ctx, entry.source.teamId ?? '') : entry.source.teamId;
      if (scoringTeamId === ctx.teamAId) {
        home = Math.max(0, home - 1);
      } else if (scoringTeamId === ctx.teamBId) {
        away = Math.max(0, away - 1);
      }
    }
  }
  return events;
}

/**
 * Der Eigentor-Weg des Cockpits (@SL-022) erfasst zuerst den Tor-Tipp, nimmt ihn mit RETRACT zurück und erfasst direkt danach
 * OWN_GOAL des Gegners zur Spielsekunde des ersten Tipps. Dieser Zwischenschritt ist kein eigener Protokolleintrag: Er soll nach
 * einem „Rückgängig“ des Eigentors nicht als zweite durchgestrichene Zeile „Tor“ neben dem Eigentor stehen
 * (C-RUECKGAENGIG-DOPPELTE-ZEILEN; gespeichert ist nichts doppelt). Erkannt wird er nur, wenn auf das RETRACT des Tors unmittelbar
 * ein OWN_GOAL des anderen Teams im selben Abschnitt und in derselben Spielsekunde folgt; jedes andere zurückgenommene Tor bleibt.
 */
function isReplacedByOwnGoal(source: EngineEvent, log: readonly EngineEvent[]): boolean {
  if (source.type !== 'GOAL') {
    return false;
  }
  const retractAt = log.findIndex((event) => event.type === 'RETRACT' && event.targetId === source.id);
  const next = retractAt < 0 ? undefined : log[retractAt + 1];
  return next?.type === 'OWN_GOAL'
    && next.teamId !== source.teamId
    && next.section === source.section
    && Math.floor((next.clockMs ?? 0) / 1000) === Math.floor((source.clockMs ?? 0) / 1000);
}

/**
 * G6: zurueckgenommene Eintraege (Log-Reihenfolge) fuer die Protokoll-Anzeige. Nie Teil von
 * `LiveMatch.events`; `scoreAfter` ist der aktuelle Stand (ohne den zurueckgenommenen Eintrag),
 * ohne "offen"-Markierung.
 */
export function toRetractedEvents(
  state: MatchState,
  log: readonly EngineEvent[],
  ctx: MatchContext,
): LiveRuntimeEvent[] {
  const scoreAfter = { home: effectiveScoreFor(state, ctx.teamAId), away: effectiveScoreFor(state, ctx.teamBId) };
  return collectEntries(state, log, true).filter((entry) => !isReplacedByOwnGoal(entry.source, log)).map((entry) => ({
    id: entry.id,
    matchId: ctx.matchId,
    timestampSeconds: Math.floor((entry.source.clockMs ?? 0) / 1000),
    type: entry.type,
    payload: buildPayload(state, entry.source, ctx),
    scoreAfter,
    ...(entry.source.section !== null ? { section: entry.source.section } : {}),
  }));
}

/**
 * B-50 (@FU-095 „die beiden Tore stehen als verworfen im Verlauf“, Record Ergebnisse korrigieren B6.3 „nur dieser eine Verlauf
 * je Spiel“): ein Eintrag, der nie im Spiel-Log stand (verworfener Klärungseintrag), in der Form des Protokolls. `null` für
 * Arten, die das Protokoll nicht zeigt. Nie Teil von `LiveMatch.events` – zählt nicht zum Stand.
 */
export function toProtocolEvent(source: EngineEvent, ctx: MatchContext, scoreAfter: { home: number; away: number }): LiveRuntimeEvent | null {
  const type = mapEventType(source.type);
  if (type === null) {
    return null;
  }
  return {
    id: source.id,
    matchId: ctx.matchId,
    timestampSeconds: Math.floor((source.clockMs ?? 0) / 1000),
    type,
    payload: buildPayload({ details: {} }, source, ctx),
    scoreAfter,
  };
}

/** Behaelt `prev`, solange die Folge inhaltlich gleich ist (M-4: nicht nur IDs). */
export function stableEvents(prev: LiveRuntimeEvent[], next: LiveRuntimeEvent[]): LiveRuntimeEvent[] {
  if (prev.length !== next.length) {
    return next;
  }
  for (let i = 0; i < prev.length; i++) {
    const before: RuntimeMatchEvent = prev[i];
    const after: RuntimeMatchEvent = next[i];
    if (before.id !== after.id || JSON.stringify(before) !== JSON.stringify(after)) {
      return next;
    }
  }
  return prev;
}

/** Laufende Zeitstrafen mit Restzeit bei Serverzeit `serverNow` (I4). */
export function activePenaltiesView(
  state: MatchState,
  serverNow: number,
): { id: string; teamId: string; remainingMs: number }[] {
  const elapsedMs = elapsedAt(state.clock, serverNow);
  return activePenalties(state, elapsedMs).map((penalty) => ({
    id: penalty.id,
    teamId: penalty.teamId,
    remainingMs: penaltyRemainingMs(penalty, elapsedMs),
  }));
}
