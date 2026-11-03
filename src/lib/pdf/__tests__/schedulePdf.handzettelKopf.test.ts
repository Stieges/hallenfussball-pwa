/**
 * T7a, Kopf von Seite 1 am fertigen PDF (pdfjs): @DR-031 Eckdaten, @DR-006/@DR-020 Regelzeile, @DR-024 Titelband in vier Lagen,
 * @DR-039 Titel, Sprache und Lesereihenfolge, @DR-003 QR. Fälle der Mockup-Runde 2 (`fixtures/handzettelFaelle.ts`), feste Uhr.
 * Die Erwartungen stammen aus dem Gherkin des Records „Drucken“, die Zahlen aus den Tokens.
 */
import { describe, expect, it } from 'vitest';
import { printLimits, printPage, printType } from '../../../design-tokens/print';
import { printSheetHead } from '../../../design-tokens/print-sheet';
import { grayOf } from '../../color/accent';
import { printHeader } from '../../../design-tokens/print-header';
import { FALL_A, FALL_B, FALL_C } from './fixtures/handzettelFaelle';
import { fallSchedule } from './fixtures/handzettelTurnier';
import { handzettelPdf } from './handzettelPdf';
import { fixtureLogo } from './pdfLogoFixture';
import type { LayoutPage, LayoutText } from './pdfjsLayout';

const TOL = 0.1;
const flat = (page: LayoutPage): string => page.texts.map(t => t.str).join('').replace(/\s/g, '');
const strs = (page: LayoutPage): string[] => page.texts.map(t => t.str.trim()).filter(s => s !== '');
const LEFT = printPage.margin.left;
const RIGHT = printPage.a4.portrait.width - printPage.margin.right;

describe('@DR-031 Eckdaten im hellen Block', () => {
  it('@DR-031 Datum, „Beginn 10:00 · Ende ca. …“, Halle und Spielzeit stehen im Kopf, die Endzeit auf 5 Minuten gerundet', async () => {
    const { pages } = await handzettelPdf(FALL_B);
    const kopf = flat(pages[0]);
    const ende = fallSchedule(FALL_B).endTime;
    const minuten = ende.getHours() * 60 + ende.getMinutes();
    const erwartet = Math.round(minuten / 5) * 5;
    const hhmm = `${String(Math.floor(erwartet / 60)).padStart(2, '0')}:${String(erwartet % 60).padStart(2, '0')}`;

    expect(kopf).toContain('Sonntag,15.11.2026');
    expect(kopf).toContain(`Beginn10:00·Endeca.${hhmm}`);
    expect(kopf).toContain('TuSHalle');
    expect(kopf).toContain('10Minuten');
    // helle Fläche hinter den Eckdaten
    expect(pages[0].rects.some(r => r.fill !== undefined && r.fill !== '#000000' && r.w > 100 && r.h > 20 && r.h < 50)).toBe(true);
  });

  it('@DR-031 Uhrzeiten im Block in mindestens 14 pt', async () => {
    const { pages } = await handzettelPdf(FALL_B);
    const zeiten = pages[0].texts.filter(t => /Beginn \d\d:\d\d|Ende ca\. \d\d:\d\d/.test(t.str));

    expect(zeiten.length).toBeGreaterThanOrEqual(1);
    zeiten.forEach(t => expect(t.size, t.str).toBeGreaterThanOrEqual(printLimits.timePt - 0.05));
  });

  it('@DR-031 keine Liste Bezeichnung/Wert: Bezeichnungen und Werte stehen in zwei Spalten, nicht je Zeile untereinander', async () => {
    const { pages } = await handzettelPdf(FALL_B);
    const wann = pages[0].texts.find(t => t.str.trim() === 'WANN');
    const wo = pages[0].texts.find(t => t.str.trim() === 'WO');

    expect(wann && wo ? Math.abs(wann.y - wo.y) : 99).toBeLessThanOrEqual(TOL);
    expect(wann && wo ? wo.x - wann.x : 0).toBeGreaterThan(50);
  });

  it('@DR-031 ohne Halle: keine leere Bezeichnung „Wo“ und kein „·“ am Rand', async () => {
    const { pages } = await handzettelPdf(FALL_A, { tournament: { location: { name: '' } }, options: { hallName: '' } });

    expect(strs(pages[0])).not.toContain('WO');
    expect(strs(pages[0]).filter(s => s === '·' || (s.startsWith('·') && !/^·\s*Ende/.test(s)))).toEqual([]);
  });

  it('@DR-031 ohne Datum: kein „Kein Datum“, die Zeile „Beginn …“ bleibt, kein „·“ am Rand', async () => {
    const { pages } = await handzettelPdf(FALL_A, { tournament: { date: '' } });

    expect(flat(pages[0])).not.toContain('KeinDatum');
    expect(flat(pages[0])).toContain('Beginn16:30');
    expect(strs(pages[0]).filter(s => s === '·' || (s.startsWith('·') && !/^·\s*Ende/.test(s)))).toEqual([]);
  });
});

