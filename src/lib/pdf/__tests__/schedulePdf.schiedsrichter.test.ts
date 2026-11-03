/**
 * B-28 C1 (@DR-025): Spalte „Schiedsrichter“ in Gruppen- und Finaltabellen (@OB-075: ausgeschrieben, nie „SR“). Nummer, Name des pfeifenden Teams oder ein leeres
 * Schreibfeld, gelesen aus dem fertigen PDF (pdfjs). Die drei Beispiele der Anforderung.
 */
import { describe, expect, it } from 'vitest';
import type { GeneratedSchedule } from '../../../core/generators';
import { printBox, printColumns, printGap } from '../../../design-tokens/print';
import type { RefereeConfig } from '../../../types/tournament';
import { pageGeometry } from '../layout';
import { finalsMatches, hallencupSchedule, hallencupTournament } from './pdfFixture';
import { kaestchenIn, lesen, textsIn, zeileVon, type Zeile } from './pdfScoreSupport';

const GEO = pageGeometry('a4', 'portrait');
/** Spalte „Schiedsrichter“ der Gruppen- oder der Finaltabelle: Beginn in mm und Breite des Schreibfelds. */
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

describe('@DR-025 Spalte „Schiedsrichter“', () => {
  it('Spaltenkopf „SR“ (@OB-075, vorgelesen „Schiedsrichter“) steht über der Spalte, in Gruppen- und in Finaltabellen', async () => {
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

});
