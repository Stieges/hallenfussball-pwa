/**
 * B-28 C8 – Wortlaut des PDFs nach Daniels Entscheidungen vom 16.10. (G57, G59, G62, G70 bis G76), gelesen aus dem
 * fertigen PDF (pdfjs). Kennungen: @BM-052 (Kopfzeile), @DR-011/@DR-006/@DR-020 (Datum, Regelzeilen), @DR-022 (Sprache),
 * @BM-032/@ZM-102 (EN „to be decided“), @W1-031 (Ansprechpartner), @DR-015 (K.-o.-Zeile).
 */
import { describe, expect, it } from 'vitest';
import { hallencupSchedule, hallencupTournament } from './pdfFixture';
import { layoutOf } from './pdfFixtureLayout';
import { readMetadata, readLayout } from './pdfjsLayout';
import { buildSchedulePdf } from '../schedulePdf';
import type { LayoutPage } from './pdfjsLayout';
import { translatorFor } from './pdfText';

const NOW = new Date(2026, 10, 14, 15, 7);
const strs = (page: LayoutPage): string[] => page.texts.map(t => t.str.trim()).filter(s => s !== '');
const allStrs = (pages: LayoutPage[]): string[] => pages.flatMap(strs);
async function handzettelLike(edition: 'plan' | 'blank', locale: 'de' | 'en'): Promise<{ pages: LayoutPage[]; bytes: Uint8Array }> {
  const tournament = hallencupTournament();
  const { doc } = await buildSchedulePdf({ schedule: hallencupSchedule(tournament), standings: undefined, options: { tournament, locale, translate: translatorFor(locale), edition, now: NOW } });
  const bytes = new Uint8Array(doc.output('arraybuffer'));
  return { pages: await readLayout(bytes), bytes };
}
/** Text von Seite 1 ohne Leerraum: Regelzeilen fließen und brechen zwischen Wörtern um. */
const flat = (page: LayoutPage): string => page.texts.map(t => t.str).join('').replace(/\s/g, '');
const en = { locale: 'en' as const, translate: translatorFor('en') };

describe('G57 @BM-052 @DR-005 „Spielplan“ ohne Zusatz in beiden Fassungen: Titel der Datei (Kicker entfällt im Handzettel)', () => {
  it.each([['plan', 'de', 'Spielplan'], ['blank', 'de', 'Spielplan'], ['blank', 'en', 'Schedule']] as const)('Fassung %s (%s): Titel „Hallencup Nord – %s“, kein Zusatz im Text', async (edition, locale, wort) => {
    const { pages, bytes } = await handzettelLike(edition, locale);

    expect((await readMetadata(bytes)).title).toBe(`Hallencup Nord – ${wort}`);
    expect(strs(pages[0]).some(s => s.startsWith(`${wort} · `)), 'Zeile unter dem Titel beginnt mit dem Wort').toBe(true);
    expect(strs(pages[0]).filter(s => /zum Ausfüllen|ohne Ergebnisse|fill in|without results|eintragen/i.test(s))).toEqual([]);
  });
});

describe('G71 @DR-020 „Modus: Gruppen + Finalrunde“', () => {
  it.each([
    ['de', 'Modus', 'Gruppen + Finalrunde'],
    ['en', 'Mode', 'Groups + final round'],
  ] as const)('%s: Zeile %s', async (locale, label, value) => {
    const { pages } = await layoutOf({ now: NOW, locale, translate: translatorFor(locale) });

    expect(flat(pages[0])).toContain(`${label}:${value}`.replace(/\s/g, ''));
    expect(flat(pages[0])).not.toContain((locale === 'de' ? 'Gruppen + Finale·' : 'Groups + Finals·').replace(/\s/g, ''));
  });
});

