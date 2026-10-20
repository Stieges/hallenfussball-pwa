/**
 * Paket TB-B, Task TB-3' (Kern): eine geänderte Einstellung oder eine geänderte Herkunft wirkt sofort – eine Annahme
 * („Ergebnis so akzeptieren“) verfällt, sobald der Platz ausgespielt werden muss; ein eingetragenes Strafstoßschießen
 * bleibt bei gelockerter Einstellung (Kurzblick TB-A „Verfall“). Geprüft wird beim Anwenden in `rankGroup` (reine
 * Rechnung, nichts gelöscht). Records `2026-09-27_wizard-regelinhalte` (@W2A-068, @W2A-069), `2026-10-01_turniermodi`
 * (@TM-146, @TM-147: nur die Prüfung gegen den Serverstand; Klärungsliste GA4 A-13b/A-15c),
 * `2026-10-01_turnier-lebenszyklus` (@LZ-010: nur der offene Gleichstand; Abschluss-Sperre GA4 A-21a).
 */
import { describe, expect, it } from 'vitest';
import { rankTournamentGroup } from '../tournamentTable';
import { sharedPlaceAllowed } from '../decisions';
import { validateDraft } from '../validateDraft';
import { resolvePlayoffPairings } from '../../generators/playoffResolver';
import { createMockTournament } from '../../../test/factories';
import { groupRank, slots } from '../../../test/matchSlotFixtures';
import type { Match, Standing, Tournament } from '../../../types/tournament';
import { BFV_ORDER, id, parseMatches, POINTS_310, teamsOf, type Key } from './fixtures';
import { lage048, MemoryRepo, nikolaus, shared, shootout } from './decisionTestKit';

const row = (rows: Standing[], key: Key): Standing => {
  const found = rows.find((r) => r.team.id === id(key));
  if (found === undefined) { throw new Error(`Team ${key} fehlt`); }
  return found;
};

const PD = { place: 3, size: 2 };

/** Nikolaus mit Einstellung `places`, Annahme für Petting/Otting eingetragen (Kennung „e-annahme“). */
async function nikolausMitAnnahme(places: number[]): Promise<MemoryRepo> {
  const repo = new MemoryRepo(nikolaus(places));
  expect((await repo.service(['e-annahme']).decide(repo.tournament.id, shared(['P', 'D']))).ok).toBe(true);
  return repo;
}

