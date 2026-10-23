/**
 * Gemeinsame Fixture „Hallencup Nord“ (A-36b, Teilplan A-36 § 4): 2 Gruppen à 4 Teams, Halbfinale über Kreuz,
 * Finale und Spiel um Platz 3. Erzeugt über den echten Weg:
 * 1. Wizard-Daten → `TournamentCreationService.publish` (Veröffentlichen),
 * 2. `mapMatchToSupabase` → `mapMatchFromSupabase` (Mapper-Rundlauf),
 * 3. Live-Zustände über die Engine → `cacheColumns` (kein von Hand gesetztes `matchStatus`).
 * Die Varianten (F-HF, F-TAB, F-3G, F-NEU, F-PAUSE, F-AUS, F-ZEIT, F-NV, F-ES, F-NUR) sind Funktionen darüber.
 * Spiel n = n-tes Spiel des Veröffentlichens (Index n-1); Spiele 1–12 Gruppe, dann HF1, HF2, Platz 3, Finale (@TM-144).
 */
import type { Match, Team, Tournament } from '../../../types/tournament';
import type { ITournamentRepository } from '../../repositories/ITournamentRepository';
import { TournamentCreationService } from '../../services/TournamentCreationService';
import { mapMatchFromSupabase, mapMatchToSupabase } from '../../repositories/supabaseMappers';
import { cacheColumns } from '../../match/client/cacheColumns';
import { reduceMatch } from '../../match/reduceMatch';
import type { EngineEvent } from '../../match/types';
import { resolveSlot, slotTeamId } from '../../models/matchSlot';
import { assignTeamToSide } from '../../models/matchAssignment';
import { createMatchRow } from '../../../../tests/factories/supabase';
import * as play from './engineScripts';

const uuid = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export const NORD = uuid(1);
export const BERG = uuid(2);
export const WEST = uuid(3);
export const OST = uuid(4);
export const MITTE = uuid(5);
export const SUED = uuid(6);
export const UFER = uuid(7);
export const TAL = uuid(8);

const TEAMS: Team[] = [
  { id: NORD, name: 'FC Nord', group: 'A' },
  { id: BERG, name: 'DJK Berg', group: 'A' },
  { id: WEST, name: 'TSV West', group: 'A' },
  { id: OST, name: 'SC Ost', group: 'A' },
  { id: MITTE, name: 'SG Mitte', group: 'B' },
  { id: SUED, name: 'SV Süd', group: 'B' },
  { id: UFER, name: 'VfB Ufer', group: 'B' },
  { id: TAL, name: 'TuS Tal', group: 'B' },
];

/** Index der Spiele im veröffentlichten Plan. */
export const GAME = { 3: 2, 7: 6, 8: 7, 9: 8, 10: 9, HF1: 12, HF2: 13, THIRD: 14, FINAL: 15 } as const;

export interface Hallencup {
  tournament: Tournament;
  /** Ereignis-Log je Spiel-ID (nur, was über die Engine lief). */
  events: ReadonlyMap<string, readonly EngineEvent[]>;
}

const repository = { save: () => Promise.resolve() } as unknown as ITournamentRepository;

/** Veröffentlichen + Mapper-Rundlauf. Spiel 9 beginnt um 14:40 (Anstoß 13:52, 12 Minuten je Spiel). */
export async function publishHallencup(): Promise<Hallencup> {
  const published = await new TournamentCreationService(repository).publish({
    title: 'Hallencup Nord',
    date: '2026-11-28',
    timeSlot: '13:52 - 18:00',
    numberOfFields: 2,
    numberOfTeams: 8,
    numberOfGroups: 2,
    groupSystem: 'groupsAndFinals',
    finalsConfig: { preset: 'top-4' },
    teams: TEAMS,
    isPublic: true,
    shareCode: 'NORD28',
  });
  const matches = published.matches.map((m) => roundTrip(m, published.id, published.date));
  return { tournament: { ...published, matches }, events: new Map() };
}

function roundTrip(match: Match, tournamentId: string, date: string, overlay: Parameters<typeof createMatchRow>[0] = {}): Match {
  return mapMatchFromSupabase(createMatchRow({ ...mapMatchToSupabase(match, tournamentId), ...overlay }), date);
}

