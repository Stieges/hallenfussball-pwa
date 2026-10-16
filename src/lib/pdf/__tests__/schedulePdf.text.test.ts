/**
 * Schrift und Text des Spielplan-PDFs (B-28a2, Spur C): @BM-048 Sonderzeichen, Review Focus 5 (50 Zeichen),
 * Hinweis bei nicht darstellbaren Zeichen, Sprache. Textnachweis hier über den Mitschnitt; der Nachweis
 * am gerenderten PDF (pdfjs) liegt in `schedulePdf.pdfjs.test.ts`.
 */
import { describe, expect, it, vi } from 'vitest';
import { generateFullSchedule } from '../../../core/generators';
import type { Team } from '../../../types/tournament';
import { exportScheduleToPDF } from '../../pdfExporter';
import { isPdfGlyph, unrenderableChars } from '../fonts';
import { HALLENCUP_TEAMS, hallencupTournament } from './pdfFixture';
import { flatText, renderSchedulePdf, translatorFor } from './pdfText';

// jsPDF-Instanzen mitschreiben lassen (Rückfall-Mitschnitt, siehe pdfCapture.ts).
vi.mock('jspdf', async (importOriginal) => {
  const mod = await importOriginal<typeof import('jspdf')>();
  const { capturingJsPdf } = await import('./pdfCapture');
  return { ...mod, default: capturingJsPdf(mod.default), jsPDF: capturingJsPdf(mod.jsPDF) };
});

/** Hallencup mit anderen Teamnamen, Reihenfolge und Gruppen bleiben wie im Fixture. */
function scheduleWithNames(names: string[]) {
  const teams: Team[] = HALLENCUP_TEAMS.map((team, i) => ({ ...team, name: names[i] ?? team.name }));
  return generateFullSchedule(hallencupTournament({ teams }), 'de');
}

const SPECIAL = ['Gençlerbirliği Nord', 'KS Łódź Süd', 'Fußball Düren 1907', 'Işıklar Ğazi', 'Źródło Ost'];
const LONG_50 = 'Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921';

describe('@BM-048 Teamnamen mit Sonderzeichen stehen im PDF', () => {
  it.each(SPECIAL)('„%s“ steht vollständig im Text (Teilnehmer, Spiele, Tabelle)', async name => {
    const schedule = scheduleWithNames([name, ...HALLENCUP_TEAMS.slice(1).map(t => t.name)]);
    const pdf = await renderSchedulePdf(schedule, undefined, { includeStandings: true });
    const text = flatText(pdf);
    // Teilnehmer (nummeriert „n. Name“), Spielzeilen und Tabellenzeile: je ein Textstück.
    expect(text.filter(t => t.includes(name)).length).toBeGreaterThanOrEqual(1);
    expect(text.filter(t => t === name).length).toBeGreaterThanOrEqual(2);
  });

  it('Gegenbeispiel: Namen ohne Sonderzeichen bleiben unverändert', async () => {
    const pdf = await renderSchedulePdf(hallencupSchedule(), undefined, {});
    expect(flatText(pdf)).toContain('FC Nord');
  });

  it('jedes Zeichen der Namen liegt in der eingebetteten Abdeckung', () => {
    for (const name of SPECIAL) {
      expect(unrenderableChars(name)).toEqual([]);
      for (const char of name) {
        expect(isPdfGlyph(char)).toBe(true);
      }
    }
  });
});

describe('Abdeckung der eingebetteten Schrift (Inter)', () => {
  it.each([
    ['Ǆ', 'U+01C4 Ǆ'],
    ['ŉ', 'U+0149 ŉ'],
    ['\u00ad', 'U+00AD weiches Trennzeichen'],
  ])('%s liegt nicht in der Abdeckung und wird gemeldet (%s)', (char) => {
    expect(unrenderableChars(`Team ${char} Nord`)).toEqual([char]);
  });

  it('Steuerzeichen liegen nicht in der Abdeckung', () => {
    expect(unrenderableChars('\u0007\u0001')).toEqual(['\u0007', '\u0001']);
  });
});

