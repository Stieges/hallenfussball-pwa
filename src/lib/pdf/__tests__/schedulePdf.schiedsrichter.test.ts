/**
 * B-28 C1 (@DR-025): Spalte „Schiedsrichter“ in Gruppen- und Finaltabellen (@OB-075: ausgeschrieben, nie „SR“). Nummer, Name des pfeifenden Teams oder ein leeres
 * Schreibfeld, gelesen aus dem fertigen PDF (pdfjs). Die drei Beispiele der Anforderung.
 */
import { describe, expect, it } from 'vitest';
import type { GeneratedSchedule } from '../../../core/generators';
import { printColumns } from '../../../design-tokens/print';
import { printFinals } from '../../../design-tokens/print-sheet';
import type { RefereeConfig } from '../../../types/tournament';
import { pageGeometry } from '../layout';
import { finalsMatches, hallencupSchedule, hallencupTournament } from './pdfFixture';
import { lesen, textsIn, zeileVon, type Zeile } from './pdfScoreSupport';

const GEO = pageGeometry('a4', 'portrait');
/** Die Spalte „SR“ der Gruppen- bzw. Finalrunden-Tabelle liegt rechts; sie ist höchstens so breit wie ihr Token. */
const spalteVon = (tabelle: 'match' | 'finals'): number => GEO.left + GEO.contentWidth - (tabelle === 'match' ? printColumns.match.referee : printFinals.cols.referee);

/** Plan mit Schiedsrichter `referee` (oder keinem) für Spiel `nummer`. */
function mitSchiedsrichter(schedule: GeneratedSchedule, zuteilung: Record<number, number | undefined>): GeneratedSchedule {
  const setze = <T extends { matchNumber: number }>(m: T): T =>
    m.matchNumber in zuteilung ? { ...m, referee: zuteilung[m.matchNumber] } : m;
  return {
    ...schedule,
    allMatches: schedule.allMatches.map(setze),
    phases: schedule.phases.map(p => ({ ...p, matches: p.matches.map(setze) })),
  };
}

async function seiten(config: RefereeConfig | undefined, zuteilung: Record<number, number | undefined>) {
  const tournament = hallencupTournament({ refereeConfig: config });
  return lesen(mitSchiedsrichter(hallencupSchedule(tournament), zuteilung), tournament);
}

const inSpalte = (zeile: Zeile, tabelle: 'match' | 'finals' = 'match') => textsIn(zeile).filter(t => t.x >= spalteVon(tabelle));

describe('@DR-025 Spalte „Schiedsrichter“: nur mit Einträgen, in Gruppen- und Finaltabelle', () => {
  it('Spaltenkopf „SR“ (@OB-075, vorgelesen „Schiedsrichter“) steht in beiden Tabellen über der Spalte, sobald ein Spiel einen Eintrag hat', async () => {
    const finale = finalsMatches(hallencupSchedule(hallencupTournament())).find(m => m.finalType === 'final');
    if (!finale) {throw new Error('Finale fehlt');}
    const pages = await seiten({ mode: 'organizer', numberOfReferees: 2 }, { 1: 1, [finale.matchNumber]: 2 });
    const koepfe = pages.flatMap(page => page.texts.filter(t => t.str.trim() === 'SR' && t.x >= spalteVon('finals')));

    expect(koepfe).toHaveLength(2);
  });

  it('Gegenbeispiel: ohne Eintrag bei einem einzigen Spiel gibt es keine Spalte „SR“ und kein leeres Feld', async () => {
    const pages = await seiten(undefined, {});

    expect(pages.flatMap(page => page.texts).some(t => t.str.trim() === 'SR')).toBe(false);
  });

  it('Finaltabelle: Finale mit Nummer 1 zeigt „1“ in der Spalte, ein Finale ohne Eintrag bleibt leer', async () => {
    const finale = finalsMatches(hallencupSchedule(hallencupTournament())).find(m => m.finalType === 'final');
    if (!finale) {throw new Error('Finale fehlt');}
    const belegt = zeileVon(await seiten({ mode: 'organizer', numberOfReferees: 2 }, { [finale.matchNumber]: 1 }), finale.matchNumber);
    const leer = zeileVon(await seiten({ mode: 'organizer', numberOfReferees: 2 }, { 1: 1, [finale.matchNumber]: undefined }), finale.matchNumber);

    expect(inSpalte(belegt, 'finals').map(t => t.str.trim())).toEqual(['1']);
    expect(inSpalte(leer, 'finals')).toEqual([]);
  });
});