/** Spielt Ereignisse über die Engine und übernimmt die Cache-Spalten über den Mapper ins Spiel. */
function playMatch(cup: Hallencup, index: number, events: (a: string, b: string) => EngineEvent[]): Hallencup {
  const match = cup.tournament.matches[index];
  const teamAId = slotTeamId(match.slotA);
  const teamBId = slotTeamId(match.slotB);
  if (teamAId === undefined || teamBId === undefined) {
    throw new Error(`Fixture: Spiel ${index + 1} hat eine offene Seite`);
  }
  const log = events(teamAId, teamBId);
  const ctx = { matchId: match.id, teamAId, teamBId };
  const { state } = reduceMatch(log, ctx);
  // Nur die Ergebnis-/Status-Spalten; Zeitstempel (Epoch-ms im Cache) und live_state braucht die Ansicht nicht.
  const { running: _running, started: _started, anchor_at: _anchor, finished_at: _finished, live_state: _live,
    skipped_at: _skippedAt, skipped_reason: _reason, ...columns } = cacheColumns(state, ctx);
  const played = roundTrip(match, cup.tournament.id, cup.tournament.date, columns);
  const matches = cup.tournament.matches.map((m, i) => (i === index ? played : m));
  return { tournament: { ...cup.tournament, matches }, events: new Map([...cup.events, [match.id, log]]) };
}

function updateMatch(cup: Hallencup, index: number, change: (m: Match) => Match): Hallencup {
  const matches = cup.tournament.matches.map((m, i) => (i === index ? change(m) : m));
  return { ...cup, tournament: { ...cup.tournament, matches } };
}

/** Besetzt einen Platz so, wie der Resolver es tut (Team + `resolvedFrom` = Herkunft des Platzes). */
function resolveSide(cup: Hallencup, index: number, side: 'A' | 'B', teamId: string): Hallencup {
  return updateMatch(cup, index, (m) => {
    const origin = side === 'A' ? m.originA : m.originB;
    if (origin === undefined) {
      throw new Error('Fixture: Finalspiel ohne Herkunft');
    }
    return side === 'A' ? { ...m, slotA: resolveSlot(origin, teamId) } : { ...m, slotB: resolveSlot(origin, teamId) };
  });
}

/** Ergebnisse (Heim:Gast je Index) über RESULT_ENTRY eintragen. */
function results(cup: Hallencup, scores: Readonly<Record<number, [number, number]>>): Hallencup {
  return Object.entries(scores).reduce(
    (acc, [index, [a, b]]) => playMatch(acc, Number(index), (ta, tb) => play.resultEntry(100 + Number(index), ta, tb, a, b)),
    cup,
  );
}

/** Gruppe A: FC Nord Erster, DJK Berg Zweiter, TSV West Dritter, SC Ost Vierter. */
const GROUP_A: Record<number, [number, number]> = { 0: [0, 2], 1: [1, 0], 4: [0, 1], 5: [2, 0], 8: [1, 0], 9: [2, 0] };
/** Spiele 1–8 beendet (für „läuft / als Nächstes“). */
const FIRST_EIGHT: Record<number, [number, number]> = { 0: [0, 2], 1: [1, 0], 2: [2, 1], 3: [1, 1], 4: [0, 1], 5: [2, 0], 6: [1, 0], 7: [0, 3] };

/** F-HF: Gruppe A beendet, HF1-Heim mit FC Nord besetzt (`resolvedFrom` = `originA` = A1), HF1-Gast offen (B2). */
export async function fHF(): Promise<Hallencup> {
  return resolveSide(results(await publishHallencup(), GROUP_A), GAME.HF1, 'A', NORD);
}

/** F-TAB: F-HF + „Gruppentabellen aus“. */
export async function fTAB(): Promise<Hallencup> {
  const cup = await fHF();
  return { ...cup, tournament: { ...cup.tournament, hideRankingsForPublic: true } };
}

/** F-3G: F-HF, danach drei Gruppen in der Konfiguration (Drift), Spiele unverändert. */
export async function f3G(): Promise<Hallencup> {
  const cup = await fHF();
  return { ...cup, tournament: { ...cup.tournament, numberOfGroups: 3 } };
}

/** F-NEU: HF2-Heim („Erster Gruppe B“) per „Neu besetzen“ mit TSV West. */
export async function fNEU(): Promise<Hallencup> {
  return updateMatch(await fHF(), GAME.HF2, (m) => assignTeamToSide(m, 'A', WEST));
}

