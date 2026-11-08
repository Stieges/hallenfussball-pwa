/**
 * Laufende Zeitstrafen für Monitor und Zuschauer-Seite (@ZM-182, @ZM-183, @ZM-184, @ZM-192; Befund C-ZEITSTRAFE-OEFFENTLICH-UNSICHTBAR).
 *
 * Eine reine Funktion: aus den öffentlichen Ereignissen eines Spiels (nur angenommene, nicht zurückgenommene; ohne den Schalter
 * „Ereignisse je Spiel“ und im Kindermodus liefert der Server keine) und seinem Feinstatus `live_state` (Serverzeit) entstehen je
 * Seite die laufenden Strafen mit Restzeit. Die Restzeit rechnet dieselbe Regel wie das Cockpit (`penaltyRemainingMs`, Spieluhr
 * kumulativ über Abschnitte und Verlängerung): sie läuft nur mit laufender Uhr, über die Halbzeitpause hinweg und in die
 * Verlängerung hinein. Nach dem Abpfiff und im Strafstoßschießen gibt es keine (@ZM-192). Kein React.
 */
import { z } from 'zod';
import { resolvePenalties, runningPenalties, type PenaltyGoal } from '../match/penalties';
import { MatchStatusSchema, PhaseSchema, type PenaltyRecord } from '../match/types';
import { PENALTY_SECONDS_DEFAULT } from '../match/client/serverRules';
import type { RuntimeMatchEvent } from '../../types/tournament';

export interface OeffentlicheZeitstrafe {
  id: string;
  /** Rückennummer; `null` = ohne Nummer (leere Scheibe) */
  nummer: number | null;
  restMs: number;
  dauerMs: number;
  /** Noch zu verbüßender Anteil (0 bis 1): der Ring nimmt ab */
  anteil: number;
}

export interface OeffentlicheZeitstrafen {
  /** Strafen des Heimteams in der Reihenfolge ihres Eintrags (die älteste steht in der Ecke) */
  home: OeffentlicheZeitstrafe[];
  away: OeffentlicheZeitstrafe[];
  /** Die Uhr steht (angehalten, Pause zwischen Abschnitten): Ring grau wie der angehaltene Zeitbalken */
  steht: boolean;
}

export interface ZeitstrafenEingabe {
  events: readonly RuntimeMatchEvent[] | undefined;
  /** `matches.live_state` des Spiels (Serverzeit) */
  liveState: unknown;
  homeId: string | undefined;
  awayId: string | undefined;
  /** Jetzt in Serverzeit (ms) */
  nowMs: number;
}

export const KEINE_ZEITSTRAFEN: OeffentlicheZeitstrafen = { home: [], away: [], steht: false };

const UhrSchema = z.object({
  status: MatchStatusSchema,
  phase: PhaseSchema,
  elapsedMs: z.number(),
  anchorAt: z.number().nullish(),
});

/** Zustände mit laufender oder ruhender Spieluhr, in denen eine Strafe gilt. */
const MIT_STRAFEN = new Set(['running', 'paused', 'section_break']);
const MS_PER_SECOND = 1000;
/** Ohne Dauer im Eintrag gilt die Vorgabe der Spielregel (ältere Einträge; neue tragen sie, `withPenaltyDuration`). */
const VORGABE_DAUER_MS = Number(PENALTY_SECONDS_DEFAULT) * MS_PER_SECOND;

function dauerMsOf(event: RuntimeMatchEvent): number {
  const sekunden = event.payload.durationSeconds ?? event.payload.penaltyDuration;
  return typeof sekunden === 'number' && sekunden > 0 ? sekunden * MS_PER_SECOND : VORGABE_DAUER_MS;
}

/** Die laufenden Zeitstrafen eines Spiels zum Zeitpunkt `nowMs` (Serverzeit). */
export function laufendeZeitstrafen(eingabe: ZeitstrafenEingabe): OeffentlicheZeitstrafen {
  const parsed = UhrSchema.safeParse(eingabe.liveState);
  if (!parsed.success || !MIT_STRAFEN.has(parsed.data.status) || parsed.data.phase === 'shootout') {
    return KEINE_ZEITSTRAFEN;
  }
  const uhr = parsed.data;
  const anker = uhr.status === 'running' ? uhr.anchorAt ?? null : null;
  const laeuft = anker !== null;
  const gespieltMs = uhr.elapsedMs + (anker === null ? 0 : Math.max(0, eingabe.nowMs - anker));
  const ergebnis: OeffentlicheZeitstrafen = { home: [], away: [], steht: !laeuft };
  const seiteOf = (teamId: string | undefined): 'home' | 'away' | undefined =>
    teamId === undefined ? undefined : teamId === eingabe.homeId ? 'home' : teamId === eingabe.awayId ? 'away' : undefined;
  const strafen: PenaltyRecord[] = [];
  const tore: PenaltyGoal[] = [];
  for (const event of eingabe.events ?? []) {
    const teamId = event.payload.teamId;
    const atMs = event.clockMs ?? event.timestampSeconds * MS_PER_SECOND;
    if (teamId === undefined || seiteOf(teamId) === undefined) {
      continue;
    }
    if (event.type === 'GOAL') {
      // Eigentore sind hier schon dem Gegner gutgeschrieben (`toPublicRuntimeEvents`): `teamId` = wer punktet
      tore.push({ id: event.id, scoringTeamId: teamId, atMs });
    } else if (event.type === 'TIME_PENALTY') {
      strafen.push({
        id: event.id, teamId, startMs: atMs, durationMs: dauerMsOf(event),
        ...(typeof event.payload.endsOnGoal === 'boolean' ? { endsOnGoal: event.payload.endsOnGoal } : {}),
      });
    }
  }
  // Das Ende durch ein Gegentor rechnet derselbe Kern wie das Cockpit (@ZM-192: der Kreis verschwindet mit dem Tor)
  for (const { penalty, remainingMs } of runningPenalties(resolvePenalties(strafen, tore, gespieltMs))) {
    const seite = seiteOf(penalty.teamId);
    const nummer = eingabe.events?.find((event) => event.id === penalty.id)?.payload.playerNumber ?? null;
    if (seite !== undefined) {
      ergebnis[seite].push({
        id: penalty.id, nummer, restMs: remainingMs, dauerMs: penalty.durationMs,
        anteil: Math.min(1, remainingMs / penalty.durationMs),
      });
    }
  }
  return ergebnis;
}

/** Restzeit „1:23“ (m:ss), abgerundet wie im Cockpit. */
export function zeitstrafeRestText(strafe: Pick<OeffentlicheZeitstrafe, 'restMs'>): string {
  const s = Math.max(0, Math.floor(strafe.restMs / MS_PER_SECOND));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Hat das Spiel eine laufende Strafe? */
export function hatZeitstrafen(z: OeffentlicheZeitstrafen): boolean {
  return z.home.length + z.away.length > 0;
}
