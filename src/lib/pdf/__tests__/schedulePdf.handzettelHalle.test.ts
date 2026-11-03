/**
 * T7a, Halle und Adresse in den Eckdaten (@DR-031) und Spielzeit je Runde (@DR-020 Zeile 2) am fertigen PDF mit Inter: Adresse in
 * eigener Zeile, ohne Adresse keine Leerzeile, lange Namen brechen um und werden nie gekürzt, der Block darf dafür höher werden.
 */
import { describe, expect, it } from 'vitest';
import { printSheetHead } from '../../../design-tokens/print-sheet';
import { printType } from '../../../design-tokens/print';
import { FALL_A, FALL_B, FALL_B_HALLE, ADRESSE_LANG, HALLE_LANG } from './fixtures/handzettelFaelle';
import { handzettelPdf } from './handzettelPdf';
import type { LayoutPage, LayoutRect, LayoutText } from './pdfjsLayout';

const TOL = 0.1;
const strs = (page: LayoutPage): string[] => page.texts.map(t => t.str.trim()).filter(s => s !== '');
const block = (page: LayoutPage): LayoutRect => {
  const r = page.rects.filter(x => x.fill !== undefined && x.fill !== '#000000' && x.w > 100 && x.h > 15 && x.h < 80).sort((a, b) => a.y - b.y)[0];
  if (!r) { throw new Error('Eckdaten-Block fehlt'); }
  return r;
};
const wo = (page: LayoutPage): LayoutText => {
  const t = page.texts.find(x => ['Wo', 'Where'].includes(x.str.trim()));
  if (!t) { throw new Error('Spalte „Wo“ fehlt'); }
  return t;
};
/** Textstücke der Zelle „Wo“: rechts von ihrer Bezeichnung, oberhalb der zweiten Zeile des Blocks. */
const woZelle = (page: LayoutPage): LayoutText[] => {
  const kopf = wo(page);
  const zweite = page.texts.find(t => ['Spielzeit', 'Match time'].includes(t.str.trim()));
  const rechts = block(page).x + block(page).w;
  return page.texts.filter(t => t.x >= kopf.x - 0.5 && t.x < rechts && t.y >= kopf.y && t.y < (zweite?.y ?? 0) - 1 && t.str.trim() !== '');
};
const ohneLeer = (texts: LayoutText[]): string => texts.map(t => t.str).join('').replace(/\s/g, '');

describe.each(['de', 'en'] as const)('@DR-031 Adresse unter der Halle (%s)', locale => {
  it('@DR-031 „Bergader Arena“ und darunter „Mühlberger Weg 5, 83329 Waging am See“ in eigenen Zeilen unter der Halle', async () => {
    const { pages } = await handzettelPdf(FALL_A, { locale });
    const zelle = woZelle(pages[0]);
    const halle = zelle.find(t => t.str.trim() === 'Bergader Arena');
    const adresse = zelle.filter(t => t.y > (halle?.y ?? 0));

    expect(halle).toBeDefined();
    expect(ohneLeer(adresse)).toBe('MühlbergerWeg5,83329WagingamSee');
    adresse.forEach(t => {
      expect(t.x).toBeCloseTo(halle?.x ?? 0, 1);
      expect(t.size).toBeCloseTo(printSheetHead.factMidPt, 1);
    });
    expect(adresse[0].y - (halle?.y ?? 0)).toBeGreaterThan(3);
  });

  it('@DR-031 ohne Adresse steht nur die Halle, ohne leere Zeile; der Block wird nicht höher', async () => {
    const mit = await handzettelPdf(FALL_A, { locale });
    const ohne = await handzettelPdf(FALL_A, { locale, tournament: { location: { name: 'Bergader Arena' } } });

    expect(woZelle(ohne.pages[0]).map(t => t.str.trim())).toEqual([locale === 'de' ? 'Wo' : 'Where', 'Bergader Arena']);
    expect(block(ohne.pages[0]).h).toBeLessThanOrEqual(block(mit.pages[0]).h + TOL);
  });
});

describe('@DR-031 keine Leerzeile ohne Adresse (Zelle bestimmt die Blockhöhe)', () => {
  it('@DR-031 langer Hallenname: ohne Adresse ist der Block um die Adresszeilen niedriger als mit', async () => {
    const mit = await handzettelPdf(FALL_B_HALLE);
    const ohne = await handzettelPdf(FALL_B_HALLE, { tournament: { location: { name: HALLE_LANG } } });
    const adv = printSheetHead.factMidPt * printSheetHead.factLineHeight * 0.3528;

    expect(block(mit.pages[0]).h - block(ohne.pages[0]).h).toBeGreaterThanOrEqual(3 * adv - TOL);
    expect(block(mit.pages[0]).h - block(ohne.pages[0]).h).toBeLessThanOrEqual(3 * adv + TOL);
  });
});

