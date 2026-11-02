/**
 * @DR-001 „Und keine Uhrzeit bricht um, auch „09:00“ steht in einer Zeile“ (Befund aus dem Spielplan-Review 01.11.: „09:“ / „00“).
 * Gelesen aus dem fertigen PDF (pdfjs): jede Spielzeit steht als ein Textstück („09:00“), nie als „09:“ und „00“, in der
 * Gruppenphase und in der Finalrunde, hoch und quer, Deutsch und Englisch, auch mit sehr langen Teamnamen.
 */
import { describe, expect, it } from 'vitest';
import { generateFullSchedule } from '../../../core/generators';
import type { Team } from '../../../types/tournament';
import { testUuid } from '../../../test/testIds';
import { hallencupTournament } from './pdfFixture';
import { layoutOf } from './pdfFixtureLayout';
import { translatorFor } from './pdfText';
import { printGap } from '../../../design-tokens/print';

const LANGE_NAMEN = [
  'Fußballverein Großmehring-Bergheim 1921 e. V.', 'Turn- und Sportverein Oberammergau-Unterammergau', 'Sportgemeinschaft Hohenpeißenberg-Peiting',
  'Sportclub Schwabmünchen-Königsbrunn Jugend', 'Fußballclub Kirchheim-Heimstetten Junioren', 'Turnverein Wolfratshausen-Geretsried',
  'Spielvereinigung Unterhaching-Oberhaching', 'Sportverein Garmisch-Partenkirchen Jugend',
];

const teams: Team[] = LANGE_NAMEN.map((name, i) => ({ id: testUuid(i), name, group: i < 4 ? 'A' : 'B' }));

/** Alle Spielzeiten des Plans als „HH:MM“ (nur der Beginn, unabhängig von den Spalten des PDFs). */
function spielzeiten(startZeit: string): { tournament: ReturnType<typeof hallencupTournament> } {
  return { tournament: hallencupTournament({ timeSlot: startZeit, teams, numberOfTeams: teams.length }) };
}

describe('@DR-001 keine Uhrzeit bricht um', () => {
  it.each([
    ['de', 'hoch', {}],
    ['de', 'quer', { orientation: 'landscape' as const }],
    ['en', 'hoch', {}],
    ['en', 'quer', { orientation: 'landscape' as const }],
  ] as const)('%s, %s: „09:00“ und jede weitere Spielzeit steht als ein Stück in einer Zeile, auch mit langen Teamnamen', async (locale, _form, extra) => {
    const { tournament } = spielzeiten('09:00');
    const schedule = generateFullSchedule(tournament, locale);
    const { pages } = await layoutOf({ tournament, locale, translate: translatorFor(locale), ...extra }, schedule);

    const stuecke = pages.flatMap(page => page.texts.map(t => t.str.trim()));
    const erwartet = [...new Set(schedule.allMatches.map(m => m.time))];
    expect(erwartet).toContain('09:00');
    // Jede Spielzeit des Plans steht in der Tabelle als ganzes Textstück
    for (const zeit of erwartet) {
      expect(stuecke, `Spielzeit ${zeit} als ein Stück`).toContain(zeit);
    }
    // Gegenbeispiel: keine Bruchstücke wie „09:“ und „00“ nebeneinander, die zusammen eine Uhrzeit ergäben
    const bruch = stuecke.filter(s => /^\d{1,2}:$/.test(s));
    expect(bruch, 'abgebrochene Uhrzeit (Stunde mit Doppelpunkt allein)').toEqual([]);
    for (const zeit of erwartet) {
      const [, minuten] = zeit.split(':');
      const gebrochen = pages.some(page => page.texts.some((t, i) => t.str.trim() === `${zeit.split(':')[0]}:` && page.texts[i + 1]?.str.trim() === minuten));
      expect(gebrochen, `Spielzeit ${zeit} nicht in „HH:“ und „MM“ zerlegt`).toBe(false);
    }

    // Geometrie: die gezeichnete Zeitspalte ist mindestens so breit wie die breiteste Uhrzeit samt Innenabstand. Die Spalten haben keine
    // Rahmenlinien; ihre Breite folgt aus den Mitten der zentrierten Zellen (Nr.-Spalte beginnt am linken Tabellenrand):
    //   Mitte Nr = links + Wnr/2,  Mitte Zeit = links + Wnr + Wzeit/2  =>  Wzeit = 2·(Mitte Zeit − links) − 4·(Mitte Nr − links)
    const MITTE = (t: { x: number; w: number }) => t.x + t.w / 2;
    let geprueft = 0;
    for (const page of pages) {
      const links = Math.min(...page.lines.map(l => Math.min(l.x1, l.x2)));
      for (const zeit of page.texts.filter(t => /^\d{2}:\d{2}$/.test(t.str.trim()))) {
        const nr = page.texts
          .filter(t => Math.abs(t.y - zeit.y) < 2 && t.x < zeit.x && /^\d+$/.test(t.str.trim()))
          .sort((a, b) => b.x - a.x)[0];
        if (nr === undefined) { continue; }
        const breite = 2 * (MITTE(zeit) - links) - 4 * (MITTE(nr) - links);
        expect(breite, `Zeitspalte neben ${zeit.str}: Breite ${breite.toFixed(2)} mm, Uhrzeit ${zeit.w.toFixed(2)} mm + Innenabstand`)
          .toBeGreaterThanOrEqual(zeit.w + 2 * printGap.bodyPadH - 0.05);
        geprueft += 1;
      }
    }
    expect(geprueft, 'es wurden Spielzeilen vermessen').toBeGreaterThan(0);
  });
});