describe("TB-3' Verfall: Einstellung geändert (@W2A-068)", () => {
  it('@W2A-068 Platz 1 bis 3, noch nichts entschieden, Platz 3 abgehakt: „Gleichstand – Entscheidung nötig“ (Wahl)', () => {
    const repo = new MemoryRepo(nikolaus([1, 2, 3]));
    expect(sharedPlaceAllowed(repo.tournament, '', PD)).toBe(false);
    repo.setPlaces([1, 2]);
    expect(sharedPlaceAllowed(repo.tournament, '', PD)).toBe(true);
    const { rows } = rankTournamentGroup(repo.tournament, '');
    expect([row(rows, 'P').decisionNeeded, row(rows, 'D').decisionNeeded]).toEqual([true, true]);
  });

  it('@W2A-068 Platz 1 und 2, noch nichts entschieden, Platz 3 angehakt: „Strafstoßschießen nötig“', () => {
    const repo = new MemoryRepo(nikolaus([1, 2]));
    expect(sharedPlaceAllowed(repo.tournament, '', PD)).toBe(true);
    repo.setPlaces([1, 2, 3]);
    expect(sharedPlaceAllowed(repo.tournament, '', PD)).toBe(false);
    const { rows } = rankTournamentGroup(repo.tournament, '');
    expect([row(rows, 'P').decisionNeeded, row(rows, 'D').decisionNeeded]).toEqual([true, true]);
  });

  it('@W2A-068 Platz 1 und 2 mit Annahme, Platz 3 angehakt: die Annahme ist aufgehoben, beide „Strafstoßschießen nötig“', async () => {
    const repo = await nikolausMitAnnahme([1, 2]);
    expect(rankTournamentGroup(repo.tournament, '').openTies).toEqual([]);
    repo.setPlaces([1, 2, 3]);
    const result = rankTournamentGroup(repo.tournament, '');
    expect(result.staleDecisionIds).toEqual(['e-annahme']);
    expect(result.openTies).toEqual([[id('P'), id('D')]]);
    expect([row(result.rows, 'P').decisionNeeded, row(result.rows, 'D').decisionNeeded]).toEqual([true, true]);
    expect([row(result.rows, 'P').place, row(result.rows, 'D').place, row(result.rows, 'F').place]).toEqual([3, 3, 5]);
    expect(row(result.rows, 'P').decision).toBeUndefined();
    expect(sharedPlaceAllowed(repo.tournament, '', PD)).toBe(false);
    // Danach nimmt die App das Strafstoßschießen an (der Block ist wieder offen) – und es WIRKT (Review TB-3' B1).
    expect((await repo.service(['e-otting']).decide(repo.tournament.id, shootout('D', 'P', 4, 3))).ok).toBe(true);
    const danach = rankTournamentGroup(repo.tournament, '');
    expect([row(danach.rows, 'D').place, row(danach.rows, 'P').place]).toEqual([3, 4]);
    expect(danach.openTies).toEqual([]);
    expect(danach.rows.some((r) => r.decisionNeeded)).toBe(false);
    expect(row(danach.rows, 'D').decision?.id).toBe('e-otting');
    expect(await repo.service().decide(repo.tournament.id, shootout('P', 'D', 5, 4))).toEqual({ ok: false, code: 'ALREADY_DECIDED' });
  });

  it('@W2A-068 Gegenbeispiel: wird Platz 3 danach wieder abgehakt, gilt weiter das neuere Strafstoßschießen, nicht die alte Annahme', async () => {
    // „Die neueste gültige Entscheidung gilt“ (Review TB-3' B1, gilt nach Vorschlag).
    const repo = await nikolausMitAnnahme([1, 2]);
    repo.setPlaces([1, 2, 3]);
    expect((await repo.service(['e-otting']).decide(repo.tournament.id, shootout('D', 'P', 4, 3))).ok).toBe(true);
    repo.setPlaces([1, 2]);
    const result = rankTournamentGroup(repo.tournament, '');
    expect([row(result.rows, 'D').place, row(result.rows, 'P').place]).toEqual([3, 4]);
    expect(row(result.rows, 'D').decision?.id).toBe('e-otting');
    expect(result.staleDecisionIds).toEqual(['e-annahme']);
  });

  it('@W2A-068 Annahme und Gruppe abgeschlossen, Platz 3 angehakt: die Annahme ist aufgehoben, der Gleichstand ist wieder offen', async () => {
    // Den Zustand „Gruppe abgeschlossen“ gibt es erst mit GA4 A-13; die Rechnung hängt nicht daran. Die Sperre des
    // Turnierabschlusses bei offenem Gleichstand gehört GA4 A-21a (Lücken-Tabelle TB-B).
    const repo = await nikolausMitAnnahme([1, 2]);
    repo.setPlaces([1, 2, 3]);
    const result = rankTournamentGroup(repo.tournament, '');
    expect(result.openTies).toEqual([[id('P'), id('D')]]);
    expect(result.staleDecisionIds).toEqual(['e-annahme']);
  });

  it('@W2A-068 Platz 1 und 2 mit Annahme, Platz 5 angehakt: die Annahme bleibt, beide ohne Markierung auf Platz 3', async () => {
    const repo = await nikolausMitAnnahme([1, 2]);
    repo.setPlaces([1, 2, 5]);
    const result = rankTournamentGroup(repo.tournament, '');
    expect(result.staleDecisionIds).toEqual([]);
    expect([row(result.rows, 'P').place, row(result.rows, 'D').place]).toEqual([3, 3]);
    expect(result.rows.some((r) => r.decisionNeeded)).toBe(false);
  });

  it('@W2A-068 Platz 1 bis 3 mit Strafstoßschießen 4:3 für Otting, Platz 3 abgehakt: die Entscheidung bleibt (Otting 3, Petting 4)', async () => {
    const repo = new MemoryRepo(nikolaus([1, 2, 3]));
    expect((await repo.service(['e-otting']).decide(repo.tournament.id, shootout('D', 'P', 4, 3))).ok).toBe(true);
    repo.setPlaces([1, 2]);
    const result = rankTournamentGroup(repo.tournament, '');
    expect(result.staleDecisionIds).toEqual([]);
    expect([row(result.rows, 'D').place, row(result.rows, 'P').place]).toEqual([3, 4]);
    expect(result.rows.some((r) => r.decisionNeeded)).toBe(false);
  });
});