describe.each(['de', 'en'] as const)('@DR-031 langer Hallenname und lange Adresse (%s)', locale => {
  const erwartet = (): string => `${HALLE_LANG}${ADRESSE_LANG.street},${ADRESSE_LANG.postalCode} ${ADRESSE_LANG.city}`.replace(/\s/g, '');

  it('@DR-031 jedes Wort gedruckt, nie gekürzt, Umbruch nur an Leerzeichen oder Bindestrich', async () => {
    const { pages } = await handzettelPdf(FALL_B_HALLE, { locale });
    const zelle = woZelle(pages[0]).filter(t => t.str.trim() !== (locale === 'de' ? 'Wo' : 'Where'));
    const stuecke = new Set(`${HALLE_LANG} ${ADRESSE_LANG.street}, ${ADRESSE_LANG.postalCode} ${ADRESSE_LANG.city}`.split(/(?<=-)|\s+/).filter(s => s !== ''));

    expect(ohneLeer(zelle)).toBe(erwartet());
    expect(zelle.length, 'bricht auf mehrere Zeilen um').toBeGreaterThanOrEqual(5);
    zelle.forEach(t => {
      expect(t.str).not.toContain('…');
      t.str.trim().split(/(?<=-)|\s+/).filter(s => s !== '').forEach(s => expect(stuecke.has(s), `„${s}“ ist ein ganzes Wort oder Wortteil bis zum Bindestrich`).toBe(true));
    });
  });

  it('@DR-031 alles innerhalb der Spalte „Wo“ und des Blocks; der Block wird höher, „Ablauf“ bleibt nur, solange er den Block nicht höher macht; nichts überlappt QR oder Regelzeile', async () => {
    const normal = await handzettelPdf(FALL_B, { locale });
    const { pages } = await handzettelPdf(FALL_B_HALLE, { locale });
    const page = pages[0];
    const kasten = block(page);
    const qr = page.links.find(l => l.h > 30);
    const regel = page.texts.find(t => /^(Modus|Mode):/.test(t.str));

    expect(kasten.h).toBeGreaterThan(block(normal.pages[0]).h + 5);
    woZelle(page).forEach(t => {
      expect(t.x + t.w, `„${t.str}“ im Block`).toBeLessThanOrEqual(kasten.x + kasten.w - printSheetHead.factsPadH + TOL);
      expect(qr ? t.x + t.w : 0, `„${t.str}“ links vom QR`).toBeLessThanOrEqual((qr?.x ?? 999) + TOL);
    });
    expect(regel?.y ?? 0, 'Regelzeile unter dem Block').toBeGreaterThan(kasten.y + kasten.h);
    // „Ablauf“ steht in der zweiten Zeile des Blocks und macht ihn nicht höher: er bleibt
    expect(strs(page)).toContain(locale === 'de' ? 'Ablauf' : 'Matches');
    // der höhere Block drängt Spiele auf die Folgeseite (mindestens 3 dort, @DR-033), keines geht verloren
    const nummern = (p: LayoutPage): number => p.texts.filter(t => /^\d{1,2}$/.test(t.str.trim()) && t.x < 25 && Math.abs(t.size - printType.nr) < 0.05).length;
    expect(nummern(page) + nummern(pages[1])).toBe(20);
    expect(nummern(pages[1])).toBeGreaterThanOrEqual(3);
  });
});

describe.each(['de', 'en'] as const)('@DR-020 Spielzeit je Runde (%s): Gruppen 10, Finalrunde 12 Minuten', locale => {
  it('@DR-020 drei Zeilen in der Zelle, alle Wörter da, „Ablauf“ bleibt, 20 Spiele auf Seite 1', async () => {
    const { pages } = await handzettelPdf(FALL_B, { locale, tournament: { finalRoundGameDuration: 12 } });
    const page = pages[0];
    const kopf = page.texts.find(t => ['Spielzeit', 'Match time'].includes(t.str.trim()));
    const ablauf = page.texts.find(t => ['Ablauf', 'Matches'].includes(t.str.trim()));
    const zelle = page.texts.filter(t => t.x < 60 && t.y > (kopf?.y ?? 0) && t.y < (kopf?.y ?? 0) + 14 && t.str.trim() !== '');
    const text = ohneLeer(zelle);

    expect(zelle).toHaveLength(3);
    expect(text).toContain(locale === 'de' ? 'Gruppen10Minuten' : 'Groups10minutes');
    expect(text).toContain(locale === 'de' ? 'Finalrunde12Minuten' : 'Finalround12minutes');
    expect(text).toContain(locale === 'de' ? 'Zeitstrafe2Minuten' : 'Timepenalty2minutes');
    expect(ablauf, '„Ablauf“ bleibt').toBeDefined();
    expect(page.texts.filter(t => /^\d{1,2}$/.test(t.str.trim()) && t.x < 25 && Math.abs(t.size - printType.nr) < 0.05)).toHaveLength(20);
  });
});
