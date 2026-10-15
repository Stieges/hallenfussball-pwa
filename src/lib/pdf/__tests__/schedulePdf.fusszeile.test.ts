/**
 * B-28 C3 – Fußzeile (a3-6, B5b): Stand, Seitenzahl, Netzhinweis, Endstand, Kontakt, Abstand zum Papierrand.
 * Nachweise am echten PDF (pdfjs, Koordinaten gemessen): @BM-010, @ZP-052, @BM-023, @DR-021, @DR-001 (Fußzeile oberhalb
 * des Rands, Schrift der Fußzeile ab 7,5 pt), @W1-031, @W1-032 (Kontakt nur auf Übergabe).
 */
import { describe, expect, it } from 'vitest';
import { generateFullSchedule } from '../../../core/generators';
import { printLimits, printPage, printType } from '../../../design-tokens/print';
import { hallencupTournament } from './pdfFixture';
import { FIXTURES, layoutOf, pageText } from './pdfFixtureLayout';
import { DESCENT_REGULAR_EM } from './pdfFontMetrics';
import type { LayoutPage, LayoutText } from './pdfjsLayout';
import { translatorFor } from './pdfText';

/** Fester Zeitpunkt: 14.11.2026 15:07 Ortszeit. */
const NOW = new Date(2026, 10, 14, 15, 7);
const TOL = 0.05;
const MM_PER_PT = 25.4 / 72;
/** Fußzeilen-Zeilen erkennt man an „Seite x von y“ bzw. am Kontakt; Stand und Titel stehen davor. */
const SEITE = /Seite \d+ von \d+/;

/** Textstücke im Fußbereich: alles, was unterhalb der Fußlinie steht (Linie = unterste lange waagerechte Linie). */
function fussbereich(page: LayoutPage): { linie: number; texte: LayoutText[] } {
  const lange = page.lines.filter(l => Math.abs(l.y1 - l.y2) < TOL && Math.abs(l.x2 - l.x1) > 150);
  const linie = Math.max(...lange.map(l => l.y1));
  return { linie, texte: page.texts.filter(t => t.y > linie) };
}

describe('@BM-010 @ZP-052 Fußzeile: Titel · Stand · Seite x von y auf jeder Seite', () => {
  it('Hallencup Nord, 14.11. 15:07: Seite x von 3 mit x = Seitenindex', async () => {
    const { pages } = await layoutOf({ now: NOW });

    expect(pages).toHaveLength(3);
    pages.forEach((page, i) => {
      const zeile = `Hallencup Nord · Stand 14.11. 15:07 · Seite ${i + 1} von 3`;
      expect(page.texts.map(t => t.str), `Seite ${i + 1}`).toContain(zeile);
    });
  });

  it('Gegenbeispiel: ein anderer Zeitpunkt ergibt eine andere Zeile, die Zeit kommt aus now', async () => {
    const { pages } = await layoutOf({ now: new Date(2026, 5, 3, 9, 5) });

    expect(pages[0].texts.map(t => t.str)).toContain('Hallencup Nord · Stand 03.06. 09:05 · Seite 1 von 3');
    expect(pageText(pages[0])).not.toContain('14.11. 15:07');
  });

  it('EN: „As of“ und „Page x of y“', async () => {
    const { pages } = await layoutOf({ now: NOW, locale: 'en', translate: translatorFor('en') });

    expect(pages[1].texts.map(t => t.str)).toContain('Hallencup Nord · As of 14.11. 15:07 · Page 2 of 3');
  });
});

describe('@BM-023 @DR-021 Netzhinweis: ohne Verbindung steht er auf jeder Seite', () => {
  const HINWEIS = 'Stand 14.11. 15:07 – ohne Verbindung, Einträge anderer Geräte können fehlen';

  it('online: false → Stand mit Zusatz auf jeder Seite', async () => {
    const { pages } = await layoutOf({ now: NOW, online: false });

    pages.forEach((page, i) => {
      const fuss = fussbereich(page).texte.map(t => t.str).join(' ');
      expect(fuss, `Seite ${i + 1}`).toContain(HINWEIS);
      expect(fuss, `Seite ${i + 1}`).toContain(`Seite ${i + 1} von 3`);
    });
  });

  it('Gegenbeispiel: online: true und ohne Angabe → kein Zusatz auf keiner Seite', async () => {
    for (const options of [{ now: NOW, online: true }, { now: NOW }]) {
      const { pages } = await layoutOf(options);
      pages.forEach(page => expect(pageText(page)).not.toContain('ohne Verbindung'));
    }
  });
});

describe('@DR-001 Fußzeile samt Unterlängen oberhalb des Rands (B5b)', () => {
  describe.each(FIXTURES)('$name', ({ options, schedule }) => {
    it.each([
      ['ohne Zusätze', {}],
      ['ohne Verbindung und mit Kontakt', { online: false, contact: 'Anna Muster, 0170 1234567' }],
    ])('%s: unterste Grundlinie + Unterlänge der Schrift liegt oberhalb von Höhe − Rand', async (_name, extra) => {
      const { pages, height } = await layoutOf({ ...options, now: NOW, ...extra }, schedule());
      const unterlaenge = (t: LayoutText): number => t.size * DESCENT_REGULAR_EM * MM_PER_PT;

      pages.forEach((page, i) => {
        const { linie, texte } = fussbereich(page);
        expect(texte.length, `Seite ${i + 1} Fußzeile`).toBeGreaterThan(0);
        texte.forEach(t => {
          expect(t.y + unterlaenge(t), `Seite ${i + 1} „${t.str}“`).toBeLessThanOrEqual(height - printLimits.margin + TOL);
          expect(t.size, `Seite ${i + 1} Schriftgröße`).toBeGreaterThanOrEqual(printLimits.minFontPt - TOL);
          expect(Math.abs(t.size - printType.foot)).toBeLessThanOrEqual(TOL);
        });
        // Der Inhalt endet über der Fußlinie, die Fußlinie über der Oberkante der Fußzeile
        page.texts.filter(t => !texte.includes(t)).forEach(t => expect(t.y, `Seite ${i + 1} „${t.str}“ über der Fußlinie`).toBeLessThanOrEqual(linie + TOL));
        page.rects.forEach(r => expect(r.y + r.h, `Seite ${i + 1} Rechteck über der Fußlinie`).toBeLessThanOrEqual(linie + TOL));
      });
    });
  });
});

