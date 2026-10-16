/**
 * B-28 C3 – „?“-Ersatz und Hinweis vor dem Speichern (B2, @DR-012), Dateiname mit Stand, Rückfall auf die Standardschrift
 * (B6, @DR-013: eine Datei ist immer besser als keine). Nachweise am echten PDF (pdfjs) und am Mitschnitt von `doc.save`.
 *
 * Dokumentiert: `printable` ersetzt JEDES nicht druckbare Zeichen (je Codepunkt) durch ein „?“. Der arabische Name
 * „الأهلي“ besteht aus 6 Codepunkten und wird zu „??????“; „A الأهلي B“ ergibt „A ?????? B“.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateFullSchedule } from '../../../core/generators';
import { jsPDF } from 'jspdf';
import { printType } from '../../../design-tokens/print';
import { fontOf, PDF_FONT, registerPdfFonts } from '../fonts';
import { guardDocText, printable } from '../printable';
import { buildSchedulePdf, exportScheduleToPDF } from '../schedulePdf';
import { HALLENCUP_TEAMS, hallencupSchedule, hallencupTournament } from './pdfFixture';
import { layoutOf, pageText } from './pdfFixtureLayout';
import { lastCapture, resetCapture } from './pdfCapture';
import { extractPdfText } from './pdfjsText';
import { translatorFor } from './pdfText';

vi.mock('jspdf', async importOriginal => {
  const mod = await importOriginal<typeof import('jspdf')>();
  const { capturingJsPdf } = await import('./pdfCapture');
  return { ...mod, default: capturingJsPdf(mod.default), jsPDF: capturingJsPdf(mod.jsPDF) };
});

const NOW = new Date(2026, 10, 14, 15, 7);
const ARABISCH = 'الأهلي';
const alleTexte = (pages: Array<{ texts: Array<{ str: string }> }>): string[] => pages.flatMap(p => p.texts.map(t => t.str));

describe('printable: eine Stelle für den Ersatz', () => {
  it('ersetzt je nicht druckbarem Codepunkt ein „?“ und lässt Druckbares unverändert', () => {
    expect(printable('A الأهلي B')).toBe('A ?????? B');
    expect(printable('Dynamo ⚽ Nord')).toBe('Dynamo ? Nord');
    expect(printable('Łódź Gençler Ğazi Динамо')).toBe('Łódź Gençler Ğazi Динамо');
  });

  it('F4: Variantenwähler und ZWJ fallen weg (⚽️ ergibt ein „?“), NFD wird zu NFC, CRLF zu LF', () => {
    expect(printable('⚽\uFE0F')).toBe('?');
    expect(printable('⚽\u200D⚽')).toBe('??');
    expect(printable('Mu\u0308ller')).toBe('Müller');
    expect(printable('a\r\nb\rc')).toBe('a\nb\nc');
  });

  it('Gegenbeispiel: Zeilenumbruch bleibt, andere Steuerzeichen werden ersetzt', () => {
    expect(printable('a\nb')).toBe('a\nb');
    expect(printable('a\u0007b')).toBe('a?b');
  });
});

describe('F3 guardDocText: Messen und Zeichnen sehen denselben Text', () => {
  it.each(['getTextWidth', 'getStringUnitWidth', 'splitTextToSize'] as const)('%s misst „⚽⚽⚽“ wie „???“', async name => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const mode = await registerPdfFonts(doc);
    guardDocText(doc, mode.covers);
    doc.setFont(fontOf(doc));
    doc.setFontSize(printType.body);

    // `getTextWidth` ist die Rohbreite, die Auswahl `name` liefert Zahl oder Zeilenliste; beide müssen gleich sein
    const gemessen = (text: string): unknown => (doc[name] as (t: string, w?: number) => unknown)(text, 1000);
    expect(gemessen('⚽⚽⚽')).toEqual(gemessen('???'));
    expect(doc.getTextWidth('⚽⚽⚽')).toBeGreaterThan(0);
  });
});

describe('@DR-012 „?“ steht an der Stelle des Zeichens, in allen gedruckten Texten', () => {
  it('Teamname „A الأهلي B“: im PDF steht „A ?????? B“ (6 Fragezeichen), nirgends die arabischen Zeichen', async () => {
    const teams = HALLENCUP_TEAMS.map((team, i) => (i === 0 ? { ...team, name: `A ${ARABISCH} B` } : team));
    const schedule = hallencupSchedule(hallencupTournament({ teams }));
    const { pages } = await layoutOf({ now: NOW }, schedule);
    const texte = alleTexte(pages);

    expect(texte.some(s => s.includes('A ?????? B'))).toBe(true);
    expect(texte.some(s => s.includes('الأهلي'))).toBe(false);
    expect(texte.filter(s => s.includes('A ?????? B') && s.replace(/[^?]/g, '').length !== 6)).toEqual([]);
  });

  it('Turniername mit Sonderzeichen: Kopf, Kurzkopf und Fußzeile tragen „?“', async () => {
    const tournament = hallencupTournament({ title: 'Cup ⚽ Nord' });
    const { pages } = await layoutOf({ now: NOW, tournament }, generateFullSchedule(tournament, 'de'));
    const texte = alleTexte(pages);

    expect(texte).toContain('Cup ? Nord');
    expect(texte).toContain('Cup ? Nord · Stand 14.11. 15:07 · Seite 1 von 3');
    expect(texte.some(s => s.includes('⚽'))).toBe(false);
  });

  it('Halle, Veranstalter, Regelwerk und Kontakt: ebenfalls „?“', async () => {
    const tournament = Object.assign(hallencupTournament({ organizer: `Verein ${ARABISCH}` }), { rulebook: 'Hallenregeln ⚽ gelten' });
    const { pages } = await layoutOf({ now: NOW, tournament, hallName: 'Halle ⚽', contact: 'Anna ⚽ Muster' }, generateFullSchedule(tournament, 'de'));
    const text = pageText(pages[0]);

    expect(text).toContain('Halle ?');
    expect(text).toContain('Verein ??????');
    expect(text).toContain('Hallenregeln ? gelten');
    expect(text).toContain('Anna ? Muster');
    expect(alleTexte(pages).some(s => /[⚽؀-ۿ]/.test(s))).toBe(false);
  });

  it('Gegenbeispiel: darstellbare Texte enthalten kein „?“ (Ł, ğ, Kyrillisch bleiben)', async () => {
    const teams = HALLENCUP_TEAMS.map((team, i) => (i === 0 ? { ...team, name: 'KS Łódź Ğazi Динамо' } : team));
    const { pages } = await layoutOf({ now: NOW }, hallencupSchedule(hallencupTournament({ teams })));
    const texte = alleTexte(pages);

    expect(texte.some(s => s.includes('KS Łódź Ğazi Динамо'))).toBe(true);
    expect(texte.some(s => s.includes('?'))).toBe(false);
  });
});

describe('@DR-012 der Hinweis liegt vor dem Speichern vor (Bauen und Speichern getrennt)', () => {
  it('buildSchedulePdf liefert die Hinweise, ohne gespeichert zu haben; erst doc.save schreibt', async () => {
    const teams = HALLENCUP_TEAMS.map((team, i) => (i === 0 ? { ...team, name: `A ${ARABISCH} B` } : team));
    const tournament = hallencupTournament({ teams });
    resetCapture();

    const build = await buildSchedulePdf({
      schedule: hallencupSchedule(tournament),
      standings: undefined,
      options: { locale: 'de', translate: translatorFor('de'), tournament, now: NOW },
    });

    expect(build.notes).toEqual([`Teamname „A ${ARABISCH} B“ enthält Zeichen, die im PDF als „?“ gedruckt werden`]);
    expect(lastCapture()).toBeUndefined();
    build.doc.save(build.filename);
    expect(lastCapture()?.filename).toBe(build.filename);
  });

  it('Regelwerk und Kontakt werden ebenfalls gemeldet, je mit Feldname', async () => {
    const tournament = Object.assign(hallencupTournament(), { rulebook: 'Hallenregeln ⚽' });
    const { notes } = await buildSchedulePdf({
      schedule: hallencupSchedule(tournament),
      standings: undefined,
      options: { locale: 'de', translate: translatorFor('de'), tournament, now: NOW, contact: 'Anna ⚽' },
    });

    expect(notes).toEqual([
      'Regelwerk „Hallenregeln ⚽“ enthält Zeichen, die im PDF als „?“ gedruckt werden',
      'Ansprechpartner „Anna ⚽“ enthält Zeichen, die im PDF als „?“ gedruckt werden',
    ]);
  });

  it('Gegenbeispiel: nichts Unbekanntes → keine Hinweise', async () => {
    const tournament = hallencupTournament();
    const { notes } = await buildSchedulePdf({
      schedule: hallencupSchedule(tournament),
      standings: undefined,
      options: { locale: 'de', translate: translatorFor('de'), tournament, now: NOW, contact: 'Anna Muster' },
    });

    expect(notes).toEqual([]);
  });
});

describe('Dateiname mit Stand (G59, @BM-027): <Titel>_Spielplan_<JJJJ-MM-TT>_<HHmm>.pdf', () => {
  const nameFor = async (title: string, now: Date, schedule = hallencupSchedule(hallencupTournament({ title }))): Promise<string> => {
    const tournament = hallencupTournament({ title });
    return (await buildSchedulePdf({ schedule, standings: undefined, options: { locale: 'de', translate: translatorFor('de'), tournament, now } })).filename;
  };

  it('Hallencup Nord, 14.11.2026 15:07', async () => {
    expect(await nameFor('Hallencup Nord', NOW)).toBe('Hallencup_Nord_Spielplan_2026-11-14_1507.pdf');
  });

  it('Umlaute bleiben, Leerraum und unzulässige Zeichen werden „_“, ohne doppelte oder randständige Unterstriche', async () => {
    expect(await nameFor('  Größe Cup – D/E-Junioren!  ', new Date(2026, 0, 5, 8, 3))).toBe('Größe_Cup_–_D_E-Junioren!_Spielplan_2026-01-05_0803.pdf');
  });

  it('Gegenbeispiel: ein Titel nur aus unzulässigen Zeichen ergibt „Turnier“, ein späterer Zeitpunkt einen anderen Namen', async () => {
    expect(await nameFor('?/:*', NOW)).toBe('Turnier_Spielplan_2026-11-14_1507.pdf');
    expect(await nameFor('Hallencup Nord', new Date(2026, 10, 14, 15, 8))).toBe('Hallencup_Nord_Spielplan_2026-11-14_1508.pdf');
  });

  it('exportScheduleToPDF speichert unter diesem Namen', async () => {
    resetCapture();
    await exportScheduleToPDF(hallencupSchedule(), undefined, { translate: translatorFor('de'), tournament: hallencupTournament(), now: NOW });

    expect(lastCapture()?.filename).toBe('Hallencup_Nord_Spielplan_2026-11-14_1507.pdf');
  });
});

describe('B6 @DR-013 Rückfall: Schrift lädt nicht → PDF mit Standardschrift plus Hinweis, nicht kein PDF', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const fallbackBuild = async (name = 'FC Nord') => {
    const teams = HALLENCUP_TEAMS.map((team, i) => (i === 0 ? { ...team, name } : team));
    const tournament = hallencupTournament({ teams });
    return buildSchedulePdf({
      schedule: hallencupSchedule(tournament),
      standings: undefined,
      options: { locale: 'de', translate: translatorFor('de'), tournament, now: NOW },
    });
  };

  it('Import schlägt fehl: das PDF entsteht lesbar, der Hinweis „Sonderzeichen evtl. als ?“ liegt vor', async () => {
    vi.spyOn(PDF_FONT.load, 'normal').mockRejectedValue(new Error('Failed to fetch dynamically imported module'));
    const build = await fallbackBuild();
    const pdf = await extractPdfText(new Uint8Array(build.doc.output('arraybuffer')));

    expect(build.notes).toEqual(['Sonderzeichen können als ? erscheinen. Die Schrift konnte nicht geladen werden. Das PDF wird mit einer Ersatzschrift erstellt, alle Inhalte sind enthalten.']);
    expect(pdf.pages.length).toBeGreaterThanOrEqual(3);
    expect(pdf.pages.flat()).toContain('Hallencup Nord · Stand 14.11. 15:07 · Seite 1 von 3');
    expect(pdf.pages.flat()).toContain('FC Nord');
  });

  it('in der Ersatzschrift: Latin-1 (ä) bleibt, was sie nicht trägt (ł) wird „?“', async () => {
    vi.spyOn(PDF_FONT.load, 'bold').mockRejectedValue(new Error('offline'));
    const build = await fallbackBuild('Łódź Süd');
    const pdf = await extractPdfText(new Uint8Array(build.doc.output('arraybuffer')));

    expect(pdf.pages.flat().some(s => s.includes('?ód? Süd'))).toBe(true);
    expect(pdf.pages.flat().some(s => s.includes('Ł'))).toBe(false);
  });

  it('Gegenbeispiel: lädt die Schrift, gibt es keinen Hinweis und Ł bleibt', async () => {
    const build = await fallbackBuild('Łódź Süd');
    const pdf = await extractPdfText(new Uint8Array(build.doc.output('arraybuffer')));

    expect(build.notes).toEqual([]);
    expect(pdf.pages.flat().some(s => s.includes('Łódź Süd'))).toBe(true);
  });

  it('nach einem Fehlschlag ist der nächste Lauf wieder in der eingebetteten Schrift (Inter, kein „?“)', async () => {
    const spy = vi.spyOn(PDF_FONT.load, 'normal').mockRejectedValueOnce(new Error('offline'));
    await fallbackBuild();
    spy.mockRestore();
    const build = await fallbackBuild('Łódź Süd');
    const pdf = await extractPdfText(new Uint8Array(build.doc.output('arraybuffer')));

    expect(build.notes).toEqual([]);
    expect(pdf.pages.flat().some(s => s.includes('Łódź Süd'))).toBe(true);
    expect(pdf.pages.flat().some(s => s.includes('?'))).toBe(false);
  });

  /** Antwort nach `n` Microtasks (0 = sofort). */
  const nach = <T>(n: number, wert: () => Promise<T>): Promise<T> => {
    let kette: Promise<void> = Promise.resolve();
    for (let i = 0; i < n; i++) {
      kette = kette.then(() => undefined);
    }
    return kette.then(wert);
  };

  // A lädt nach j, B scheitert nach k Microtasks: für manche (j, k) liegt der Fehler von B zwischen dem Laden von A und dem
  // ersten Zeichnen von A. Mit Modulzustand wurde A dann Helvetica (Review C3, F1). Hier läuft das ganze Raster.
  it('F1 Wettlauf: überlappende Bauten, A lädt, B fällt zurück – jedes Dokument behält seine Schrift und sein Urteil (Raster j × k)', async () => {
    const geladen = await PDF_FONT.load.normal();
    const geladenFett = await PDF_FONT.load.bold();
    const fehler: string[] = [];
    for (let j = 0; j <= 8; j++) {
      for (let k = 0; k <= 8; k++) {
        let aufrufe = 0;
        vi.spyOn(PDF_FONT.load, 'normal').mockImplementation(() => {
          aufrufe += 1;
          return aufrufe === 1 ? nach(j, async () => geladen) : nach(k, () => Promise.reject(new Error('offline')));
        });
        vi.spyOn(PDF_FONT.load, 'bold').mockImplementation(() => nach(j, async () => geladenFett));
        const [a, b] = await Promise.all([fallbackBuild('Łódź Süd'), fallbackBuild('Łódź Süd')]);
        const textA = (await extractPdfText(new Uint8Array(a.doc.output('arraybuffer')))).pages.flat();
        const textB = (await extractPdfText(new Uint8Array(b.doc.output('arraybuffer')))).pages.flat();
        const ok = a.notes.length === 0 && textA.some(s => s.includes('Łódź Süd')) && (b.notes[0]?.includes('Ersatzschrift') ?? false) && textB.some(s => s.includes('?ód? Süd'));
        if (!ok) {
          fehler.push(`j=${j} k=${k}`);
        }
        vi.restoreAllMocks();
      }
    }

    expect(fehler).toEqual([]);
    // 81 × 2 Bauten mit pdfjs-Auslesen: lokal 6–9 s, in der CI neben der vollen Suite über 5 s (Vorgabe) – eigenes Limit
  }, 60_000);
});