describe('G72 @DR-006 @DR-020 Regelzeile „Wertung“, „Platzierung“ bleibt der Block der Plätze', () => {
  it('DE: Kopf nennt „Wertung“ mit den Kriterien, nicht „Platzierung“', async () => {
    const { pages } = await layoutOf({ now: NOW });
    const kopf = flat(pages[0]);

    expect(kopf).toContain('Wertung:');
    expect(kopf).toContain('Punkte–Tordifferenz–Tore–direkterVergleich');
    expect(kopf).not.toContain('Platzierung:');
  });

  it('Gegenbeispiel: der Block der Plätze heißt weiter „Platzierung“', async () => {
    const { pages } = await layoutOf({ now: NOW });

    expect(allStrs(pages).some(s => /^\d+ Platzierung$/.test(s))).toBe(true);
  });

  it('EN: „Tiebreakers“ in der Regelzeile, „Final ranking“ für den Block', async () => {
    const { pages } = await layoutOf({ now: NOW, ...en });

    expect(flat(pages[0])).toContain('Tiebreakers:');
    expect(allStrs(pages).some(s => /^\d+ Final ranking$/.test(s))).toBe(true);
  });
});

describe('G73 englische Wortlaute', () => {
  it('Regelzeile „Match time“, nie „Game time“', async () => {
    const { pages } = await layoutOf({ now: NOW, ...en });
    const text = allStrs(pages);

    expect(text).toContain('MATCH TIME');
    expect(text.join(' ')).not.toContain('Game time');
  });

  it('Zeitzeile mit abweichender Finalrunde: „Final round 12 minutes“, nicht „Finals“', async () => {
    const tournament = hallencupTournament({ finalRoundGameDuration: 12 });
    const { pages } = await layoutOf({ now: NOW, tournament, ...en }, hallencupSchedule(tournament));
    const text = allStrs(pages).join(' ');

    expect(text).toContain('Groups 10 minutes · Final round 12 minutes');
    expect(text).not.toContain('Finals 12 min');
  });

  it('„Times expected“ über den Finalspielen', async () => {
    const { pages } = await layoutOf({ now: NOW, ...en });
    const text = allStrs(pages);

    expect(text).toContain('Times expected');
    expect(text).not.toContain('Times provisional');
  });
});

describe('G62 @BM-032 @ZM-102 englisch „to be decided“ für einen offenen Platz', () => {
  it('EN: Tabellen aus, offener Platz zeigt „to be decided“, nie „open“', async () => {
    const tournament = hallencupTournament({ hideRankingsForPublic: true });
    const { pages } = await layoutOf({ now: NOW, tournament, ...en }, hallencupSchedule(tournament));
    const text = allStrs(pages);

    expect(text).toContain('to be decided');
    expect(text).not.toContain('open');
  });
});

describe('G74 @DR-015 K.-o.-Zeile „3 Schützen je Team“ (Vorgabe seit @W2A-012)', () => {
  it('DE: „… Strafstoßschießen, 3 Schützen je Team“; EN: „3 shooters per team“', async () => {
    const de = await layoutOf({ now: NOW });
    const eng = await layoutOf({ now: NOW, ...en });

    expect(allStrs(de.pages).join(' ')).toContain('Strafstoßschießen, 3 Schützen je Team');
    expect(allStrs(eng.pages).join(' ')).toContain('penalty shootout, 3 shooters per team');
  });
});

describe('G76 @W1-031 Fußzeile „Ansprechpartner:“ statt „Kontakt:“', () => {
  it('DE und EN', async () => {
    const de = await layoutOf({ now: NOW, contact: 'Anna Muster, 0170 1234567' });
    const eng = await layoutOf({ now: NOW, contact: 'Anna Muster, 0170 1234567', ...en });

    expect(allStrs(de.pages)).toContain('Ansprechpartner: Anna Muster, 0170 1234567');
    expect(allStrs(de.pages).join(' ')).not.toContain('Kontakt:');
    expect(allStrs(eng.pages)).toContain('Contact person: Anna Muster, 0170 1234567');
  });
});
