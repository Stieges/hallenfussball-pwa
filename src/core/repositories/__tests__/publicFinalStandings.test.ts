/**
 * R3-6 Antwort von `public_final_standings` (@LZ-074, @LZ-075, @ZM-011, @ZM-012): vor dem Abschluss `none`, danach der gespeicherte
 * Endstand; ohne Torschützen-Schalter fehlt `scorers`; Abweichungen vom Vertrag sind „nicht lesbar“ (`null`), nie halb gelesen.
 */
import { describe, expect, it } from 'vitest';
import { parsePublicFinalStandings } from '../publicFinalStandings';
import { testUuid } from '../../../test/matchSlotFixtures';

const ranking = [
  { place: 1, teamId: testUuid(1), teamName: 'FC Nord', origin: { kind: 'groupPlace', group: '', place: 1 }, tableValues: { games: 5, goalsFor: 9, goalsAgainst: 3, goalDiff: 6, points: 13 } },
  { place: 2, teamId: testUuid(2), teamName: 'SV Süd', origin: { kind: 'groupPlace', group: '', place: 2 } },
];
const scorers = [{ kind: 'player', rank: 1, teamId: testUuid(1), teamName: 'FC Nord', number: 9, goals: 5 }];
const snapshot = { format: 1, ranking, scorers, appVersion: '1.0', computedAt: '2026-11-28T13:10:00+01:00' };
const FINISHED_AT = '2026-11-28T12:10:00+00:00';

describe('parsePublicFinalStandings', () => {
  it('@LZ-075: vor dem Abschluss kein Endstand', () => {
    expect(parsePublicFinalStandings({ status: 'none' })).toEqual({ status: 'none' });
  });

  it('@LZ-074/@ZM-011: nach dem Abschluss der gespeicherte Endstand mit Torschützen', () => {
    const result = parsePublicFinalStandings({ status: 'final', finishedAt: FINISHED_AT, standings: snapshot });
    expect(result).toMatchObject({ status: 'final', finishedAt: FINISHED_AT, scorersPublic: true });
    expect(result?.status === 'final' && result.snapshot.scorers).toHaveLength(1);
  });

  it('@ZM-012: ohne Schalter fehlt die Liste in der Antwort – die Plätze bleiben, Torschützen nicht öffentlich', () => {
    const { scorers: _weg, ...ohne } = snapshot;
    const result = parsePublicFinalStandings({ status: 'final', finishedAt: FINISHED_AT, standings: ohne });
    expect(result).toMatchObject({ status: 'final', scorersPublic: false });
    expect(result?.status === 'final' && result.snapshot.ranking).toHaveLength(2);
    expect(result?.status === 'final' && result.snapshot.scorers).toEqual([]);
  });

  it.each([
    ['null', null],
    ['unbekannter Status', { status: 'x' }],
    ['ohne Abschlusszeit', { status: 'final', standings: snapshot }],
    ['ohne Endstand', { status: 'final', finishedAt: FINISHED_AT }],
    ['unbekanntes Feld im Endstand', { status: 'final', finishedAt: FINISHED_AT, standings: { ...snapshot, extra: 1 } }],
    ['leere Rangliste', { status: 'final', finishedAt: FINISHED_AT, standings: { ...snapshot, ranking: [] } }],
  ])('Gegenbeispiel %s: nicht lesbar', (_name, raw) => {
    expect(parsePublicFinalStandings(raw)).toBeNull();
  });
});
