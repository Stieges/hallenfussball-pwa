/**
 * T7a, Kopf von Seite 1 am fertigen PDF (pdfjs): @DR-031 Eckdaten, @DR-006/@DR-020 Regelzeile, @DR-024 Titelband in vier Lagen,
 * @DR-039 Titel, Sprache und Lesereihenfolge, @DR-003 QR. Fälle der Mockup-Runde 2 (`fixtures/handzettelFaelle.ts`), feste Uhr.
 * Die Erwartungen stammen aus dem Gherkin des Records „Drucken“, die Zahlen aus den Tokens.
 */
import { describe, expect, it } from 'vitest';
import { printLimits, printPage, printType } from '../../../design-tokens/print';
import { printHeader } from '../../../design-tokens/print-header';
import { FALL_A, FALL_B, FALL_B_LANG, FALL_C } from './fixtures/handzettelFaelle';
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
    const wann = pages[0].texts.find(t => t.str.trim() === 'Wann');
    const wo = pages[0].texts.find(t => t.str.trim() === 'Wo');

    expect(wann && wo ? Math.abs(wann.y - wo.y) : 99).toBeLessThanOrEqual(TOL);
    expect(wann && wo ? wo.x - wann.x : 0).toBeGreaterThan(50);
  });

  it('@DR-031 ohne Halle: keine leere Bezeichnung „Wo“ und kein „·“ am Rand', async () => {
    const { pages } = await handzettelPdf(FALL_A, { tournament: { location: { name: '' } }, options: { hallName: '' } });

    expect(strs(pages[0])).not.toContain('Wo');
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

    expect(flat(pages[0])).toContain('Ablauf15Spiele');
  });

  it('@DR-031 Fall b: unter „Ablauf“ steht „28 Spiele, davon 8 Finalspiele“ in einer Zeile', async () => {
    const { pages } = await handzettelPdf(FALL_B);
    const zeile = pages[0].texts.find(t => t.str.includes('28 Spiele, davon 8 Finalspiele'));

    expect(strs(pages[0])).toContain('Ablauf');
    expect(zeile, 'Text in einem Stück, ohne Umbruch').toBeDefined();
  });

  it('@DR-031 Fall b englisch: „28 matches, 8 of them finals“', async () => {
    const { pages } = await handzettelPdf(FALL_B, { locale: 'en' });

    expect(pages[0].texts.some(t => t.str.includes('28 matches, 8 of them finals'))).toBe(true);
  });

  it('@DR-031 Gegenprobe: würde „Ablauf“ den Block höher machen (ohne Halle: dritte Angabe in einer neuen Zeile), fällt er weg', async () => {
    const { pages } = await handzettelPdf(FALL_A, { tournament: { location: { name: '' } }, options: { hallName: '' } });

    expect(strs(pages[0])).not.toContain('Ablauf');
    expect(flat(pages[0])).not.toContain('15Spiele');
  });

  it('@DR-031 Gegenprobe: verdrängt „Ablauf“ ein Spiel von Seite 1, fällt er weg und alle Spiele bleiben dort', async () => {
    const { pages } = await handzettelPdf(FALL_B_LANG);
    const spiele = pages[0].texts.filter(t => /^\d{1,2}$/.test(t.str.trim()) && t.x < 25 && Math.abs(t.size - printType.nr) < 0.05).length;
    const ohneAblauf = !strs(pages[0]).includes('Ablauf');

    // mit Ablauf hätte Seite 1 weniger Spiele: das Modell wählt die Fassung ohne, solange sie mehr Spiele auf Seite 1 hält
    expect(ohneAblauf || spiele >= 19).toBe(true);
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
    const { pages } = await handzettelPdf(FALL_B, { tournament: { rulebook: 'BFV-Richtlinien' } });
    const kopf = flat(pages[0]);
    const spielzeit = pages[0].texts.find(t => t.str.trim() === 'Spielzeit');
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

describe('@DR-024 Titelband ohne Lücke in vier Lagen', () => {
  const LANG = 'Internationaler Hallenfußball-Wintercup der Sportgemeinschaft Nordheim 2026';
  const titel = (page: LayoutPage): LayoutText[] => {
    const wann = page.texts.find(t => t.str.trim() === 'Wann')?.y ?? 0;
    return page.texts.filter(t => t.size >= printHeader.titleMinPt - 0.05 && t.y < wann);
  };
  const bereich = (lines: LayoutText[]): { von: number; bis: number } => ({
    von: Math.min(...lines.map(t => t.x)),
    bis: Math.max(...lines.map(t => t.x + t.w)),
  });
  const lage = async (links: boolean, rechts: boolean) => {
    const logos = { ...(links ? { logoLeft: fixtureLogo(1) } : {}), ...(rechts ? { logoRight: fixtureLogo(1) } : {}) };
    const { pages } = await handzettelPdf(FALL_A, { tournament: { title: LANG }, options: logos });
    return { page: pages[0], lines: titel(pages[0]) };
  };

  it('@DR-024 beide Grafiken: der Titel steht zwischen ihnen', async () => {
    const { page, lines } = await lage(true, true);
    const [l, r] = [...page.images].sort((a, b) => a.x - b.x);

    expect(page.images).toHaveLength(2);
    expect(bereich(lines).von).toBeGreaterThanOrEqual(l.x + l.w - TOL);
    expect(bereich(lines).bis).toBeLessThanOrEqual(r.x + TOL);
  });

  it('@DR-024 nur links: der Titel beginnt rechts der Grafik und reicht bis zum rechten Rand', async () => {
    const both = bereich((await lage(true, true)).lines);
    const { page, lines } = await lage(true, false);
    const [l] = page.images;

    expect(page.images).toHaveLength(1);
    expect(bereich(lines).von).toBeGreaterThanOrEqual(l.x + l.w - TOL);
    expect(bereich(lines).bis).toBeLessThanOrEqual(RIGHT + TOL);
    expect(bereich(lines).bis, 'nutzt den Platz rechts').toBeGreaterThan(both.bis + 1);
  });

  it('@DR-024 nur rechts: der Titel beginnt am linken Rand und endet vor der Grafik', async () => {
    const both = bereich((await lage(true, true)).lines);
    const { page, lines } = await lage(false, true);
    const [r] = page.images;

    expect(page.images).toHaveLength(1);
    expect(bereich(lines).von).toBeCloseTo(LEFT, 0);
    expect(bereich(lines).bis).toBeLessThanOrEqual(r.x + TOL);
    expect(bereich(lines).von, 'nutzt den Platz links').toBeLessThan(both.von - 1);
  });

  it('@DR-024 keine Grafik: der Titel beginnt am linken Rand, kein Bild, kein Platzhalter „Logo“, keine leere Fläche', async () => {
    const { page, lines } = await lage(false, false);

    expect(page.images).toHaveLength(0);
    expect(bereich(lines).von).toBeCloseTo(LEFT, 0);
    expect(strs(page).some(s => /logo/i.test(s))).toBe(false);
    // außer dem Eckdaten-Block gibt es oberhalb der Kopflinie keine Fläche
    const kopfLinie = Math.min(...page.lines.filter(l => Math.abs(l.y1 - l.y2) < 0.01 && Math.abs(l.x2 - l.x1) > 150).map(l => l.y1));
    expect(page.rects.filter(r => r.y + r.h < kopfLinie && r.w > 1 && r.h > 1)).toEqual([]);
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