describe('Review Focus 5: 50-Zeichen-Name mit ä/ö/ü/ß', () => {
  it('ist 50 Zeichen lang und steht vollständig, ohne „…“', async () => {
    expect(LONG_50).toHaveLength(50);
    const schedule = scheduleWithNames([LONG_50, ...HALLENCUP_TEAMS.slice(1).map(t => t.name)]);
    const pdf = await renderSchedulePdf(schedule, undefined, {});
    const text = flatText(pdf);
    // Zellen dürfen umbrechen (zwei bis drei Zeilen), der Name muss als Ganzes erhalten bleiben.
    const joined = text.map(t => t.replace(/\s*\n\s*/g, ' '));
    expect(joined.filter(t => t === LONG_50).length).toBeGreaterThanOrEqual(2);
    expect(text.some(t => t.includes('…'))).toBe(false);
  });
});

describe('@DR-014 Kyrillisch und Griechisch: darstellbar, kein Hinweis', () => {
  const CYR_GRK = ['Динамо Север', 'Ολυμπιακός'];

  it('beide Namen: jedes Zeichen in der Abdeckung, kein Hinweis beim Erzeugen', async () => {
    for (const name of CYR_GRK) {
      expect(unrenderableChars(name)).toEqual([]);
    }
    const schedule = scheduleWithNames([...CYR_GRK, ...HALLENCUP_TEAMS.slice(2).map(t => t.name)]);
    const result = await exportScheduleToPDF(schedule, undefined, {
      translate: translatorFor('de'),
      tournament: hallencupTournament(),
    });
    expect(result.notes).toEqual([]);
  });
});

describe('Nicht darstellbare Zeichen: Hinweis, PDF entsteht trotzdem', () => {
  it('arabischer Name (Gegenbeispiel DR-012): ein Hinweis mit dem Namen, Export liefert trotzdem ein PDF', async () => {
    const schedule = scheduleWithNames(['الأهلي', ...HALLENCUP_TEAMS.slice(1).map(t => t.name)]);
    const result = await exportScheduleToPDF(schedule, undefined, {
      translate: translatorFor('de'),
      tournament: hallencupTournament(),
    });
    expect(result.notes).toEqual(['Teamname „الأهلي“ enthält Zeichen, die im PDF als „?“ gedruckt werden']);
    const captured = await renderSchedulePdf(schedule, undefined, {});
    expect(captured.pages.length).toBeGreaterThan(0);
  });

  it('Turniername, Veranstalter und Halle: je ein Hinweis mit dem Feldnamen (F8)', async () => {
    const tournament = hallencupTournament({
      title: 'بطولة Nord',
      organizer: 'الأهلي e.V.',
      location: { name: 'Halle Łódź' },
    });
    const result = await exportScheduleToPDF(generateFullSchedule(tournament, 'de'), undefined, {
      translate: translatorFor('de'),
      tournament: hallencupTournament(),
      hallName: 'Halle Ł\u0301ódź الأهلي',
    });
    expect(result.notes).toEqual([
      'Turniername „بطولة Nord“ enthält Zeichen, die im PDF als „?“ gedruckt werden',
      'Veranstalter „الأهلي e.V.“ enthält Zeichen, die im PDF als „?“ gedruckt werden',
      'Halle „Halle Ł\u0301ódź الأهلي“ enthält Zeichen, die im PDF als „?“ gedruckt werden',
    ]);
  });

  it('Gegenbeispiel: darstellbare Namen erzeugen keinen Hinweis', async () => {
    const result = await exportScheduleToPDF(hallencupSchedule(), undefined, {
      translate: translatorFor('de'),
      tournament: hallencupTournament(),
    });
    expect(result.notes).toEqual([]);
  });
});

describe('Sprache des Dokuments', () => {
  it('EN-Lauf: englische Abschnittstitel, kein deutscher Titel', async () => {
    const pdf = await renderSchedulePdf(hallencupSchedule(), undefined, { locale: 'en' });
    const text = flatText(pdf);
    expect(text).toContain('2 Group stage');
    expect(text).toContain('1 Teams');
    expect(text).not.toContain('2 Gruppenphase');
    expect(text).not.toContain('1 Teilnehmer');
    expect(text).not.toContain('Kein Datum');
  });
});

function hallencupSchedule() {
  return generateFullSchedule(hallencupTournament(), 'de');
}