describe('@DR-031 „Ablauf“ in der Eckdaten-Zelle', () => {
  it('@DR-031 Fall a: unter „Ablauf“ steht „15 Spiele“', async () => {
    const { pages } = await handzettelPdf(FALL_A);

    expect(flat(pages[0])).toContain('ABLAUF15Spiele');
  });

  it('@DR-031 Fall b: unter „Ablauf“ steht „28 Spiele, davon 8 Finalspiele“ in einer Zeile', async () => {
    const { pages } = await handzettelPdf(FALL_B);
    const zeile = pages[0].texts.find(t => t.str.includes('28 Spiele, davon 8 Finalspiele'));

    expect(strs(pages[0])).toContain('ABLAUF');
    expect(zeile, 'Text in einem Stück, ohne Umbruch').toBeDefined();
  });

  it('@DR-031 Fall b englisch: „28 matches, 8 of them finals“', async () => {
    const { pages } = await handzettelPdf(FALL_B, { locale: 'en' });

    expect(pages[0].texts.some(t => t.str.includes('28 matches, 8 of them finals'))).toBe(true);
    expect(strs(pages[0]), 'Bezeichnung der Zelle ≠ Titelzusatz „Schedule“').toContain('MATCHES');
  });

  it('@DR-031 Gegenprobe: würde „Ablauf“ den Block höher machen (ohne Halle: dritte Angabe in einer neuen Zeile), fällt er weg', async () => {
    const { pages } = await handzettelPdf(FALL_A, { tournament: { location: { name: '' } }, options: { hallName: '' } });

    expect(strs(pages[0])).not.toContain('ABLAUF');
    expect(flat(pages[0])).not.toContain('15Spiele');
  });

  // Fall b mit zwei weiteren Finalspielen: zehn Finalspiele, „38 Spiele, davon 10 Finalspiele“ ist eine Ziffer länger als die Zelle
  const ZEHN_FINALSPIELE = {
    ...FALL_B,
    finale: [
      ...(FALL_B.finale ?? []),
      { nr: 29, zeit: '15:44', runde: 'quarterfinal' as const, heim: { rang: 1, gruppe: 'A' as const }, gast: { rang: 1, gruppe: 'B' as const } },
      { nr: 30, zeit: '15:56', runde: 'quarterfinal' as const, heim: { rang: 2, gruppe: 'A' as const }, gast: { rang: 2, gruppe: 'B' as const } },
    ],
  };
  const spielzeilen = (page: LayoutPage): number => page.texts.filter(t => /^\d{1,2}$/.test(t.str.trim()) && t.x < 25 && Math.abs(t.size - printType.nr) < 0.05).length;

  it('@DR-031 ab zweistelliger Finalspielzahl passt „Ablauf“ nicht in eine Zeile und entfällt, ganz und ohne Bruchstück', async () => {
    const { pages } = await handzettelPdf(ZEHN_FINALSPIELE);

    expect(strs(pages[0])).not.toContain('ABLAUF');
    expect(flat(pages[0])).not.toContain('Finalspiele');
  });

  it('@DR-031 „Ablauf“ verdrängt kein Spiel von Seite 1: mit und ohne Angabe stehen gleich viele Gruppenspiele dort', async () => {
    const mit = await handzettelPdf(FALL_B);
    const ohne = await handzettelPdf(ZEHN_FINALSPIELE);

    expect(strs(mit.pages[0])).toContain('ABLAUF');
    expect(strs(ohne.pages[0])).not.toContain('ABLAUF');
    expect(spielzeilen(mit.pages[0])).toBe(spielzeilen(ohne.pages[0]));
    expect(spielzeilen(mit.pages[0])).toBe(20);
  });
});

