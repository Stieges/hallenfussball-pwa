/**
 * B-28a3-4 Zusatz Punkt 2 (Controller): Bei „Jeder gegen jeden“ heißt der Spielabschnitt „Spiele“, nicht „Gruppenphase“
 * (DE und EN). Gelesen aus dem fertigen PDF. Szenarien: @DR-020, @BM-052.
 */
import { describe, expect, it } from 'vitest';
import { generateFullSchedule } from '../../../core/generators';
import { printType } from '../../../design-tokens/print';
import { HALLENCUP_TEAMS, hallencupTournament } from './pdfFixture';
import { layoutOf, ohneNummer } from './pdfFixtureLayout';

const SIZE_TOL = 0.05;

describe('Abschnittsname im Spielplan-PDF', () => {
  it('@DR-020 jeder gegen jeden (ohne Gruppen): Abschnitt „Spiele“, kein „Gruppenphase“', async () => {
    const teams = HALLENCUP_TEAMS.map(team => ({ ...team, group: undefined }));
    const tournament = hallencupTournament({ teams, groupSystem: 'roundRobin' });
    const { pages } = await layoutOf({ tournament }, generateFullSchedule(tournament, 'de'));
    const alle = pages.flatMap(page => page.texts.map(t => t.str.trim()));

    expect(alle).toContain('2 Spiele');
    expect(alle).not.toContain('Gruppenphase');
    expect(alle).not.toContain('2 Gruppenphase');
    const titel = pages[0].texts.find(t => ohneNummer(t.str) === 'Spiele');
    expect(Math.abs((titel?.size ?? 0) - printType.h2)).toBeLessThanOrEqual(SIZE_TOL);
  });

  it('@DR-020 Gegenbeispiel: Gruppen + Finale behält „Gruppenphase“', async () => {
    const tournament = hallencupTournament();
    const { pages } = await layoutOf({ tournament }, generateFullSchedule(tournament, 'de'));
    const alle = pages.flatMap(page => page.texts.map(t => t.str.trim()));

    expect(alle).toContain('2 Gruppenphase');
    expect(alle).not.toContain('2 Spiele');
  });
});
