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
  const rules = state.rules;

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
    durationSeconds: rules ? rules.sections * rules.sectionSeconds : 0,
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

/** Nur diese Engine-Typen zeigt die UI; OWN_GOAL wird als Tor des Gegners gefuehrt. */
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
function buildPayload(state: MatchState, event: EngineEvent, ctx: MatchContext): RuntimeMatchEvent['payload'] {
  const details = state.details[event.id];
  const raw = event.payload;
  const payload: RuntimeMatchEvent['payload'] = {};

  const teamId = event.teamId ?? null;
  if (event.type === 'OWN_GOAL') {
    payload.teamId = otherTeamId(ctx, teamId ?? '');
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
  return collectEntries(state, log, true).map((entry) => ({
    id: entry.id,
    matchId: ctx.matchId,
    timestampSeconds: Math.floor((entry.source.clockMs ?? 0) / 1000),
    type: entry.type,
    payload: buildPayload(state, entry.source, ctx),
    scoreAfter,
  }));
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
