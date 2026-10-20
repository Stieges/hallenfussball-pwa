/**
 * toMatchSummary (Plan LT-3): Farben der Seiten für die Zeile „Nächstes“ – über das Spiel des Turniers und `wornColors`.
 * Szenarien: @SL-160 (Trikotfarben), @SL-161 (ohne Farbe `null`), @W3-028 (nach dem Anpfiff gilt die gespeicherte Farbe).
 */
import { describe, it, expect } from 'vitest';
import type { TFunction } from 'i18next';
import type { ScheduledMatch } from '../../../../core/generators';
import type { Tournament } from '../../../../types/tournament';
import { testTeamSlot } from '../../../../test/matchSlotFixtures';
import { buildSideContext } from '../../../../components/schedule/matchSides';
import { toMatchSummary } from '../toMatchSummary';

const t = ((k: string) => k) as unknown as TFunction<'tournament'>;
const WEST = { id: 'tsv-west', name: 'TSV West', colors: { primary: '#C62828' } };
const MITTE = { id: 'sg-mitte', name: 'SG Mitte' };

const sm = {
  id: 'm13', matchNumber: 13, time: '15:15', field: 1, slot: 13, phase: 'groupStage', label: undefined,
  homeTeam: 'x', awayTeam: 'y', originalTeamA: WEST.id, originalTeamB: MITTE.id,
  slotA: testTeamSlot(WEST.id), slotB: testTeamSlot(MITTE.id),
} as unknown as ScheduledMatch;

function zeige(matchExtra: Record<string, unknown> = {}, teams = [WEST, MITTE]) {
  const turnier = { teams, matches: [{ id: 'm13', slotA: testTeamSlot(WEST.id), slotB: testTeamSlot(MITTE.id), matchStatus: 'scheduled', ...matchExtra }] } as unknown as Tournament;
  const sides = buildSideContext({ teams, groups: [], matches: [sm] });
  return toMatchSummary(sm, { tournament: turnier, sides, t });
}

describe('toMatchSummary', () => {
  it('@SL-160 Spielnummer, Anstoß, Feld und Namen kommen aus dem Spielplan', () => {
    const s = zeige();
    expect(s).toMatchObject({ id: 'm13', number: 13, scheduledKickoff: '15:15', fieldId: 'field-1' });
    expect(s.homeTeam.name).toBe('TSV West');
    expect(s.awayTeam.name).toBe('SG Mitte');
  });
  it('@SL-161 vor dem Anpfiff gilt die Teamfarbe; ohne festgelegte Farbe `null` (SG Mitte), nur der Name', () => {
    expect(zeige().farben).toEqual({ home: '#C62828', away: null });
  });
  it('@W3-028 nach dem Anpfiff gilt die gespeicherte Farbe des Spiels, nicht die Teamfarbe', () => {
    expect(zeige({ matchStatus: 'running', kit: { a: '#1565C0', b: '#0D1B4C' } }).farben).toEqual({ home: '#1565C0', away: '#0D1B4C' });
  });
  it('Gegenbeispiel: ein Spiel, das im Turnier fehlt, hat keine Farben (kein Absturz)', () => {
    const turnier = { teams: [WEST, MITTE], matches: [] } as unknown as Tournament;
    const sides = buildSideContext({ teams: [WEST, MITTE], groups: [], matches: [sm] });
    expect(toMatchSummary(sm, { tournament: turnier, sides, t }).farben).toEqual({ home: null, away: null });
  });
});
