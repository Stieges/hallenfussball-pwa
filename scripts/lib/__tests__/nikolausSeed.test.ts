// Die Testdaten-Vorlage „Nikolaus-Turnier TEST“ (Hauptlinie des Durchstichs) muss das echte Turnier abbilden. Geprüft wird
// gegen die Szenarien (@W4-027, @W4-029, @W4-030, @W4-031, @W4-033), nicht gegen den Code des Generators: der Plan stammt
// aus demselben Generator wie im Assistenten (`TournamentCreationService` + `generateFullSchedule`), ohne Datenbank.
import { describe, expect, it } from 'vitest';
import { TournamentCreationService } from '../../../src/core/services/TournamentCreationService';
import type { ITournamentRepository } from '../../../src/core/repositories/ITournamentRepository';
import { matchSideTeamId } from '../../../src/core/models/matchSlot';
import {
  E2E_NIKOLAUS_HOST_TEAM_NAMES,
  E2E_NIKOLAUS_MATCH_COUNT,
  E2E_NIKOLAUS_TEAM_NAMES,
  nikolausTeamId,
  E2E_NIKOLAUS_CUPS,
} from '../../../tests/e2e/cloud/testData';
import { buildNikolausTournament } from '../nikolausSeed';

const tournament = buildNikolausTournament(new TournamentCreationService({} as unknown as ITournamentRepository));
const spiele = [...tournament.matches].sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0));
const nameOf = (id: string | undefined): string => tournament.teams.find((team) => team.id === id)?.name ?? '?';
const heim = (index: number): string => nameOf(matchSideTeamId(spiele[index], 'A'));
const gast = (index: number): string => nameOf(matchSideTeamId(spiele[index], 'B'));
const hostIds = E2E_NIKOLAUS_HOST_TEAM_NAMES.map(nikolausTeamId);