/** F-PAUSE: Spiele 1–6 beendet; Spiel 7 per Engine bei 1:0 angehalten, Spiel 8 angepfiffen (0:0). */
export async function fPAUSE(): Promise<Hallencup> {
  const firstSix = Object.fromEntries(Object.entries(FIRST_EIGHT).filter(([i]) => Number(i) < 6));
  const cup = results(await publishHallencup(), firstSix);
  const paused = playMatch(cup, GAME[7], (a) => play.pausedAtOneNil(7, a));
  return playMatch(paused, GAME[8], () => play.kickedOff(8));
}

/**
 * F-BEENDEN (@FU-112, @FU-114): Spiele 1–6 beendet; Spiel 7 angepfiffen, 1:0, Spielzeit abgelaufen ohne Abpfiff -- mit
 * `beendet` danach im Spielplan mit 2:2 beendet (ein Eintrag, Abpfiff und Ergebnis).
 */
export async function fBEENDEN(beendet: boolean): Promise<Hallencup> {
  const firstSix = Object.fromEntries(Object.entries(FIRST_EIGHT).filter(([i]) => Number(i) < 6));
  return playMatch(results(await publishHallencup(), firstSix), GAME[7], (a, b) => play.endedInSchedule(7, a, b, 2, 2, !beendet));
}

/** F-AUS: Spiele 1–8 beendet, Spiel 9 per Engine abgesetzt. */
export async function fAUS(): Promise<Hallencup> {
  return playMatch(results(await publishHallencup(), FIRST_EIGHT), GAME[9], () => play.skipped(9));
}

/** F-ZEIT: Spiele 1–8 beendet; Spiel 9 (14:40) ist das nächste auf Feld 1. Gerätezeitzone setzt der Test. */
export async function fZEIT(): Promise<Hallencup> {
  return results(await publishHallencup(), FIRST_EIGHT);
}

/** F-NV: HF2 (SG Mitte – DJK Berg) 1:1, Verlängerung 3:0 → 4:1 n. V. */
export async function fNV(): Promise<Hallencup> {
  const cup = resolveSide(resolveSide(await publishHallencup(), GAME.HF2, 'A', MITTE), GAME.HF2, 'B', BERG);
  return playMatch(cup, GAME.HF2, (a, b) => play.overtimeFourOne(14, a, b));
}

/** F-ES: Finale (FC Nord – SG Mitte) 1:1 n. V., Strafstoßschießen 4:3 → Sieger Heim. */
export async function fES(): Promise<Hallencup> {
  const cup = resolveSide(resolveSide(await publishHallencup(), GAME.FINAL, 'A', NORD), GAME.FINAL, 'B', MITTE);
  return playMatch(cup, GAME.FINAL, (a, b) => play.shootoutFourThree(15, a, b));
}

/** F-NUR: Spiel 3 nur per Ergebnis eingetragen (2:1), kein Verlauf. */
export async function fNUR(): Promise<Hallencup> {
  return results(await publishHallencup(), { [GAME[3]]: [2, 1] });
}

/** HF1 besetzt: FC Nord (Erster Gruppe A) gegen SV Süd (Zweiter Gruppe B). */
export async function hf1Besetzt(): Promise<Hallencup> {
  return resolveSide(resolveSide(await publishHallencup(), GAME.HF1, 'A', NORD), GAME.HF1, 'B', SUED);
}

/**
 * Cloud-Zeile eines Spiels mit den Spalten `overlay` überschreiben und über den Mapper zurücklesen
 * (Datenebene: so liefert die Cloud das Spiel, ohne dass ein Ereignis gelaufen ist).
 */
export function withCloudColumns(cup: Hallencup, index: number, overlay: Parameters<typeof createMatchRow>[0]): Hallencup {
  return updateMatch(cup, index, (m) => roundTrip(m, cup.tournament.id, cup.tournament.date, overlay));
}

/** Ergebnis nur eingetragen (RESULT_ENTRY über die Engine), z. B. für ein K.-o.-Spiel. */
export function directEntry(cup: Hallencup, index: number, a: number, b: number): Hallencup {
  return results(cup, { [index]: [a, b] });
}