describe('@DR-005 „Spielplan“ am Anfang der Zeile unter dem Titel', () => {
  const untertitel = (page: LayoutPage): string | undefined => page.texts.find(t => t.str.startsWith('Spielplan') || t.str.startsWith('Schedule'))?.str;

  it.each(['plan', 'blank'] as const)('@DR-005 Fassung %s: „Spielplan · U13 · TuS Traunreut“, ohne Zusatz', async edition => {
    const { pages } = await handzettelPdf(FALL_B, { options: { edition } });

    expect(untertitel(pages[0])).toBe('Spielplan · U13 · TuS Traunreut');
  });

  it('@DR-005 englische App: „Schedule · …“', async () => {
    const { pages } = await handzettelPdf(FALL_B, { locale: 'en' });

    expect(untertitel(pages[0])).toBe('Schedule · U13 · TuS Traunreut');
  });

  it('@DR-005 ohne Altersklasse und Veranstalter steht nur „Spielplan“, kein „·“ am Rand', async () => {
    const { pages } = await handzettelPdf(FALL_B, { tournament: { ageClass: '', organizer: '' }, options: { organizerName: '' } });

    expect(untertitel(pages[0])).toBe('Spielplan');
  });
});

describe('@DR-006 @DR-020 Regelzeile unter den Eckdaten', () => {
  it('@DR-006 Spielzeit mit Zeitstrafe steht bei den Eckdaten, „Modus“ und „Wertung“ in einer Regelzeile darunter', async () => {
    const { pages } = await handzettelPdf({ ...FALL_B, zeitstrafeSek: 120 }, { tournament: { rulebook: 'BFV-Richtlinien' } });
    const kopf = flat(pages[0]);
    const spielzeit = pages[0].texts.find(t => t.str.trim() === 'SPIELZEIT');
    const modus = pages[0].texts.find(t => t.str.trim().startsWith('Modus'));

    expect(kopf).toContain('Zeitstrafe2Minuten');
    expect(spielzeit && modus ? spielzeit.y : 99).toBeLessThan(modus?.y ?? 0);
    expect(kopf).toContain('Wertung:Punkte');
    expect(kopf).toContain('Regelwerk:BFV-Richtlinien');
    expect(strs(pages[0]).some(s => s.startsWith('Spielzeit:'))).toBe(false);
  });

  it('@DR-020 Gleichstand auf Platz 1 steht in der Regelzeile (Jeder gegen jeden, Strafstoßschießen)', async () => {
    const { pages } = await handzettelPdf(FALL_A);

    expect(flat(pages[0])).toContain('GleichstandaufPlatz1:Strafstoßschießen');
  });
});

describe('@DR-024 Titel und Zeile darunter mittig im freien Platz', () => {
  const LANG = 'Internationaler Hallenfußball-Wintercup der Sportgemeinschaft Nordheim 2026';
  const wannY = (page: LayoutPage): number => page.texts.find(t => t.str.trim() === 'WANN' || t.str.trim() === 'WHEN')?.y ?? 0;
  /** Titel- und Untertitelzeilen oberhalb der Eckdaten. */
  const kopfZeilen = (page: LayoutPage): LayoutText[] => page.texts.filter(t => t.y < wannY(page) - 1 && t.str.trim() !== '');
  const freierPlatz = (page: LayoutPage): { von: number; bis: number } => {
    const bilder = [...page.images].sort((a, b) => a.x - b.x);
    const links = bilder.find(i => i.x < 100);
    const rechts = bilder.find(i => i.x >= 100);
    return { von: links ? links.x + links.w + printHeader.logoGap : LEFT, bis: rechts ? rechts.x - printHeader.logoGap : RIGHT };
  };
  const lagen: Array<[string, boolean, boolean]> = [['beide Grafiken', true, true], ['nur links', true, false], ['nur rechts', false, true], ['keine Grafik', false, false]];

  it.each(lagen)('@DR-024 %s: jede Zeile liegt mittig im freien Platz (±0,3 mm), nichts überlappt die Grafiken, kein Platzhalter', async (_n, links, rechts) => {
    const logos = { ...(links ? { logoLeft: fixtureLogo(1) } : {}), ...(rechts ? { logoRight: fixtureLogo(1) } : {}) };
    const { pages } = await handzettelPdf(FALL_A, { tournament: { title: LANG }, options: logos });
    const page = pages[0];
    const platz = freierPlatz(page);
    const zeilen = kopfZeilen(page);

    expect(page.images).toHaveLength((links ? 1 : 0) + (rechts ? 1 : 0));
    expect(zeilen.length).toBeGreaterThanOrEqual(3);
    zeilen.forEach(t => {
      expect(t.x + t.w / 2, `„${t.str}“ mittig`).toBeCloseTo((platz.von + platz.bis) / 2, 0);
      expect(Math.abs(t.x + t.w / 2 - (platz.von + platz.bis) / 2), `„${t.str}“`).toBeLessThanOrEqual(0.3);
      expect(t.x).toBeGreaterThanOrEqual(platz.von - 0.3);
      expect(t.x + t.w).toBeLessThanOrEqual(platz.bis + 0.3);
    });
    expect(strs(page).some(s => /logo/i.test(s))).toBe(false);
    if (!links && !rechts) {
      // „keine leere Fläche“: oberhalb der Kopflinie nur Text, keine Füllung, kein Rahmen
      const kopfLinie = Math.min(...page.lines.filter(l => Math.abs(l.y1 - l.y2) < 0.01 && Math.abs(l.x2 - l.x1) > 150 && l.width > 0.4).map(l => l.y1));
      expect(page.rects.filter(r => r.y + r.h < kopfLinie && r.w > 1 && r.h > 1)).toEqual([]);
    }
  });

  it.each([['de', FALL_A], ['de', FALL_B], ['de', FALL_C], ['en', FALL_A], ['en', FALL_B], ['en', FALL_C]] as const)('@DR-024 Fall %s/%s ohne Grafik: Titel und Zeile mittig über der vollen Satzbreite; Eckdaten, Regelzeile und Tabelle linksbündig', async (locale, fall) => {
    const { pages } = await handzettelPdf(fall, { locale });
    const page = pages[0];

    kopfZeilen(page).forEach(t => expect(Math.abs(t.x + t.w / 2 - (LEFT + RIGHT) / 2), `„${t.str}“`).toBeLessThanOrEqual(0.3));
    expect(page.texts.find(t => ['WANN', 'WHEN'].includes(t.str.trim()))?.x).toBeCloseTo(LEFT + printSheetHead.factsPadH, 0);
    expect(page.texts.find(t => /^(Modus|Mode):/.test(t.str))?.x).toBeCloseTo(LEFT, 0);
    expect(page.texts.find(t => ['Nr.', 'No.'].includes(t.str.trim()))?.x ?? 0).toBeLessThan(LEFT + 6);
  });
});

