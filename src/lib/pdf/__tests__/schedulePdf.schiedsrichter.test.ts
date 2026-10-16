/**
 * B-28 C1 (@DR-025): Spalte „SR“ in Gruppen- und Finaltabellen. Nummer, Name des pfeifenden Teams oder ein leeres
 * Schreibfeld, gelesen aus dem fertigen PDF (pdfjs). Die drei Beispiele der Anforderung.
 */
import { describe, expect, it } from 'vitest';
import type { GeneratedSchedule } from '../../../core/generators';
import { printBox, printColumns, printGap, printType } from '../../../design-tokens/print';
import type { RefereeConfig } from '../../../types/tournament';
import { pageGeometry } from '../layout';
import { finalsMatches, hallencupSchedule, hallencupTournament } from './pdfFixture';
import { kaestchenIn, lesen, SIZE_TOL, textsIn, zeileVon, type Zeile } from './pdfScoreSupport';

const GEO = pageGeometry('a4', 'portrait');
/** Spalte „SR“ der Gruppen- oder der Finaltabelle: Beginn in mm und Breite des Schreibfelds. */
const spalte = (tabelle: 'match' | 'finals') => ({
  von: GEO.left + GEO.contentWidth - printColumns[tabelle].referee,
  feld: printColumns[tabelle].referee - 2 * printGap.bodyPadH,
});

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

const inSpalte = (zeile: Zeile, tabelle: 'match' | 'finals' = 'match') => textsIn(zeile).filter(t => t.x >= spalte(tabelle).von);
const feld = (zeile: Zeile, tabelle: 'match' | 'finals' = 'match') => kaestchenIn(zeile, spalte(tabelle).feld, printBox.refereeFieldH);

describe('@DR-025 Spalte „SR“', () => {
  it('Schiedsrichter Nummer 2 eingetragen: „2“ in der Spalte, kein Schreibfeld', async () => {
    const zeile = zeileVon(await seiten({ mode: 'organizer', numberOfReferees: 2 }, { 7: 2 }), 7);

    expect(inSpalte(zeile).map(t => t.str.trim())).toEqual(['2']);
    expect(Math.abs((inSpalte(zeile)[0]?.size ?? 0) - printType.body)).toBeLessThanOrEqual(SIZE_TOL);
    expect(feld(zeile)).toEqual([]);
  });

  it('das Team SV Süd pfeift: „SV Süd“ in der Spalte', async () => {
    const zeile = zeileVon(await seiten({ mode: 'teams' }, { 7: 2 }), 7);

    expect(inSpalte(zeile).map(t => t.str.trim())).toEqual(['SV Süd']);
    expect(feld(zeile)).toEqual([]);
  });

  it('nichts eingetragen: ein leeres Feld zum Ausfüllen von Hand, ohne Text', async () => {
    const zeile = zeileVon(await seiten(undefined, {}), 7);

    expect(inSpalte(zeile)).toEqual([]);
    expect(feld(zeile)).toHaveLength(1);
  });

  it('Spaltenkopf „SR“ steht über der Spalte, in Gruppen- und in Finaltabellen', async () => {
    const pages = await seiten(undefined, {});
    const koepfe = pages.flatMap(page => page.texts.filter(t => t.str.trim() === 'SR' && t.x >= spalte('finals').von));

    expect(koepfe.length).toBeGreaterThanOrEqual(3);
  });

  it('Finaltabelle: Finale ohne Eintrag hat das leere Feld, Finale mit Nummer 1 zeigt „1“', async () => {
    const finale = finalsMatches(hallencupSchedule(hallencupTournament())).find(m => m.finalType === 'final');
    if (!finale) {throw new Error('Finale fehlt');}
    const leer = zeileVon(await seiten(undefined, {}), finale.matchNumber);
    const belegt = zeileVon(await seiten({ mode: 'organizer', numberOfReferees: 2 }, { [finale.matchNumber]: 1 }), finale.matchNumber);

    expect(feld(leer, 'finals')).toHaveLength(1);
    expect(inSpalte(belegt, 'finals').map(t => t.str.trim())).toEqual(['1']);
  });

  it('C1-F Modus „none“ mit alter Nummer am Spiel: keine Nummer, ein leeres Schreibfeld', async () => {
    const zeile = zeileVon(await seiten({ mode: 'none' }, { 7: 3 }), 7);

    expect(inSpalte(zeile)).toEqual([]);
    expect(feld(zeile)).toHaveLength(1);
  });
});
