/**
 * Tor- und Karten-Einblendung am Monitor (R5 PR 1, plan-R5-monitor.md § 3 Nr. 5) – rein, ohne React.
 *
 * Die Einblendungen kommen aus DERSELBEN Antwort von `display_tournament`, die Stand und Uhr bringt: Stand, Uhr und
 * Einblendung erscheinen in einem Render (@ZM-083 Zeile Feld 2). Positivliste, Kindermodus und Schalter wirken allein am
 * Server: liefert er keinen Stand (Kindermodus, Live-Stand aus), gibt es kein Tor; liefert er keine Ereignisse
 * (Ereignisse aus), gibt es keine Karte (@ZM-118, Zone 1 „Was ein Monitor zeigt“).
 *
 * - Tor = der Stand einer Seite ist gegenüber dem gehaltenen Stand gestiegen (beide bekannt). Ein Eigentor zählt so von
 *   selbst für den Gegner; eine Korrektur nach unten blendet nichts ein.
 * - Karte = eine Gelbe, Gelb-Rote oder Rote Karte mit einer Kennung, die der Monitor noch nicht gesehen hat.
 * - Nur Spiele, die vorher oder jetzt laufen bzw. unterbrochen sind (ein Tor in der Sekunde vor „Pause“ oder vor dem
 *   Abpfiff zählt mit; Korrekturen beendeter Spiele nicht).
 * - Feld-Monitore (Live-Folie mit Feld) nur für ihr Feld – für Tore UND Karten (@ZM-083, @ZM-178).
 * - Idempotent: dieselbe Antwort zweimal (Server liefert ein geändertes Spiel bis 5 s lang erneut) blendet nichts doppelt
 *   ein (Stand-Vergleich, Gesehen-Menge der Karten).
 *
 * Ersetzt `monitorGoalFilter.ts` und den `useLiveMatches`-Weg (Befund C-MONITOR-TOR-OHNE-RICHTUNG).
 */
import type { CardEventInfo, GoalEventInfo } from '../../hooks/useLiveMatches';
import type { Match, MatchStatus, Tournament } from '../../types/tournament';
import type { MonitorSlide } from '../../types/monitor';
import { slotTeamId } from '../../core/models/matchSlot';
import { cardKindOf } from '../../utils/cardKind';
import { fieldIdToNumber } from './monitorDisplayHelpers';

export interface DetectedOverlays {
  goals: GoalEventInfo[];
  cards: CardEventInfo[];
}

const LIVE: ReadonlySet<MatchStatus> = new Set<MatchStatus>(['running', 'paused']);

/** Feldnummern der Live-Folien mit Feld; leer = Übersichts-Monitor (alle Felder). */
export function boundFieldNumbers(slides: readonly MonitorSlide[]): ReadonlySet<number> {
  const fields = new Set<number>();
  for (const slide of slides) {
    if (slide.type === 'live' && slide.config.fieldId) {
      fields.add(fieldIdToNumber(slide.config.fieldId));
    }
  }
  return fields;
}

/** Kennungen aller Karten im Stand (Ausgangsmenge nach dem ersten Laden bzw. einem Ziel-Wechsel). */
export function cardIdsOf(tournament: Tournament): Set<string> {
  const ids = new Set<string>();
  for (const match of tournament.matches) {
    for (const event of match.events ?? []) {
      if (cardKindOf(event) !== null) {
        ids.add(event.id);
      }
    }
  }
  return ids;
}

function teamName(tournament: Tournament, teamId: string | undefined): string {
  return tournament.teams.find((team) => team.id === teamId)?.name ?? '';
}

function isLive(match: Match | undefined): boolean {
  return match?.matchStatus !== undefined && LIVE.has(match.matchStatus);
}

function goalsOf(prev: Match, next: Match, tournament: Tournament, now: () => number): GoalEventInfo[] {
  const goals: GoalEventInfo[] = [];
  const sides = [
    { side: 'home' as const, before: prev.scoreA, after: next.scoreA, teamId: slotTeamId(next.slotA) },
    { side: 'away' as const, before: prev.scoreB, after: next.scoreB, teamId: slotTeamId(next.slotB) },
  ];
  for (const s of sides) {
    if (s.before === undefined || s.after === undefined || s.after <= s.before) {
      continue;
    }
    goals.push({
      matchId: next.id,
      teamId: s.teamId ?? '',
      teamName: teamName(tournament, s.teamId),
      side: s.side,
      timestamp: now(),
      newScore: { home: next.scoreA ?? 0, away: next.scoreB ?? 0 },
    });
  }
  return goals;
}

function cardsOf(next: Match, tournament: Tournament, seen: Set<string>, now: () => number): CardEventInfo[] {
  const cards: CardEventInfo[] = [];
  const homeId = slotTeamId(next.slotA);
  for (const event of next.events ?? []) {
    const kind = cardKindOf(event);
    if (kind === null || seen.has(event.id)) {
      continue;
    }
    seen.add(event.id);
    const teamId = event.payload.teamId;
    cards.push({
      matchId: next.id,
      teamId: teamId ?? '',
      teamName: teamName(tournament, teamId),
      side: teamId !== undefined && teamId === homeId ? 'home' : 'away',
      cardType: kind,
      ...(event.payload.playerNumber === undefined ? {} : { playerNumber: event.payload.playerNumber }),
      timestamp: now(),
    });
  }
  return cards;
}

/**
 * Einblendungen zwischen gehaltenem Stand `prev` und neuem Stand `next`. `seenCards` wird fortgeschrieben (alle Karten
 * aus `next` gelten danach als gesehen, auch die eines fremden Felds). `now` liefert je Einblendung einen eindeutigen
 * Zeitstempel (die Einblendungen erkennen Dopplungen daran).
 */
export function detectOverlays(
  prev: Tournament,
  next: Tournament,
  boundFields: ReadonlySet<number>,
  seenCards: Set<string>,
  now: () => number,
): DetectedOverlays {
  const previous = new Map(prev.matches.map((match) => [match.id, match] as const));
  const result: DetectedOverlays = { goals: [], cards: [] };
  for (const match of next.matches) {
    const before = previous.get(match.id);
    const shown = boundFields.size === 0 || boundFields.has(match.field);
    if (!shown || !(isLive(match) || isLive(before))) {
      for (const id of cardIdsOf({ ...next, matches: [match] })) {
        seenCards.add(id);
      }
      continue;
    }
    if (before !== undefined) {
      result.goals.push(...goalsOf(before, match, next, now));
    }
    result.cards.push(...cardsOf(match, next, seenCards, now));
  }
  return result;
}
