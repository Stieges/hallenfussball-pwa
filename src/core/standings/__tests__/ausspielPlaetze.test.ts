/**
 * Paket TB-B, Task TB-3' (Kern): „Diese Plätze müssen bei Gleichstand ausgespielt werden“ (Daniel 2026-10-20) –
 * ob es nur das Strafstoßschießen gibt oder auch „Ergebnis so akzeptieren“, hängt an der Einstellung und daran, ob ein
 * Platz des Blocks in ein weiteres Spiel führt (ganzer Block). Records `2026-09-27_wizard-regelinhalte` (@W2A-063,
 * @W2A-064, @W2A-067), `2026-10-01_endstand-und-torschuetzen` (@ET-025, @ET-026, @ET-057), `2026-10-01_turniermodi`
 * (@TM-060). Hinweisform der Oberfläche (TB-6b'): `sharedPlaceAllowed` falsch = „Strafstoßschießen nötig“, wahr =
 * „Gleichstand – Entscheidung nötig“ mit Wahl. Daten gegengerechnet (Report TB-3').
 */
import { describe, expect, it } from 'vitest';
import { rankTournamentGroup } from '../tournamentTable';
import { sharedPlaceAllowed } from '../decisions';
import { validateDraft } from '../validateDraft';
import { createMockTournament } from '../../../test/factories';
import { groupRank, slots } from '../../../test/matchSlotFixtures';
import type { Match, Standing, Tournament } from '../../../types/tournament';
import { BFV_ORDER, id, names, NAME, parseMatches, POINTS_310, teamsOf, type Key } from './fixtures';
import { jgj, lage048, MemoryRepo, nikolaus, shared, shootout } from './decisionTestKit';
import { endstand, plaetze } from './tb4Kit';

const row = (rows: Standing[], key: Key): Standing => {
  const found = rows.find((r) => r.team.id === id(key));
  if (found === undefined) { throw new Error(`Team ${key} fehlt`); }
  return found;
};

/** SG Mitte und FC Nord gleich auf Platz 1 und 2 (direkt 2:2). */
const DATEN_PLATZ_1 = 'M–N 2:2; M–W 1:0; M–O 1:0; M–U 1:0; M–B 1:0; N–W 1:0; N–O 1:0; N–U 1:0; N–B 1:0; W–O 1:0; W–U 1:0; W–B 1:0; O–U 1:0; O–B 1:0; U–B 1:0';
/** TSV West, SC Ost, VfB Ufer gleich auf Platz 3 bis 5 (Ringspiel 1:0, je 6 Punkte, −1, 2 Tore); Mitte 15, Nord 12, Berg 0. */
const DATEN_3_BIS_5 = 'M–N 1:0; M–W 1:0; M–O 1:0; M–U 1:0; M–B 1:0; N–W 1:0; N–O 1:0; N–U 1:0; N–B 1:0; W–O 1:0; O–U 1:0; U–W 1:0; W–B 1:0; O–B 1:0; U–B 1:0';
/** Gruppe A zu vier: Nord 9, Süd 6, West und Ost je 1 Punkt, −2, 1 Tor, direkt 1:1 (gleich auf 3 und 4, wie @ET-021). */
const GRUPPE_A_3_4 = 'N–S 1:0; N–W 1:0; N–O 1:0; S–W 1:0; S–O 1:0; W–O 1:1';
const GRUPPE_B = 'M–B 2:0; M–U 2:0; M–T 2:0; B–U 2:1; B–T 1:0; U–T 1:0';
/** @ET-025 Zeile 4: Waging blau und Petting als einzige je 4 Punkte, gleich auf 5 und 6. */
const DATEN_5_6 = 'M–N 1:1; M–U 1:1; M–W 1:1; M–X 3:0; M–P 3:0; N–U 1:1; N–W 1:1; N–X 1:0; N–P 1:0; U–W 2:1; U–X 2:0; P–U 1:0; W–P 2:0; X–W 1:0; X–P 1:1';
/** @ET-025 Zeile 3: Gruppe B des Hallencup Nord mit DJK Berg und VfB Ufer gleich auf 2 und 3 (je 4 Punkte, 0, 2 Tore, direkt 1:1). */
const GRUPPE_B_2_3 = 'M–B 1:0; M–U 1:0; M–T 1:0; B–U 1:1; B–T 1:0; U–T 1:0';

