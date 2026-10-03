/**
 * A-03 (MVP-Bauplan, Spur A) – Import: Spielseiten sind Team-IDs aus der Datei, abgebildet auf neue Team-IDs.
 * A-03: ein Name oder eine unbekannte ID ergibt keine Seite – der Import scheitert laut.
 */
import { describe, it, expect } from 'vitest';
import { validateAndParseTournamentImport, checkFairnessWarnings } from '../tournamentImporter';
import { matchSideTeamId } from '../../core/models/matchSlot';
import { vs, slots, groupRank, testUuid } from '../../test/matchSlotFixtures';
import type { Match, Team } from '../../types/tournament';

const fileOf = (matches: unknown[]): string =>
  JSON.stringify({
    title: 'Import',
    teams: [
      { id: 't1', name: 'Team Alpha', group: 'A' },
      { id: 't2', name: 'Team Beta', group: 'A' },
    ],
    matches,
  });

describe('Import: Spielseiten aus Team-IDs', () => {
  it('A-03 Spiele bekommen Slots mit den NEUEN Team-IDs, Übergangsfeld parallel', () => {
    const result = validateAndParseTournamentImport(
      fileOf([{ round: 1, field: 1, teamA: 't1', teamB: 't2', group: 'A' }]),
      'json',
    );

    expect(result.isValid).toBe(true);
    const tournament = result.tournament!;
    const [alpha, beta] = tournament.teams;
    const match = tournament.matches[0];
    expect(matchSideTeamId(match, 'A')).toBe(alpha.id);
    expect(matchSideTeamId(match, 'B')).toBe(beta.id);
    expect(match.teamA).toBe(alpha.id);
    expect(alpha.id).not.toBe('t1');
  });

  it('A-03 Gegenbeispiel: ein Teamname statt der ID scheitert mit UNKNOWN_TEAM, kein Spiel mit Namens-Seite', () => {
    const result = validateAndParseTournamentImport(
      fileOf([{ round: 1, field: 1, teamA: 'Team Alpha', teamB: 't2' }]),
      'json',
    );

    expect(result.isValid).toBe(false);
    expect(result.tournament).toBeUndefined();
    expect(result.errors).toEqual([
      expect.objectContaining({ code: 'UNKNOWN_TEAM', field: 'matches[0].teamA' }),
    ]);
  });

  it('A-03 Gegenbeispiel: unbekannte ID auf beiden Seiten nennt beide Seiten', () => {
    const result = validateAndParseTournamentImport(
      fileOf([{ round: 1, field: 1, teamA: 'x', teamB: 'y' }]),
      'json',
    );

    expect(result.isValid).toBe(false);
    expect(result.errors.map((e) => e.field)).toEqual(['matches[0].teamA', 'matches[0].teamB']);
  });

  it('Datei ohne Spiele bleibt gültig (nur Teams)', () => {
    const result = validateAndParseTournamentImport(fileOf([]), 'json');
    expect(result.isValid).toBe(true);
    expect(result.tournament?.matches).toEqual([]);
  });

  it('A-03 meldet aufeinanderfolgende Spiele eines Teams', () => {
    const result = validateAndParseTournamentImport(
      fileOf([
        { round: 1, field: 1, teamA: 't1', teamB: 't2' },
        { round: 2, field: 1, teamA: 't1', teamB: 't2' },
      ]),
      'json',
    );
    expect(result.warnings.some((w) => w.code === 'CONSECUTIVE_MATCHES')).toBe(true);
  });
});

describe('checkFairnessWarnings über Slots', () => {
  const [T1, T2, T3] = [1, 2, 3].map(testUuid);
  const teams: Team[] = [
    { id: T1, name: 'Eins' },
    { id: T2, name: 'Zwei' },
    { id: T3, name: 'Drei' },
  ];
  const m = (id: string, sides: Pick<Match, 'teamA' | 'teamB' | 'slotA' | 'slotB'>): Match => ({
    id, round: 1, field: 1, ...sides,
  });

  it('A-03 erkennt ein Team, das gegen sich selbst spielt', () => {
    const warnings = checkFairnessWarnings([m('a', vs(T1, T1))], teams);
    expect(warnings).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'SELF_MATCH' })]));
    expect(warnings.find((w) => w.code === 'SELF_MATCH')?.message).toContain('Eins');
  });

  it('A-03 Gegenbeispiel: zwei offene Seiten gelten nicht als Selbstspiel', () => {
    const open = slots(groupRank('A', 1), groupRank('A', 1));
    const warnings = checkFairnessWarnings([m('a', open)], teams);
    expect(warnings.some((w) => w.code === 'SELF_MATCH')).toBe(false);
  });

  it('A-03 meldet ungleiche Spielverteilung', () => {
    const many = [m('1', vs(T1, T2)), m('2', vs(T3, T2)), m('3', vs(T1, T2)), m('4', vs(T3, T2)), m('5', vs(T1, T2))];
    const warnings = checkFairnessWarnings(many, teams);
    expect(warnings.some((w) => w.code === 'UNEVEN_MATCH_DISTRIBUTION')).toBe(true);
  });
});
