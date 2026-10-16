/**
 * B-28 C5 – Sichtbarkeit im fertigen PDF (pdfjs): @BM-032 (Zeile Veranstalter: keine Gruppentabelle, keine Platzierung,
 * Gruppen-Herkunft „noch offen“, Sieger-Herkunft bleibt), @BM-054 (beide Schalter), @DR-018 (Ergebnisse).
 */
import { describe, expect, it } from 'vitest';
import { printType } from '../../../design-tokens/print';
import { hallencupSchedule, hallencupTournament } from './pdfFixture';
import { kopfPdf } from './pdfKopfSupport';
import { hallencupMitStand, textsIn, SIZE_TOL, zeileVon } from './pdfScoreSupport';
import { squash } from './pdfjsText';
import type { LayoutPage } from './pdfjsLayout';

const alleTexte = (pages: LayoutPage[]): string[] => pages.flatMap(page => page.texts.map(t => t.str.trim()));
const mitTabellen = hallencupTournament();
const ohneTabellen = hallencupTournament({ hideRankingsForPublic: true });

describe('@BM-032 Veranstalter-PDF bei ausgeschaltetem Schalter „Gruppentabellen“', () => {
  it('keine Gruppentabelle, keine Platzierung, Gruppen-Herkunft „noch offen“, Sieger-Herkunft bleibt', async () => {
    const { pages } = await kopfPdf({}, ohneTabellen, hallencupSchedule(ohneTabellen));
    const texte = alleTexte(pages);
    const text = squash(texte.join(' '));

    expect(texte.some(t => /Tabelle\s*–\s*Gruppe/.test(t)), 'Gruppentabelle').toBe(false);
    expect(texte.some(t => /^\d+\s*Platzierung$/.test(t)), 'Platzierung').toBe(false);
    expect(text).not.toContain(squash('Erster Gruppe A'));
    expect(text).not.toContain(squash('Zweiter Gruppe B'));
    expect(text).toContain(squash('noch offen'));
    expect(text).toContain(squash('Sieger Halbfinale 1'));
  });

  it('Gegenbeispiel: Schalter an – Tabellen, Platzierung und Gruppen-Herkunft stehen im Dokument', async () => {
    const { pages } = await kopfPdf({}, mitTabellen, hallencupSchedule(mitTabellen));
    const texte = alleTexte(pages);
    const text = squash(texte.join(' '));

    expect(texte.some(t => /Tabelle\s*–\s*Gruppe/.test(t))).toBe(true);
    expect(texte.some(t => /^\d+\s*Platzierung$/.test(t))).toBe(true);
    expect(text).toContain(squash('Erster Gruppe A'));
    expect(text).not.toContain(squash('noch offen'));
  });

  it('Zuschauer-Fassung („Nur Spielplan“): auch bei eingeschalteten Schaltern keine Tabelle und keine Platzierung', async () => {
    const { pages } = await kopfPdf({ audience: 'viewer' }, mitTabellen, hallencupSchedule(mitTabellen));
    const texte = alleTexte(pages);

    expect(texte.some(t => /Tabelle\s*–\s*Gruppe/.test(t))).toBe(false);
    expect(texte.some(t => /^\d+\s*Platzierung$/.test(t))).toBe(false);
  });
});

describe('@DR-018 @BM-054 Ergebnisse nach dem Schalter „Ergebnisse“', () => {
  const ergebnis = { 11: { scoreA: 2, scoreB: 1, matchStatus: 'finished' as const } };
  const ziffern = async (overrides: Parameters<typeof hallencupMitStand>[1], options: Parameters<typeof hallencupMitStand>[2] = {}): Promise<string[]> => {
    const zeile = zeileVon(await hallencupMitStand(ergebnis, overrides, options), 11);
    return textsIn(zeile).filter(t => Math.abs(t.size - printType.result) <= SIZE_TOL).map(t => t.str.trim()).filter(str => /^\d+$/.test(str));
  };

  it('Gegenbeispiel: Ergebnisse sichtbar – Spiel 11 zeigt 2 und 1', async () => {
    expect(await ziffern({})).toEqual(expect.arrayContaining(['2', '1']));
  });

  it('Schalter „Ergebnisse“ aus: Spiel 11 zeigt keine Ziffer', async () => {
    expect(await ziffern({ hideScoresForPublic: true })).toEqual([]);
  });

  it('Zuschauer-Fassung: keine Ziffer, auch wenn der Schalter an ist', async () => {
    expect(await ziffern({}, { audience: 'viewer' })).toEqual([]);
  });
});