/** Zwei Gruppen mit Halbfinals wie „Hallencup Nord“ (HF1 Erster A – Zweiter B, HF2 Erster B – Zweiter A) und weiteren Spielen. */
function hallencup(gruppeA: string, gruppeB: string, extra: Match[], places?: number[]): Tournament {
  const semis: Match[] = [
    { id: 'hf-1', round: 7, field: 1, isFinal: true, phase: 'semifinal', label: 'Halbfinale 1', ...slots(groupRank('A', 1), groupRank('B', 2)) },
    { id: 'hf-2', round: 7, field: 2, isFinal: true, phase: 'semifinal', label: 'Halbfinale 2', ...slots(groupRank('B', 1), groupRank('A', 2)) },
  ];
  return createMockTournament({
    teams: [...teamsOf('NSWO', 'A'), ...teamsOf('MBUT', 'B')],
    matches: [...parseMatches(gruppeA, { group: 'A', idPrefix: 'a' }), ...parseMatches(gruppeB, { group: 'B', idPrefix: 'b' }), ...semis, ...extra],
    pointSystem: POINTS_310, placementLogic: BFV_ORDER, groupSystem: 'groupsAndFinals', version: 1,
    ...(places !== undefined ? { placementsToPlayOut: places } : {}),
  });
}

const platzspiel = (matchId: string, label: string, rankA: number, rankB: number): Match =>
  ({ id: matchId, round: 8, field: 1, isFinal: true, phase: 'placement', label, ...slots(groupRank('A', rankA), groupRank('B', rankB)) });