describe('@DR-039 Titel, Sprache und Lesereihenfolge der Datei', () => {
  it('@DR-039 Titel „Hallencup Nord – Spielplan“, Sprache de', async () => {
    const { meta } = await handzettelPdf(FALL_A, { tournament: { title: 'Hallencup Nord' } });

    expect(meta).toEqual({ title: 'Hallencup Nord – Spielplan', lang: 'de' });
  });

  it('@DR-039 Titel mit „–“ (U+2013), Umlaut und Kyrillisch kommt per getMetadata unverändert zurück', async () => {
    const name = 'Кубок Süd – Щука (U13)';
    const { meta } = await handzettelPdf(FALL_A, { tournament: { title: name } });

    expect(meta.title).toBe(`${name} – Spielplan`);
  });

  it('@DR-039 englische App: Titel „… – Schedule“, Sprache en', async () => {
    const { meta } = await handzettelPdf(FALL_A, { locale: 'en', tournament: { title: 'Hallencup Nord' } });

    expect(meta).toEqual({ title: 'Hallencup Nord – Schedule', lang: 'en' });
  });

  it('@DR-039 Lesereihenfolge je Spiel: Nummer, Uhrzeit, Heim, Gast, Schiedsrichter; die Fußzeile zuletzt', async () => {
    const { pages } = await handzettelPdf(FALL_C);
    const texte = pages[0].texts;
    let cursor = 0;
    const next = (ok: (t: LayoutText) => boolean): number => {
      const i = texte.findIndex((t, k) => k >= cursor && ok(t));
      expect(i, 'Textstück in Reihenfolge gefunden').toBeGreaterThanOrEqual(0);
      cursor = i + 1;
      return i;
    };
    for (const spiel of FALL_C.spiele.slice(0, 6)) {
      const reihe = [
        next(t => t.str.trim() === String(spiel.nr) && t.size === printType.nr),
        next(t => t.str.trim() === spiel.zeit),
        next(t => spiel.heim.startsWith(t.str.trim()) && t.str.trim().length > 2),
        next(t => spiel.gast.startsWith(t.str.trim()) && t.str.trim().length > 2),
        next(t => t.str.trim() === String(spiel.sr)),
      ];
      expect(reihe).toEqual([...reihe].sort((a, b) => a - b));
    }
    pages.forEach((page, i) => expect(page.texts.at(-1)?.str, `Seite ${i + 1}`).toMatch(/Seite \d+ von \d+/));
  });
});

