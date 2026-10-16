/**
 * B-28 C8 – Wortlaut des PDFs nach Daniels Entscheidungen vom 16.10. (G57, G59, G62, G70 bis G76), gelesen aus dem
 * fertigen PDF (pdfjs). Kennungen: @BM-052 (Kopfzeile), @DR-011/@DR-006/@DR-020 (Datum, Regelzeilen), @DR-022 (Sprache),
 * @BM-032/@ZM-102 (EN „to be decided“), @W1-031 (Ansprechpartner), @DR-015 (K.-o.-Zeile).
 */
import { describe, expect, it } from 'vitest';
import { schedulePdfFilename } from '../filename';
import { hallencupSchedule, hallencupTournament } from './pdfFixture';
import { layoutOf } from './pdfFixtureLayout';
import type { LayoutPage } from './pdfjsLayout';
import { translatorFor } from './pdfText';

const NOW = new Date(2026, 10, 14, 15, 7);
const strs = (page: LayoutPage): string[] => page.texts.map(t => t.str.trim()).filter(s => s !== '');
const allStrs = (pages: LayoutPage[]): string[] => pages.flatMap(strs);
const en = { locale: 'en' as const, translate: translatorFor('en') };

describe('G57 @BM-052 Kopfzeile „Spielplan“ steht auf dem normalen Spielplan', () => {
  it('Spielplan: erste Zeile der Seite 1 ist „Spielplan“, über dem Turniernamen', async () => {
    const { pages } = await layoutOf({ now: NOW });
    const kicker = pages[0].texts.find(t => t.str.trim() === 'Spielplan');
    const titel = pages[0].texts.find(t => t.str.trim() === 'Hallencup Nord');

    expect(kicker, 'Kopfzeile „Spielplan“').toBeDefined();
    expect(kicker && titel ? kicker.y : 0).toBeLessThan(titel?.y ?? 0);
  });

  it('Gegenbeispiel: die Fassung zum Ausfüllen heißt „Spielplan zum Ausfüllen“, nie zusätzlich „Spielplan“ allein', async () => {
    const { pages } = await layoutOf({ now: NOW, edition: 'blank' });

    expect(strs(pages[0])).toContain('Spielplan zum Ausfüllen');
    expect(strs(pages[0])).not.toContain('Spielplan');
  });

  it('Gegenbeispiel: nur die erste Seite trägt die Kopfzeile', async () => {
    const { pages } = await layoutOf({ now: NOW });

    pages.slice(1).forEach(page => expect(strs(page)).not.toContain('Spielplan'));
  });

  it('EN: Kopfzeile „Schedule“', async () => {
    const { pages } = await layoutOf({ now: NOW, ...en });

    expect(strs(pages[0])).toContain('Schedule');
  });
});

describe('G59 Dateiname wie im Record (@BM-027): <Titel>_Spielplan_<Datum>_<HHmm>.pdf', () => {
  it('Hallencup Nord, 14.11.2026 15:07', () => {
    expect(schedulePdfFilename('Hallencup Nord', NOW)).toBe('Hallencup_Nord_Spielplan_2026-11-14_1507.pdf');
  });

  it('Umlaute bleiben, Leerraum und unzulässige Zeichen werden „_“, mehrere hintereinander ein „_“', () => {
    expect(schedulePdfFilename('Süd/Ost: Cup  ', new Date(2026, 0, 5, 8, 3))).toBe('Süd_Ost_Cup_Spielplan_2026-01-05_0803.pdf');
  });

  it('Gegenbeispiel: nur unzulässige Zeichen ergeben „Turnier“, kein leerer Name', () => {
    expect(schedulePdfFilename('?*', NOW)).toBe('Turnier_Spielplan_2026-11-14_1507.pdf');
  });
});

describe('G70 @DR-011 englisches Datum im Kopf wie in der Fußzeile: 14.11.2026', () => {
  it('EN: „Saturday, 14.11.2026 · Start 13:00 …“, nie 11/14/2026', async () => {
    const { pages } = await layoutOf({ now: NOW, ...en });
    const text = allStrs(pages).join(' ');

    expect(text).toContain('Saturday, 14.11.2026');
    expect(text).not.toContain('11/14/2026');
  });

  it('DE bleibt „Samstag, 14.11.2026“', async () => {
    const { pages } = await layoutOf({ now: NOW });

    expect(allStrs(pages).join(' ')).toContain('Samstag, 14.11.2026');
  });
});

describe('G71 @DR-020 „Modus: Gruppen + Finalrunde“', () => {
  it.each([
    ['de', 'Modus', 'Gruppen + Finalrunde'],
    ['en', 'Mode', 'Groups + final round'],
  ] as const)('%s: Zeile %s', async (locale, label, value) => {
    const { pages } = await layoutOf({ now: NOW, locale, translate: translatorFor(locale) });

    expect(strs(pages[0])).toEqual(expect.arrayContaining([label, value]));
    expect(strs(pages[0])).not.toContain(locale === 'de' ? 'Gruppen + Finale' : 'Groups + Finals');
  });
});

describe('G72 @DR-006 @DR-020 Regelzeile „Wertung“, „Platzierung“ bleibt der Block der Plätze', () => {
  it('DE: Kopf nennt „Wertung“ mit den Kriterien, nicht „Platzierung“', async () => {
    const { pages } = await layoutOf({ now: NOW });
    const kopf = strs(pages[0]).slice(0, 20);

    expect(kopf).toContain('Wertung');
    expect(kopf).toContain('Punkte – Tordifferenz – Tore – direkter Vergleich');
    expect(kopf).not.toContain('Platzierung');
  });

  it('Gegenbeispiel: der Block der Plätze heißt weiter „Platzierung“', async () => {
    const { pages } = await layoutOf({ now: NOW });

    expect(allStrs(pages).some(s => /^\d+ Platzierung$/.test(s))).toBe(true);
  });

  it('EN: „Tiebreakers“ in der Regelzeile, „Final ranking“ für den Block', async () => {
    const { pages } = await layoutOf({ now: NOW, ...en });

    expect(strs(pages[0]).slice(0, 20)).toContain('Tiebreakers');
    expect(allStrs(pages).some(s => /^\d+ Final ranking$/.test(s))).toBe(true);
  });
});

describe('G73 englische Wortlaute', () => {
  it('Regelzeile „Match time“, nie „Game time“', async () => {
    const { pages } = await layoutOf({ now: NOW, ...en });
    const text = allStrs(pages);

    expect(text).toContain('Match time');
    expect(text.join(' ')).not.toContain('Game time');
  });

  it('Zeitzeile mit abweichender Finalrunde: „Final round 12 min“, nicht „Finals“', async () => {
    const tournament = hallencupTournament({ finalRoundGameDuration: 12 });
    const { pages } = await layoutOf({ now: NOW, tournament, ...en }, hallencupSchedule(tournament));
    const text = allStrs(pages).join(' ');

    expect(text).toContain('Groups 10 min · Final round 12 min');
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

describe('G74 @DR-015 K.-o.-Zeile „5 Schützen je Team“', () => {
  it('DE: „… Strafstoßschießen, 5 Schützen je Team“; EN: „5 shooters per team“', async () => {
    const de = await layoutOf({ now: NOW });
    const eng = await layoutOf({ now: NOW, ...en });

    expect(allStrs(de.pages).join(' ')).toContain('Strafstoßschießen, 5 Schützen je Team');
    expect(allStrs(eng.pages).join(' ')).toContain('penalty shootout, 5 shooters per team');
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
