/**
 * B-28 C3 – „?“-Ersatz und Hinweis vor dem Speichern (B2, @DR-012), Dateiname mit Stand, Rückfall auf die Standardschrift
 * (B6, @DR-013: eine Datei ist immer besser als keine). Nachweise am echten PDF (pdfjs) und am Mitschnitt von `doc.save`.
 *
 * Dokumentiert: `printable` ersetzt JEDES nicht druckbare Zeichen (je Codepunkt) durch ein „?“. Der arabische Name
 * „الأهلي“ besteht aus 6 Codepunkten und wird zu „??????“; „A الأهلي B“ ergibt „A ?????? B“.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateFullSchedule } from '../../../core/generators';
import { PDF_FONT } from '../fonts';
import { printable } from '../printable';
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

  it('Gegenbeispiel: Zeilenumbruch bleibt, andere Steuerzeichen werden ersetzt', () => {
    expect(printable('a\nb')).toBe('a\nb');
    expect(printable('a\u0007b')).toBe('a?b');
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

    expect(build.notes).toEqual([`Teamname ‚A ${ARABISCH} B‘ enthält Zeichen, die im PDF nicht dargestellt werden können`]);
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
      'Regelwerk ‚Hallenregeln ⚽‘ enthält Zeichen, die im PDF nicht dargestellt werden können',
      'Ansprechpartner ‚Anna ⚽‘ enthält Zeichen, die im PDF nicht dargestellt werden können',
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

describe('Dateiname mit Stand: spielplan-<turnier-slug>-<JJJJ-MM-TT>-<HHmm>.pdf', () => {
  const nameFor = async (title: string, now: Date, schedule = hallencupSchedule(hallencupTournament({ title }))): Promise<string> => {
    const tournament = hallencupTournament({ title });
    return (await buildSchedulePdf({ schedule, standings: undefined, options: { locale: 'de', translate: translatorFor('de'), tournament, now } })).filename;
  };

  it('Hallencup Nord, 14.11.2026 15:07', async () => {
    expect(await nameFor('Hallencup Nord', NOW)).toBe('spielplan-hallencup-nord-2026-11-14-1507.pdf');
  });

  it('Umlaute und Sonderzeichen: ASCII-Slug ohne doppelte oder randständige Bindestriche', async () => {
    expect(await nameFor('  Größe Cup – D/E-Junioren!  ', new Date(2026, 0, 5, 8, 3))).toBe('spielplan-groesse-cup-d-e-junioren-2026-01-05-0803.pdf');
  });

  it('Gegenbeispiel: ein Titel ohne verwertbares Zeichen ergibt „turnier“, ein späterer Zeitpunkt einen anderen Namen', async () => {
    expect(await nameFor('⚽⚽', NOW)).toBe('spielplan-turnier-2026-11-14-1507.pdf');
    expect(await nameFor('Hallencup Nord', new Date(2026, 10, 14, 15, 8))).toBe('spielplan-hallencup-nord-2026-11-14-1508.pdf');
  });

  it('exportScheduleToPDF speichert unter diesem Namen', async () => {
    resetCapture();
    await exportScheduleToPDF(hallencupSchedule(), undefined, { translate: translatorFor('de'), tournament: hallencupTournament(), now: NOW });

    expect(lastCapture()?.filename).toBe('spielplan-hallencup-nord-2026-11-14-1507.pdf');
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

    expect(build.notes).toEqual(['Die Schrift konnte nicht geladen werden. Das PDF nutzt eine Ersatzschrift, Sonderzeichen erscheinen evtl. als ?']);
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

  it('nach einem Fehlschlag ist der nächste Lauf wieder in der eingebetteten Schrift', async () => {
    const spy = vi.spyOn(PDF_FONT.load, 'normal').mockRejectedValueOnce(new Error('offline'));
    await fallbackBuild();
    spy.mockRestore();
    const build = await fallbackBuild('Łódź Süd');

    expect(build.notes).toEqual([]);
    expect(PDF_FONT.family).toBe('pdfSans');
  });
});