/** @W2A-069: Gruppe A zu 5 (Nord 12, Süd 9, West 6, Ost und Hafen je 1 Punkt, 1:4 Tore, direkt 1:1), Gruppe B zu 4. */
const GRUPPE_A_FUENF = 'N–S 1:0; N–W 1:0; N–O 1:0; N–H 1:0; S–W 1:0; S–O 1:0; S–H 1:0; W–O 1:0; W–H 1:0; O–H 1:1';
const GRUPPE_B = 'M–B 2:0; M–U 2:0; M–T 2:0; B–U 2:1; B–T 1:0; U–T 1:0';

function hallencupFuenf(): Tournament {
  const finals: Match[] = [
    { id: 'hf-1', round: 9, field: 1, isFinal: true, phase: 'semifinal', label: 'Halbfinale 1', ...slots(groupRank('A', 1), groupRank('B', 2)) },
    { id: 'hf-2', round: 9, field: 2, isFinal: true, phase: 'semifinal', label: 'Halbfinale 2', ...slots(groupRank('B', 1), groupRank('A', 2)) },
    { id: 'p5', round: 10, field: 1, isFinal: true, phase: 'placement', label: 'Spiel um Platz 5', ...slots(groupRank('A', 3), groupRank('B', 3)) },
  ];
  return createMockTournament({
    teams: [...teamsOf('NSWOH', 'A'), ...teamsOf('MBUT', 'B')],
    matches: [...parseMatches(GRUPPE_A_FUENF, { group: 'A', idPrefix: 'a' }), ...parseMatches(GRUPPE_B, { group: 'B', idPrefix: 'b' }), ...finals],
    pointSystem: POINTS_310, placementLogic: BFV_ORDER, groupSystem: 'groupsAndFinals', version: 1, placementsToPlayOut: [1, 2],
  });
}

describe("TB-3' Verfall: Herkunft geändert (@W2A-069)", () => {
  it('@W2A-069 führt der geteilte Platz 4 nach geänderter Herkunft in das Spiel um Platz 5, verfällt die Annahme: „Strafstoßschießen nötig“', async () => {
    const repo = new MemoryRepo(hallencupFuenf());
    const vorher = rankTournamentGroup(repo.tournament, 'A');
    expect([row(vorher.rows, 'O').place, row(vorher.rows, 'H').place]).toEqual([4, 4]);
    expect((await repo.service(['e-annahme']).decide(repo.tournament.id, shared(['O', 'H'], 'A'))).ok).toBe(true);
    expect(rankTournamentGroup(repo.tournament, 'A').openTies).toEqual([]);

    repo.tournament = {
      ...repo.tournament,
      matches: repo.tournament.matches.map((m) => (m.id === 'p5' ? { ...m, ...slots(groupRank('A', 4), groupRank('B', 3)) } : m)),
    };
    const nachher = rankTournamentGroup(repo.tournament, 'A');
    expect(nachher.staleDecisionIds).toEqual(['e-annahme']);
    expect(nachher.openTies).toEqual([[id('O'), id('H')]]);
    expect([row(nachher.rows, 'O').decisionNeeded, row(nachher.rows, 'H').decisionNeeded]).toEqual([true, true]);
    expect(sharedPlaceAllowed(repo.tournament, 'A', { place: 4, size: 2 })).toBe(false);

    // Das danach eingetragene Strafstoßschießen wirkt: Tabelle geordnet, zweiter Eintrag abgelehnt, Finalrunde besetzbar (B1).
    expect((await repo.service(['e-ost']).decide(repo.tournament.id, shootout('O', 'H', 4, 3, 'A'))).ok).toBe(true);
    const entschieden = rankTournamentGroup(repo.tournament, 'A');
    expect([row(entschieden.rows, 'O').place, row(entschieden.rows, 'H').place]).toEqual([4, 5]);
    expect(entschieden.openTies).toEqual([]);
    expect(await repo.service().decide(repo.tournament.id, shootout('H', 'O', 5, 4, 'A'))).toEqual({ ok: false, code: 'ALREADY_DECIDED' });
    const turnier = repo.tournament;
    expect(resolvePlayoffPairings(turnier).wasResolved).toBe(true);
    const seite = (matchId: string, s: 'slotA' | 'slotB'): string | undefined => {
      const slot = turnier.matches.find((m) => m.id === matchId)?.[s];
      return slot?.kind === 'team' ? slot.teamId : undefined;
    };
    expect([seite('hf-1', 'slotA'), seite('hf-2', 'slotB'), seite('p5', 'slotA')]).toEqual([id('N'), id('S'), id('O')]);
  });
});