describe("TB-3' Einstellung „Diese Plätze müssen bei Gleichstand ausgespielt werden“", () => {
  it.each([
    { plaetze: 'Platz 1 bis 3', einstellung: [1, 2, 3], wahl: false },
    { plaetze: 'nur Platz 1 (Voreinstellung)', einstellung: undefined, wahl: true },
    { plaetze: 'kein Platz', einstellung: [], wahl: true },
  ])('@W2A-067 Nikolaus, eingestellt $plaetze: Petting und Otting beide auf Platz 3, markiert, Wahl angeboten: $wahl', async ({ einstellung, wahl }) => {
    const repo = new MemoryRepo(nikolaus(einstellung));
    const { rows } = rankTournamentGroup(repo.tournament, '');
    expect(names(rows)).toEqual([NAME.K, NAME.R, NAME.P, NAME.D, NAME.F, NAME.X]);
    expect([row(rows, 'P').place, row(rows, 'D').place]).toEqual([3, 3]);
    expect([row(rows, 'P').decisionNeeded, row(rows, 'D').decisionNeeded]).toEqual([true, true]);
    expect(sharedPlaceAllowed(repo.tournament, '', { place: 3, size: 2 })).toBe(wahl);

    const annahme = await repo.service().decide(repo.tournament.id, shared(['P', 'D']));
    expect(annahme.ok).toBe(wahl);
    if (!wahl) {
      expect(annahme).toEqual({ ok: false, code: 'SHARED_PLACE_NOT_ALLOWED' });
      expect(repo.writes).toBe(0);
      // Gegenbeispiel: das Strafstoßschießen nimmt die App immer an.
      expect((await repo.service().decide(repo.tournament.id, shootout('D', 'P', 4, 3))).ok).toBe(true);
    }
  });

  it.each([
    { lage: 'Jeder gegen jeden, SG Mitte und FC Nord gleich auf Platz 1 und 2, nur Platz 1 (Voreinstellung)', bau: () => jgj('MNWOUB', DATEN_PLATZ_1), block: ['M', 'N'] as Key[], gruppe: '', platz: 1 },
    { lage: '@W2A-048: SV Süd und TSV West gleich auf 2 und 3 von Gruppe A, „Zweiter Gruppe A“ in Halbfinale 2, nur Platz 1', bau: () => ({ ...lage048(), placementsToPlayOut: [1] }), block: ['S', 'W'] as Key[], gruppe: 'A', platz: 2 },
    { lage: 'Hallencup Nord mit Spiel um Platz 7 „Vierter A gegen Vierter B“, ohne Spiel um Platz 5, West und Ost gleich auf 3 und 4, nur Platz 1 und 2', bau: () => hallencup(GRUPPE_A_3_4, GRUPPE_B, [platzspiel('p7', 'Spiel um Platz 7', 4, 4)], [1, 2]), block: ['W', 'O'] as Key[], gruppe: 'A', platz: 3 },
    { lage: 'Jeder gegen jeden, West, Ost und Ufer gleich auf Platz 3 bis 5, Platz 1 bis 3', bau: () => jgj('MNWOUB', DATEN_3_BIS_5, [1, 2, 3]), block: ['W', 'O', 'U'] as Key[], gruppe: '', platz: 3 },
  ])('@W2A-064 nur das Strafstoßschießen, „Ergebnis so akzeptieren“ gibt es nicht: $lage', async ({ bau, block, gruppe, platz }) => {
    const repo = new MemoryRepo(bau());
    const { rows } = rankTournamentGroup(repo.tournament, gruppe);
    expect(block.map((k) => row(rows, k).place)).toEqual(block.map(() => platz));
    expect(block.map((k) => row(rows, k).decisionNeeded)).toEqual(block.map(() => true));
    expect(sharedPlaceAllowed(repo.tournament, gruppe, { place: platz, size: block.length })).toBe(false);
    expect(await repo.service().decide(repo.tournament.id, shared(block, gruppe))).toEqual({ ok: false, code: 'SHARED_PLACE_NOT_ALLOWED' });
    expect(repo.writes).toBe(0);
  });

  it('@W2A-064 ganzer Block: steht nur der letzte Platz des Blocks in der Einstellung (Platz 4 bei Petting/Otting auf 3 und 4), gibt es nur das Strafstoßschießen', async () => {
    const repo = new MemoryRepo(nikolaus([4]));
    expect(sharedPlaceAllowed(repo.tournament, '', { place: 3, size: 2 })).toBe(false);
    expect(await repo.service().decide(repo.tournament.id, shared(['P', 'D']))).toEqual({ ok: false, code: 'SHARED_PLACE_NOT_ALLOWED' });
    // Gegenbeispiel: Platz 5 berührt den Block nicht – die Wahl bleibt.
    expect(sharedPlaceAllowed(nikolaus([5]), '', { place: 3, size: 2 })).toBe(true);
  });

  it('@W2A-063 Nikolaus, nur Platz 1 und 2: „Ergebnis so akzeptieren“ ohne Grund und ohne Rückfrage – Petting und Otting auf 3, Fridolfing 5, Waging blau 6, in Tabelle und Endstand', async () => {
    const repo = new MemoryRepo(nikolaus([1, 2]));
    const result = await repo.service().decide(repo.tournament.id, shared(['P', 'D']));
    expect(result.ok).toBe(true);
    expect(repo.writes).toBe(1);
    const { rows, openTies } = rankTournamentGroup(repo.tournament, '');
    expect(['K', 'R', 'P', 'D', 'F', 'X'].map((k) => row(rows, k as Key).place)).toEqual([1, 2, 3, 3, 5, 6]);
    expect(rows.some((r) => r.decisionNeeded)).toBe(false);
    expect(openTies).toEqual([]);
    expect(plaetze(endstand(repo.tournament), 'K', 'R', 'P', 'D', 'F', 'X')).toEqual([1, 2, 3, 3, 5, 6]);
    // Gegenbeispiel: ohne Annahme bleiben beide markiert, der Endstand teilt nicht still.
    const ohne = rankTournamentGroup(nikolaus([1, 2]), '');
    expect([row(ohne.rows, 'P').decisionNeeded, row(ohne.rows, 'D').decisionNeeded]).toEqual([true, true]);
    expect(plaetze(endstand(nikolaus([1, 2])), 'P', 'D')).toEqual([3, 4]);
  });

  it.each([
    { plaetze: 'nur Platz 3', einstellung: [3] },
    { plaetze: 'kein Platz', einstellung: [] },
  ])('@ET-057 Platz 1 abgewählt ($plaetze): nach „Ergebnis so akzeptieren“ stehen SG Mitte und FC Nord beide auf Platz 1, das nächste Team auf 3', async ({ einstellung }) => {
    const repo = new MemoryRepo(jgj('MNWOUB', DATEN_PLATZ_1, einstellung));
    expect(sharedPlaceAllowed(repo.tournament, '', { place: 1, size: 2 })).toBe(true);
    expect((await repo.service().decide(repo.tournament.id, shared(['M', 'N']))).ok).toBe(true);
    const { rows } = rankTournamentGroup(repo.tournament, '');
    expect(['M', 'N', 'W'].map((k) => row(rows, k as Key).place)).toEqual([1, 1, 3]);
    expect(plaetze(endstand(repo.tournament), 'M', 'N', 'W')).toEqual([1, 1, 3]);
  });

  it.each([
    { zeile: 'Platz 1 bis 3, West und Ost auf 3 und 4', bau: () => jgj('WOUMNB', 'W–O 1:1; W–U 0:1; W–M 0:1; W–N 1:0; W–B 1:0; O–U 0:1; O–M 0:1; O–N 1:0; O–B 1:0; U–M 1:0; U–N 1:0; U–B 1:0; M–N 1:0; M–B 1:0; N–B 1:0', [1, 2, 3]), gruppe: '', block: ['W', 'O'] as Key[], platz: 3, wahl: false },
    { zeile: 'Voreinstellung, SG Mitte und FC Nord auf 1 und 2', bau: () => jgj('MNWOUB', DATEN_PLATZ_1), gruppe: '', block: ['M', 'N'] as Key[], platz: 1, wahl: false },
    { zeile: 'Hallencup Nord, DJK Berg und VfB Ufer auf 2 und 3 von Gruppe B (Zweiter B in Halbfinale 1)', bau: () => hallencup(GRUPPE_A_3_4, GRUPPE_B_2_3, []), gruppe: 'B', block: ['B', 'U'] as Key[], platz: 2, wahl: false },
    { zeile: 'Voreinstellung, Waging blau und Petting auf 5 und 6', bau: () => jgj('MNUWXP', DATEN_5_6), gruppe: '', block: ['X', 'P'] as Key[], platz: 5, wahl: true },
  ])('@ET-025 Hinweisform je Platz: $zeile', ({ bau, gruppe, block, platz, wahl }) => {
    const t = bau();
    const { rows } = rankTournamentGroup(t, gruppe);
    expect(block.map((k) => row(rows, k).place)).toEqual(block.map(() => platz));
    expect(block.map((k) => row(rows, k).decisionNeeded)).toEqual(block.map(() => true));
    expect(sharedPlaceAllowed(t, gruppe, { place: platz, size: block.length })).toBe(wahl);
  });

  it('@ET-026 Jeder gegen jeden, Platz 1 eingestellt (Voreinstellung): über Platz 1 entscheidet nur ein Strafstoßschießen', async () => {
    const repo = new MemoryRepo(jgj('MNWOUB', DATEN_PLATZ_1));
    expect(validateShared(repo.tournament, ['M', 'N'])).toBe('SHARED_PLACE_NOT_ALLOWED');
    expect((await repo.service().decide(repo.tournament.id, shootout('M', 'N', 3, 2))).ok).toBe(true);
  });

  it.each([
    { plaetze: 'nur Platz 1 und 2', einstellung: [1, 2], extra: [] as Match[], wahl: true },
    { plaetze: 'Platz 1 bis 3', einstellung: [1, 2, 3], extra: [] as Match[], wahl: false },
    { plaetze: 'nur Platz 1 und 2, Spiel um Platz 5 „Dritter A gegen Dritter B“', einstellung: [1, 2], extra: [platzspiel('p5', 'Spiel um Platz 5', 3, 3)], wahl: false },
  ])('@TM-060:teil Gruppe A, West und Ost gleich auf 3 und 4, $plaetze: „Ergebnis so akzeptieren“ angeboten: $wahl', ({ einstellung, extra, wahl }) => {
    const t = hallencup(GRUPPE_A_3_4, GRUPPE_B, extra, einstellung);
    const { rows } = rankTournamentGroup(t, 'A');
    expect([row(rows, 'W').place, row(rows, 'O').place]).toEqual([3, 3]);
    expect(sharedPlaceAllowed(t, 'A', { place: 3, size: 2 })).toBe(wahl);
    expect(validateShared(t, ['W', 'O'], 'A')).toBe(wahl ? null : 'SHARED_PLACE_NOT_ALLOWED');
  });
});

/** Fehlercode der Prüfung „Ergebnis so akzeptieren“ (wie beim Abschluss ohne Netz) oder `null`. */
function validateShared(t: Tournament, keys: Key[], gruppe = ''): string | null {
  const check = validateDraft(shared(keys, gruppe), t);
  return check.ok ? null : check.code;
}
