/**
 * B-28 C4 – Termin-Zeile bricht nur an „·“, nie innerhalb eines Teils (G6, Review Fable). Gelesen aus dem PDF.
 */
import { describe, expect, it } from 'vitest';
import { wrapAtSeparators } from '../render/textFit';
import { hallencupTournament } from './pdfFixture';
import { kopfPdf } from './pdfKopfSupport';
import { translatorFor } from './pdfText';
import { squash } from './pdfjsText';

const PARTS_DE = ['Samstag, 14.11.2026', 'Beginn 13:00', 'Ende voraussichtlich', '2 Felder'];

describe('wrapAtSeparators (rein)', () => {
  const measure = (s: string): number => s.length;

  it('bricht nur an der Trennstelle, nie im Teil', () => {
    const lines = wrapAtSeparators(measure, 'Samstag, 14.11.2026 · Beginn 13:00 · Ende voraussichtlich 16:35 · 2 Felder', 58, ' · ');

    expect(lines).toEqual(['Samstag, 14.11.2026 · Beginn 13:00 ·', 'Ende voraussichtlich 16:35 · 2 Felder']);
  });

  it('Gegenbeispiel: passt alles, bleibt es eine Zeile; ein einzelner zu langer Teil bricht notfalls im Wort', () => {
    expect(wrapAtSeparators(measure, 'a · b · c', 40, ' · ')).toEqual(['a · b · c']);
    const hart = (part: string, width: number): string[] => part.match(new RegExp(`.{1,${width}}`, 'g')) ?? [part];
    expect(wrapAtSeparators(measure, 'ein sehr langer einzelner Teil ohne Trenner', 20, ' · ', hart).length).toBeGreaterThan(1);
  });
});

describe('Termin-Zeile im PDF', () => {
  it.each([['de' as const], ['en' as const]])('%s: jede Zeile beginnt an einem Teil, kein Teil ist zerrissen', async locale => {
    const { pages } = await kopfPdf({ locale, translate: translatorFor(locale) }, hallencupTournament({ location: { name: 'Sporthalle am Park' } }));
    const label = locale === 'de' ? 'Termin' : 'Date';
    const termin = pages[0].texts.find(t => t.str.trim() === label);
    expect(termin).toBeDefined();
    // Wertspalte der Angabentabelle: Textstücke rechts der Bezeichnungen, bis zur nächsten Bezeichnung darunter
    const naechste = Math.min(...pages[0].texts.filter(t => Math.abs(t.x - termin!.x) < 0.5 && t.y > termin!.y + 0.5).map(t => t.y));
    const wert = pages[0].texts
      .filter(t => t.x > termin!.x + 5 && t.y >= termin!.y - 0.5 && t.y < naechste - 0.5)
      .map(t => t.str.trim())
      .filter(z => z !== '');
    const text = wert.join(' | ');

    // jede Zeile endet auf „·“ oder ist die letzte; keine Zeile beginnt mitten in einem Teil
    wert.slice(0, -1).forEach(zeile => expect(zeile.endsWith('·'), `„${zeile}“ endet am Trenner`).toBe(true));
    if (locale === 'de') {
      PARTS_DE.forEach(part => expect(wert.some(z => squash(z).includes(squash(part))), `${part} in einer Zeile (${text})`).toBe(true));
      expect(wert.some(z => z.startsWith('Beginn') || z.startsWith('Ende') || z.startsWith('2 Felder') || z.startsWith('Samstag'))).toBe(true);
    }
  });
});