describe("TB-3' Prüfung gegen den Serverstand beim Abschluss ohne Netz (@TM-146, @TM-147)", () => {
  it.each([
    { server: 'hat sich inzwischen nichts geändert', aendern: () => undefined, code: null },
    { server: 'hat Maria Platz 3 als auszuspielenden Platz angehakt', aendern: (r: MemoryRepo) => { r.setPlaces([1, 2, 3]); }, code: 'SHARED_PLACE_NOT_ALLOWED' },
    { server: 'hat Maria Platz 5 als auszuspielenden Platz angehakt', aendern: (r: MemoryRepo) => { r.setPlaces([1, 2, 5]); }, code: null },
  ])('@TM-147:teil Ollis Annahme gegen den Serverstand: $server', ({ aendern, code }) => {
    const repo = new MemoryRepo(nikolaus([1, 2]));
    aendern(repo);
    const check = validateDraft(shared(['P', 'D']), repo.tournament);
    expect(check.ok ? null : check.code).toBe(code);
  });

  it('@TM-147:teil hat Maria inzwischen 4:3 für Otting eingetragen, ist Ollis Annahme ein Konflikt (ALREADY_DECIDED)', async () => {
    const repo = new MemoryRepo(nikolaus([1, 2]));
    expect((await repo.service().decide(repo.tournament.id, shootout('D', 'P', 4, 3))).ok).toBe(true);
    expect(validateDraft(shared(['P', 'D']), repo.tournament)).toEqual({ ok: false, code: 'ALREADY_DECIDED' });
  });

  it('@TM-146:teil hat Maria inzwischen 5:4 für SV Süd eingetragen, ist Ollis 4:3 für TSV West ein Konflikt (ALREADY_DECIDED)', async () => {
    const repo = new MemoryRepo(lage048());
    expect((await repo.service().decide(repo.tournament.id, shootout('S', 'W', 5, 4, 'A'))).ok).toBe(true);
    expect(validateDraft(shootout('W', 'S', 4, 3, 'A'), repo.tournament)).toEqual({ ok: false, code: 'ALREADY_DECIDED' });
  });
});

describe("TB-3' Abschluss-Bedingung: verfallene Annahme ist ein offener Gleichstand (@LZ-010)", () => {
  it('@LZ-010:teil Nikolaus, Annahme für Petting/Otting, Korrektur Petting – Otting 1:1 → 2:2: der Gleichstand ist wieder offen', async () => {
    const repo = await nikolausMitAnnahme([1, 2]);
    repo.correct('P', 'D', 2, 2);
    const result = rankTournamentGroup(repo.tournament, '');
    expect(result.staleDecisionIds).toEqual(['e-annahme']);
    expect(result.openTies).toEqual([[id('P'), id('D')]]);
  });
});