describe('@W1-031 @W1-032 Kontakt in der Fußzeile nur auf Übergabe', () => {
  it('mit contact: der Kontakt steht auf jeder Seite, die Seitenzahl bleibt', async () => {
    const { pages } = await layoutOf({ now: NOW, contact: 'Anna Muster, 0170 1234567' });

    pages.forEach((page, i) => {
      const fuss = fussbereich(page).texte.map(t => t.str).join(' ');
      expect(fuss, `Seite ${i + 1}`).toContain('Anna Muster, 0170 1234567');
      expect(fuss).toMatch(SEITE);
    });
  });

  it('Gegenbeispiel: ohne contact, mit leerem und mit nur aus Leerraum bestehendem contact kein Kontakt und keine Lücke', async () => {
    const ohne = await layoutOf({ now: NOW });
    for (const contact of ['', '   ']) {
      const { pages } = await layoutOf({ now: NOW, contact });
      pages.forEach((page, i) => {
        expect(pageText(page)).not.toMatch(/Kontakt|Anna/);
        // gleiche Fußzeile an gleicher Stelle wie ohne Eingang
        expect(fussbereich(page).linie).toBeCloseTo(fussbereich(ohne.pages[i]).linie, 2);
      });
    }
    ohne.pages.forEach(page => expect(pageText(page)).not.toContain('Kontakt'));
  });
});

describe('@BM-035 @DR-011 Fassung final: statt „Stand …“ steht die Abschlusszeile (Anschluss C10, hier nur Parameter)', () => {
  it('edition final mit closedAt: „Endstand – abgeschlossen am 14.11.2026 um 17:40“ statt Stand, Seitenzahl bleibt', async () => {
    const { pages } = await layoutOf({ now: NOW, edition: 'final', closedAt: new Date(2026, 10, 14, 17, 40) });

    pages.forEach((page, i) => {
      expect(page.texts.map(t => t.str), `Seite ${i + 1}`).toContain(`Hallencup Nord · Endstand – abgeschlossen am 14.11.2026 um 17:40 · Seite ${i + 1} von 3`);
      expect(pageText(page)).not.toContain('Stand 14.11.');
    });
  });

  it('Gegenbeispiel: Fassung Spielplan und Vorlage tragen keine Abschlusszeile', async () => {
    for (const edition of ['plan', 'blank'] as const) {
      const { pages } = await layoutOf({ now: NOW, edition, closedAt: new Date(2026, 10, 14, 17, 40) });
      pages.forEach(page => expect(pageText(page)).not.toContain('abgeschlossen'));
    }
  });
});

describe('F3 Breitenmessung: gemessen wird, was gedruckt wird', () => {
  it('Titel aus nicht druckbaren Zeichen: Fußzeile und Kurzkopf bleiben im Satzspiegel (getTextWidth misst „?“, nicht das fehlende Glyph)', async () => {
    const titel = '⚽'.repeat(60);
    const tournament = hallencupTournament({ title: titel });
    const { pages, width } = await layoutOf({ now: NOW, tournament, online: false }, generateFullSchedule(tournament, 'de'));
    const rechts = width - printPage.margin.right;

    pages.forEach((page, i) => {
      page.texts.forEach(t => expect(t.x + t.w, `Seite ${i + 1} „${t.str}“`).toBeLessThanOrEqual(rechts + TOL));
    });
    expect(pages[0].texts.some(t => t.str.includes('?'))).toBe(true);
  });
});

describe('P2 langer Turniername: die Fußzeile bricht um und kürzt nie', () => {
  const LANG = 'Internationaler Hallenfußball-Wintercup der SG Nordheim 2026';

  it.each([['online', true], ['ohne Verbindung', false]])('60-Zeichen-Titel (%s) steht vollständig in der Fußzeile, ohne „…“, oberhalb des Rands', async (_n, online) => {
    expect(LANG).toHaveLength(60);
    const tournament = hallencupTournament({ title: LANG });
    const { pages, height } = await layoutOf({ now: NOW, tournament, online }, generateFullSchedule(tournament, 'de'));

    pages.forEach((page, i) => {
      const { texte } = fussbereich(page);
      const fuss = texte.map(t => t.str).join(' ');
      expect(fuss, `Seite ${i + 1}`).toContain(LANG);
      expect(fuss).toContain(`Seite ${i + 1} von ${pages.length}`);
      expect(fuss).not.toContain('…');
      texte.forEach(t => expect(t.y + t.size * DESCENT_REGULAR_EM * MM_PER_PT).toBeLessThanOrEqual(height - printLimits.margin + TOL));
    });
  });
});
