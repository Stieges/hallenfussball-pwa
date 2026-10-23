/**
 * Test-Hilfen Paket TB, Task TB-4 (alle Leser je Gruppe, Platzziffer, Endstand): Turniere mit zwei Gruppen aus den Daten
 * von Plan v2 Abschnitt 6 und die Lagen zu @ET-020, @ET-021, @ET-029. Nur Testumgebung.
 */
import type { PlacementCriterion, Tournament } from '../../../types/tournament';
import { createMockTournament } from '../../../test/factories';
import { calculateStandings, getMergedFinalRanking } from '../../../utils/calculations';
import { BFV_ORDER, league, NAME, type Key } from './fixtures';
import { MemoryRepo, shared } from './decisionTestKit';

/** Gruppe B: TSV Waging blau 9 Punkte (+3), TSV Petting 6, SV Süd 3, TuS Tal 0 – gegengerechnet (wie TB-1). */
export const GRUPPE_B = 'X–P 1:0; X–S 1:0; X–T 1:0; P–S 1:0; P–T 1:0; S–T 1:0';

/** @ET-029: Mitte allein auf 1, Nord und Ufer gleich auf 2 und 3. */
export const DATEN_029 = 'M–N 1:0; M–U 1:0; M–W 1:0; M–O 1:0; M–B 1:0; N–U 1:1; N–W 1:0; N–O 1:0; N–B 1:0; U–W 1:0; U–O 1:0; U–B 1:0; W–O 1:0; W–B 1:0; O–B 1:0';

/**
 * @ET-021 (Aufbau): Gruppe A mit vier Teams, TSV West und SC Ost nach allen Kriterien gleich auf Platz 3 und 4
 * (je 1 Punkt, Tordifferenz −2, 1 Tor, direktes Spiel 1:1). Die Zahlen des Records (3 Punkte, −2, 4 Tore) sind in einer
 * Vierergruppe mit gleichem direktem Spiel nicht möglich (Report TB-4); der Aufbau bleibt gleich.
 */
export const ET021_GRUPPE_A = 'N–S 1:0; N–W 1:0; N–O 1:0; S–W 1:0; S–O 1:0; W–O 1:1';
/** @ET-021: Gruppe B, VfB Ufer Dritter (3 Punkte, mehr als West/Ost), TuS Tal Vierter. */
export const ET021_GRUPPE_B = 'M–B 1:0; M–U 1:0; M–T 1:0; B–U 1:0; B–T 1:0; U–T 1:0';

interface ZweiGruppenOptions {
  placementLogic?: PlacementCriterion[];
  open?: string[];
}

/** Zwei Gruppen: A mit den Teams `keysA` und den Ergebnissen `gruppeA`, B mit `keysB`; Version 1 für Entscheidungen. */
export function zweiGruppen(keysA: string, gruppeA: string, keysB: string, gruppeB: string, opts: ZweiGruppenOptions = {}): Tournament {
  const a = league(keysA, gruppeA, { group: 'A', idPrefix: 'a', ...(opts.open !== undefined ? { open: opts.open } : {}) });
  const b = league(keysB, gruppeB, { group: 'B', idPrefix: 'b' });
  return {
    ...createMockTournament({
      teams: [...a.teams, ...b.teams],
      matches: [...a.matches, ...b.matches],
      placementLogic: opts.placementLogic ?? BFV_ORDER,
      groupSystem: 'groupsAndFinals',
    }),
    version: 1,
  };
}

/** Das Zwei-Gruppen-Turnier der Leser-Tests: Gruppe A „Jeder gegen jeden“ aus `gruppeA` (Kammer/Waging rot …), B wie TB-1. */
export const zweiGruppenWaging = (gruppeA: string, opts: ZweiGruppenOptions = {}): Tournament =>
  zweiGruppen('KRMUNO', gruppeA, 'XPST', GRUPPE_B, opts);

/** „Ergebnis so akzeptieren“ über den Dienst eintragen (wie die Turnierleitung); wirft, wenn abgelehnt. */
export async function mitAnnahme(tournament: Tournament, keys: Key[], group = ''): Promise<Tournament> {
  const repo = new MemoryRepo(tournament);
  const result = await repo.service().decide(repo.tournament.id, shared(keys, group));
  if (!result.ok) {
    throw new Error(`Ergebnis so akzeptieren abgelehnt: ${result.code}`);
  }
  return repo.tournament;
}

/** Endstand eines Turniers wie in der App: Tabelle gruppenübergreifend (`overallStandings`) → Platz je Teamname. */
export function endstand(tournament: Tournament): Map<string, number> {
  const overall = calculateStandings(tournament.teams, tournament.matches, tournament);
  const { ranking } = getMergedFinalRanking(tournament.teams, tournament.matches, overall, tournament);
  return new Map(ranking.map((p) => [p.team.name, p.rank]));
}

/** Plätze der Teams `keys` in der Reihenfolge von `keys`. */
export const plaetze = (ranks: Map<string, number>, ...keys: Key[]): Array<number | undefined> =>
  keys.map((key) => ranks.get(NAME[key]));

/**
 * Teamname aus dem Text einer Tabellenzelle (die Zelle trägt vor dem Namen die Initialen des Teamsymbols und, in der
 * App-Ansicht bei Gleichstand, hinter dem Namen eine Marke wie „Gleichstand – Entscheidung nötig“, Paket TB-B).
 */
export const teamNameIn = (cellText: string): string =>
  Object.values(NAME).filter((name) => cellText.includes(name)).sort((a, b) => b.length - a.length)[0] ?? cellText;
