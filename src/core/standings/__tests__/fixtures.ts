/**
 * Testdaten Paket TB „Tabelle nach BFV privat“ – wörtlich aus Plan v2 Abschnitt 6
 * (`.superpowers/sdd/2026-10-03-mvp-bauplan/plan-tabelle-bfv-privat-v2.md`), Schreibweise „Heim – Gast x:y“.
 * Nur Testumgebung. Jeder Datensatz ist ein vollständiges „Jeder gegen jeden“ (alle Paarungen), offene oder
 * nicht ausgetragene Spiele werden ausdrücklich markiert.
 */
import type { Match, MatchStatus, PlacementCriterion, PointSystem, Team, Tournament } from '../../../types/tournament';
import { createMockTournament } from '../../../test/factories';
import { vs, testUuid } from '../../../test/matchSlotFixtures';

/** Kurzzeichen → Teamname (Abschnitt 6). */
export const NAME = {
  W: 'TSV West', O: 'SC Ost', U: 'VfB Ufer', M: 'SG Mitte', N: 'FC Nord', B: 'DJK Berg',
  R: 'TSV Waging rot', K: 'DJK Kammer', S: 'SV Süd', T: 'TuS Tal', X: 'TSV Waging blau', P: 'TSV Petting',
} as const;
export type Key = keyof typeof NAME;

const KEY_INDEX: Record<Key, number> = { W: 1, O: 2, U: 3, M: 4, N: 5, B: 6, R: 7, K: 8, S: 9, T: 10, X: 11, P: 12 };

/** Team-ID je Kurzzeichen (UUID, wie im Produktivcode). */
export const id = (key: Key): string => testUuid(KEY_INDEX[key]);

/** BFV privat (Plan v2 § 3.1 `DEFAULT_PLACEMENT_LOGIC`): Punkte, direkter Vergleich, Tordifferenz, Tore. */
export const BFV_ORDER: PlacementCriterion[] = [
  { id: 'points', enabled: true },
  { id: 'directComparison', enabled: true },
  { id: 'goalDifference', enabled: true },
  { id: 'goalsFor', enabled: true },
];

/** Gegenbeispiel-Reihenfolge „Punkte, Tordifferenz, Tore, direkter Vergleich“ (@ET-056, @W2A-056). */
export const GD_FIRST_ORDER: PlacementCriterion[] = [
  { id: 'points', enabled: true },
  { id: 'goalDifference', enabled: true },
  { id: 'goalsFor', enabled: true },
  { id: 'directComparison', enabled: true },
];

export const POINTS_310: PointSystem = { win: 3, draw: 1, loss: 0 };
export const POINTS_210: PointSystem = { win: 2, draw: 1, loss: 0 };

/** Abschnitt 6 – Ergebnislisten. */
export const DATA = {
  W2A_041: 'W–O 1:0; O–U 5:0; U–W 1:0; W–M 2:0; W–N 1:1; B–W 1:0; O–N 1:0; O–B 0:0; M–O 1:0; U–B 10:0; U–M 1:1; N–U 1:0; M–N 2:0; M–B 1:0; N–B 1:1',
  W2A_042: 'W–O 1:0; O–U 1:0; U–W 1:0; W–M 4:0; W–N 1:1; B–W 1:0; O–N 2:0; O–B 0:0; M–O 1:0; U–B 1:0; U–M 1:1; N–U 2:0; M–N 2:0; M–B 1:0; N–B 1:1',
  W2A_044: 'W–O 1:0; O–U 1:0; U–W 1:0; W–M 2:0; W–N 1:1; B–W 1:0; O–N 2:0; O–B 1:1; M–O 1:0; U–B 2:0; U–M 1:1; N–U 1:0; M–N 2:0; M–B 1:0; N–B 1:1',
  W2A_043: 'M–W 3:0; W–O 2:0; O–M 2:1; M–U 1:0; N–M 1:0; B–M 2:0; W–N 1:0; U–W 1:0; B–W 2:0; O–U 1:1; O–N 0:0; O–B 2:2; U–N 1:1; B–U 1:0; B–N 3:0',
  W2A_057: 'M–W 3:0; W–O 2:0; O–M 2:1; M–U 1:0; N–M 1:0; B–M 2:0; W–N 2:0; U–W 1:0; B–W 1:0; O–U 1:1; O–N 0:0; O–B 1:1; U–N 1:1; B–U 1:0; B–N 3:0',
  /** Gegeben im Szenario @W2A-045 (5 Teams, Punkteschema 2/1/0). */
  W2A_045: 'M–N 1:0; W–N 1:0; O–N 1:0; U–N 1:0; U–M 2:2; U–W 2:2; U–O 2:2; M–W 1:0; W–O 1:0; O–M 3:0',
  ET_055: 'R–K 1:1; R–N 2:0; R–O 1:0; M–R 1:0; U–R 2:0; K–M 2:0; K–U 1:0; N–K 1:0; O–K 2:0; M–U 1:0; M–N 2:0; M–O 1:0; U–N 1:0; U–O 2:0; N–O 1:0',
  ET_056: 'K–R 2:1; R–N 3:0; R–O 3:0; R–M 2:0; U–R 1:0; K–M 1:0; K–U 1:0; N–K 1:0; O–K 1:0; M–U 1:0; N–M 1:1; O–M 0:2; U–N 2:0; U–O 1:1; N–O 1:0',
  /** Gruppe A aus @W2A-048. */
  W2A_048_A: 'N–S 2:1; N–W 2:1; N–O 0:0; S–W 1:1; S–O 2:0; W–O 2:0',
} as const;

