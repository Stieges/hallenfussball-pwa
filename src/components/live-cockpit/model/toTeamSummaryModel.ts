/**
 * toTeamSummaryModel – Zusammenfassung eines Teams nach dem Abpfiff (B-10a2, Cockpit-Spec § 6 „Abgepfiffen“, @SL-048).
 * Rein, ohne React. Tore, Karten und Zeitstrafen aus den wirksamen Einträgen des Spiels (zurückgenommene stehen nicht in
 * `match.events`), nach Spielzeit aufsteigend; die Fouls sind die Gesamtzahl im Spiel (`useFoulCounts`, @SL-099).
 */
import type { RuntimeMatchEvent } from '../../../types/tournament';
import { cardKindOf, type CardKind } from '../../../utils/cardKind';
import type { LiveMatch } from '../types';
import type { Side } from './cockpitTypes';
import { formatUhr } from './toScoreboardModel';

export interface SummaryTor { id: string; nummer: number | null; zeit: string; eigentor: boolean }
export interface SummaryKarte { id: string; art: CardKind; nummer: number | null; zeit: string }
export interface SummaryStrafe { id: string; nummer: number | null; zeit: string }

export interface TeamSummaryModel {
  seite: Side;
  name: string;
  /** Teamfarbe für den Streifen im Kopf; `null` = keine festgelegt. */
  farbe: string | null;
  tore: SummaryTor[];
  karten: SummaryKarte[];
  zeitstrafen: SummaryStrafe[];
  /** Gesamtzahl der Fouls im Spiel (Karten und Zeitstrafen zählen je eins, wie im Zähler gegen die Grenze). */
  fouls: number;
}

export interface TeamSummaryInput {
  match: Pick<LiveMatch, 'homeTeam' | 'awayTeam' | 'events'>;
  seite: Side;
  fouls: number;
}

const nachZeit = (a: RuntimeMatchEvent, b: RuntimeMatchEvent): number => a.timestampSeconds - b.timestampSeconds;
const nummerOf = (event: RuntimeMatchEvent): number | null => event.payload.playerNumber ?? null;
const zeitOf = (event: RuntimeMatchEvent): string => formatUhr(event.timestampSeconds);

export function toTeamSummaryModel({ match, seite, fouls }: TeamSummaryInput): TeamSummaryModel {
  const team = seite === 'home' ? match.homeTeam : match.awayTeam;
  const eigene = (match.events ?? []).filter((event) => event.payload.teamId === team.id).sort(nachZeit);
  const tore = eigene
    .filter((event) => event.type === 'GOAL' && event.payload.direction !== 'DEC')
    .map((event) => ({ id: event.id, nummer: nummerOf(event), zeit: zeitOf(event), eigentor: event.payload.ownGoal === true }));
  const karten = eigene.flatMap((event) => {
    const art = cardKindOf(event);
    return art === null ? [] : [{ id: event.id, art, nummer: nummerOf(event), zeit: zeitOf(event) }];
  });
  const zeitstrafen = eigene
    .filter((event) => event.type === 'TIME_PENALTY')
    .map((event) => ({ id: event.id, nummer: nummerOf(event), zeit: zeitOf(event) }));
  return { seite, name: team.name, farbe: team.colors?.primary ?? null, tore, karten, zeitstrafen, fouls };
}