describe('@DR-003 QR-Code im Kopf', () => {
  it('@DR-003 Punktmuster auf Seite 1 mindestens 30 mm, auf Folgeseiten mindestens 20 mm, weißer Rand von vier Punkten', async () => {
    const { pages } = await handzettelPdf(FALL_B);
    const module = (page: LayoutPage): { w: number } => {
      const dunkel = page.rects.filter(r => r.fill === '#000000' && r.w < 3 && r.h < 3 && r.y < 90);
      const x0 = Math.min(...dunkel.map(r => r.x));
      const x1 = Math.max(...dunkel.map(r => r.x + r.w));
      return { w: x1 - x0 };
    };

    expect(module(pages[0]).w).toBeGreaterThanOrEqual(30 - TOL);
    expect(module(pages[1]).w).toBeGreaterThanOrEqual(20 - TOL);
    // Ruhezone: mindestens vier Module (Kante eines Moduls = kleinstes dunkles Rechteck) rings um das Muster
    const punkt = Math.min(...pages[0].rects.filter(r => r.fill === '#000000' && r.w < 3 && r.h < 3 && r.y < 90).map(r => r.w));
    const rand = (pages[0].links[0].w - module(pages[0]).w) / 2;
    expect(rand).toBeGreaterThanOrEqual(4 * punkt - 0.15);
  });
});

describe.each([
  ['de', ['WANN', 'WO', 'SPIELZEIT', 'ABLAUF']],
  ['en', ['WHEN', 'WHERE', 'MATCH TIME', 'MATCHES']],
] as const)('@DR-031 Bezeichnungen im hellen Block (%s)', (locale, labels) => {
  it.each([['a', FALL_A, 17.2], ['b', FALL_B, 20.6]] as const)('@DR-031 Fall %s: Versalien, fett, 8 pt, je Bezeichnung ein kurzer Akzentstrich; der Block wird nicht höher', async (_n, fall, abstand) => {
    const { pages } = await handzettelPdf(fall, { locale });
    const page = pages[0];
    const texts = labels.map(l => page.texts.find(t => t.str.trim() === l));
    const bold = page.texts[0].font;

    texts.forEach((t, i) => {
      expect(t, labels[i]).toBeDefined();
      expect(t?.size).toBeCloseTo(printSheetHead.factLabelPt, 1);
      expect(t?.font, 'fett wie der Titel').toBe(bold);
      const strich = page.lines.filter(l => Math.abs(l.y1 - l.y2) < 0.01 && t !== undefined && l.y1 > t.y && l.y1 < t.y + 1.2 && Math.abs(Math.abs(l.x2 - l.x1) - printSheetHead.factMarkLength) < 0.1 && Math.abs(l.x1 - t.x) < 0.2);
      expect(strich, `${labels[i]}: ein Strich in Akzentfarbe`).toHaveLength(1);
      expect(strich[0].width).toBeCloseTo(printSheetHead.factMarkStroke, 2);
      // Akzent = Grün der App (±2 je Kanal), schwarzweiß als dunkles Grau sichtbar
      expect(Math.abs(Number.parseInt(strich[0].color.slice(3, 5), 16) - 0x78)).toBeLessThanOrEqual(2);
      expect(grayOf(strich[0].color)).toBeLessThan(128);
    });
    // Block gleich hoch wie vor der Änderung: Abstand der zweiten Zeile von der ersten (gemessen am Stand davor)
    const zweite = page.texts.find(t => t.str.trim() === labels[2]);
    expect((zweite?.y ?? 0) - (texts[0]?.y ?? 0)).toBeCloseTo(abstand, 0);
  });
});

describe.each(['de', 'en'] as const)('@DR-024 Kurzkopf der Folgeseiten: Titel und Zeile darunter mittig im freien Platz (%s)', locale => {
  it.each([['a', FALL_A], ['b', FALL_B]] as const)('Fall %s Seite 2: Mitte jeder Zeile ±0,3 mm auf der Mitte des Platzes links vom QR, keine Überlappung mit dem QR', async (_n, fall) => {
    const { pages } = await handzettelPdf(fall, { locale });
    const page = pages[1];
    const qr = page.links.find(l => l.y < 40);
    const zeilen = page.texts.filter(t => t.y < 40 && t.str.trim() !== '');
    const platz = { von: LEFT, bis: (qr?.x ?? RIGHT) - printHeader.qrColumnGap };

    expect(qr, 'QR im Kurzkopf').toBeDefined();
    expect(zeilen.length).toBeGreaterThanOrEqual(2);
    zeilen.forEach(t => {
      expect(Math.abs(t.x + t.w / 2 - (platz.von + platz.bis) / 2), `„${t.str}“`).toBeLessThanOrEqual(0.3);
      expect(t.x + t.w, `„${t.str}“ vor dem QR`).toBeLessThanOrEqual((qr?.x ?? RIGHT) + 0.3);
    });
  });
});