export interface Fixture {
  teams: Team[];
  matches: Match[];
  tournament: Tournament;
}

interface Options {
  pointSystem?: PointSystem;
  placementLogic?: PlacementCriterion[];
  /** Paarungen „H–G“, die noch offen sind (ohne Stand, `scheduled`). */
  open?: string[];
  /** Paarungen „H–G“, die als „nicht ausgetragen“ beendet wurden (`skipped`, ohne Stand). */
  skipped?: string[];
  /** Gruppenbuchstabe der Teams und Spiele (ohne: Jeder gegen jeden ohne Gruppe). */
  group?: string;
  /** Präfix der Spiel-IDs, damit zwei Gruppen in einem Turnier eindeutige Spiele haben. */
  idPrefix?: string;
}

const RESULT = /^([A-Z])\s*–\s*([A-Z])\s+(\d+):(\d+)$/;

/** Baut Spiele aus „H–G x:y; …“. Offene/nicht ausgetragene Paarungen verlieren ihren Stand. */
export function parseMatches(results: string, opts: Options = {}): Match[] {
  return results.split(';').map((raw, index) => {
    const part = raw.trim();
    const m = RESULT.exec(part);
    if (m === null) {
      throw new Error(`Fixture: unlesbares Ergebnis „${part}“`);
    }
    const [, a, b, x, y] = m;
    const pairing = `${a}–${b}`;
    const status: MatchStatus = opts.open?.includes(pairing) === true
      ? 'scheduled'
      : opts.skipped?.includes(pairing) === true ? 'skipped' : 'finished';
    const base: Match = {
      id: `${opts.idPrefix ?? 'm'}-${index + 1}`,
      round: index + 1,
      field: 1,
      ...vs(id(a as Key), id(b as Key)),
      matchStatus: status,
      ...(opts.group !== undefined ? { group: opts.group } : {}),
    };
    if (status === 'skipped') {
      return { ...base, skippedReason: 'Hallenzeit abgelaufen' };
    }
    return status === 'finished' ? { ...base, scoreA: Number(x), scoreB: Number(y) } : base;
  });
}

/** Teams aus Kurzzeichen in der angegebenen Reihenfolge (= Eingabereihenfolge der Tabelle). */
export function teamsOf(keys: string, group?: string): Team[] {
  return [...keys].map((key) => ({ id: id(key as Key), name: NAME[key as Key], ...(group !== undefined ? { group } : {}) }));
}

/** Ein privates Turnier „Jeder gegen jeden“ (bzw. eine Gruppe) aus Teams und Ergebnissen. */
export function league(keys: string, results: string, opts: Options = {}): Fixture {
  const teams = teamsOf(keys, opts.group);
  const matches = parseMatches(results, opts);
  const tournament = createMockTournament({
    teams,
    matches,
    pointSystem: opts.pointSystem ?? POINTS_310,
    placementLogic: opts.placementLogic ?? BFV_ORDER,
    groupSystem: 'roundRobin',
  });
  return { teams, matches, tournament };
}

/** Ändert den Stand einer Paarung „H–G“ (Korrektur). */
export function withResult(results: string, pairing: string, score: string): string {
  const parts = results.split(';').map((p) => p.trim());
  const index = parts.findIndex((p) => p.startsWith(`${pairing} `));
  if (index < 0) {
    throw new Error(`Fixture: Paarung ${pairing} fehlt`);
  }
  parts[index] = `${pairing} ${score}`;
  return parts.join('; ');
}

/** Teamnamen in Tabellenreihenfolge. */
export const names = (rows: ReadonlyArray<{ team: Team }>): string[] => rows.map((r) => r.team.name);