describe('Nikolaus-Turnier TEST (Testdaten-Vorlage)', () => {
  it('Kopf: Sa 28.11.2026, 16:30, Bergader Arena, Veranstalter TSV Waging, eine Gruppe, ein Feld, 9 + 1 Minuten', () => {
    expect(tournament.title).toBe('Nikolaus-Turnier TEST');
    expect(tournament.date).toBe('2026-11-28');
    expect(tournament.startTime).toBe('16:30');
    expect(tournament.location.name).toBe('Bergader Arena');
    expect(tournament.organizer).toBe('TSV Waging');
    expect(tournament.groupSystem).toBe('roundRobin');
    expect(tournament.numberOfFields).toBe(1);
    expect(tournament.groupPhaseGameDuration).toBe(9);
    expect(tournament.groupPhaseBreakDuration).toBe(1);
  });

  it('sechs Mannschaften, beide Waging-Mannschaften markiert, Eröffnung auf der Voreinstellung', () => {
    expect(tournament.teams.map((team) => team.name)).toEqual([...E2E_NIKOLAUS_TEAM_NAMES]);
    expect(tournament.hostTeamIds).toEqual(hostIds);
    expect(tournament.openingMode).toBe('guest-opening');
  });

  it('15 Spiele von 16:30 bis 19:00 im 10-Minuten-Raster, jedes Paar genau einmal', () => {
    expect(spiele).toHaveLength(E2E_NIKOLAUS_MATCH_COUNT);
    const beginn = (index: number): string => {
      const zeit = new Date(spiele[index].scheduledTime as string | Date);
      return `${String(zeit.getHours()).padStart(2, '0')}:${String(zeit.getMinutes()).padStart(2, '0')}`;
    };
    expect(beginn(0)).toBe('16:30');
    expect(beginn(14)).toBe('18:50');
    const paare = spiele.map((_, i) => [heim(i), gast(i)].sort().join(' | '));
    expect(new Set(paare).size).toBe(15);
  });

  it('@W4-027 Spiel 1: eine Waging-Mannschaft ist Heimmannschaft gegen einen Gast', () => {
    expect(E2E_NIKOLAUS_HOST_TEAM_NAMES).toContain(heim(0));
    expect(E2E_NIKOLAUS_HOST_TEAM_NAMES).not.toContain(gast(0));
  });

  it('@SL-049 C-SPIELNUMMER-FEHLT: jedes Spiel trägt seine Spielnummer 1 bis 15 in Spielplan-Reihenfolge (nie leer)', () => {
    expect(spiele.map((spiel) => spiel.matchNumber)).toEqual(Array.from({ length: E2E_NIKOLAUS_MATCH_COUNT }, (_, i) => i + 1));
  });

  it('@W4-033 Vereinsduell in Runde 2 (Spiel 4 bis 6)', () => {
    const duell = spiele
      .map((_, i) => i)
      .filter((i) => hostIds.includes(matchSideTeamId(spiele[i], 'A') ?? '') && hostIds.includes(matchSideTeamId(spiele[i], 'B') ?? ''));
    expect(duell).toHaveLength(1);
    expect(duell[0]).toBeGreaterThanOrEqual(3);
    expect(duell[0]).toBeLessThanOrEqual(5);
  });

  it('@W4-029 nach Spiel 3, 6, 9, 12 und 15 haben alle Teams gleich viele Spiele', () => {
    for (const bis of [3, 6, 9, 12, 15]) {
      const zaehler = new Map<string, number>(tournament.teams.map((team) => [team.id, 0]));
      for (const spiel of spiele.slice(0, bis)) {
        for (const seite of ['A', 'B'] as const) {
          const id = matchSideTeamId(spiel, seite) ?? '';
          zaehler.set(id, (zaehler.get(id) ?? 0) + 1);
        }
      }
      expect(new Set(zaehler.values()).size, `nach Spiel ${bis}`).toBe(1);
    }
  });

  it('@W4-030 jedes Team hat 2 oder 3 Heimspiele und ist nie dreimal hintereinander Heim oder Gast', () => {
    for (const team of tournament.teams) {
      const seiten = spiele
        .map((spiel) => (matchSideTeamId(spiel, 'A') === team.id ? 'H' : matchSideTeamId(spiel, 'B') === team.id ? 'G' : ''))
        .filter(Boolean)
        .join('');
      const heimspiele = [...seiten].filter((s) => s === 'H').length;
      expect([2, 3], `${team.name}: ${seiten}`).toContain(heimspiele);
      expect(seiten, team.name).not.toMatch(/HHH|GGG/);
    }
  });

  it('@W4-031 zwischen zwei Spielen desselben Teams liegt mindestens ein Spiel (DFB-Abstand für 6 Teams)', () => {
    for (const team of tournament.teams) {
      const nummern = spiele.flatMap((spiel, i) => (matchSideTeamId(spiel, 'A') === team.id || matchSideTeamId(spiel, 'B') === team.id ? [i] : []));
      for (let i = 1; i < nummern.length; i++) {
        expect(nummern[i] - nummern[i - 1], team.name).toBeGreaterThanOrEqual(2);
      }
    }
  });
});

describe('Nikolaus-Turnier TEST (Zeitplan), Zwilling für N5', () => {
  const zwilling = buildNikolausTournament(new TournamentCreationService({} as unknown as ITournamentRepository), 'zeitplan');
  const paarungen = (turnier: typeof tournament): string[] =>
    [...turnier.matches]
      .sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0))
      .map((spiel) => `${turnier.teams.find((t) => t.id === matchSideTeamId(spiel, 'A'))?.name} - ${turnier.teams.find((t) => t.id === matchSideTeamId(spiel, 'B'))?.name}`);

  it('hat eigene Kennungen, aber denselben Plan wie das Hauptturnier', () => {
    expect(zwilling.id).not.toBe(tournament.id);
    expect(zwilling.teams.map((team) => team.id).filter((id) => tournament.teams.some((t) => t.id === id))).toEqual([]);
    expect(zwilling.matches.map((m) => m.id).filter((id) => tournament.matches.some((m) => m.id === id))).toEqual([]);
    expect(paarungen(zwilling)).toEqual(paarungen(tournament));
  });

  it('hat Helfer und Monitor des Zwillings, der Share-Code unterscheidet sich', () => {
    expect(E2E_NIKOLAUS_CUPS.zeitplan.mitHelfer).toBe(true);
    expect(E2E_NIKOLAUS_CUPS.zeitplan.shareCode).not.toBe(E2E_NIKOLAUS_CUPS.haupt.shareCode);
    expect(zwilling.monitors?.[0]?.id).toBe(E2E_NIKOLAUS_CUPS.zeitplan.monitorId);
    expect(zwilling.hostTeamIds).toEqual(E2E_NIKOLAUS_HOST_TEAM_NAMES.map(E2E_NIKOLAUS_CUPS.zeitplan.teamId));
  });
});
