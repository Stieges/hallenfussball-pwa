/**
 * A-36b Pflichttest (Teilplan A-36 § 4): `expected.ts` als Tabelle über `buildTournamentView`, für alle
 * Zielgruppen × Medien × DE/EN – Seitentexte, Vorlage, Spielbezeichnung, keine Rohtexte.
 */
import { describe, expect, it, vi } from 'vitest';
import { buildTournamentView } from '../tournamentView';
import type { SideView, TournamentView, ViewAudience, ViewEdition, ViewLocale, ViewMedium } from '../types';
import { f3G, fHF, fNEU, fTAB, GAME, type Hallencup } from '../__fixtures__/hallencupNord';
import { EXPECTED_BLANK, EXPECTED_LABEL, EXPECTED_PLAN, FORBIDDEN_FRAGMENTS, type ExpectedSide, type Text } from '../__fixtures__/expected';

vi.mock('i18next', async () => (await import('./realI18n')).realI18nModule());

const CELLS: Array<[ViewAudience, ViewMedium]> = [
  ['organizer', 'app'], ['organizer', 'print'], ['viewer', 'app'], ['viewer', 'print'], ['screen', 'app'],
];
const LOCALES: ViewLocale[] = ['de', 'en'];
const MATRIX = CELLS.flatMap(([audience, medium]) => LOCALES.map((locale) => [audience, medium, locale] as const));

const VARIANTS = { 'F-HF': fHF, 'F-TAB': fTAB, 'F-3G': f3G, 'F-NEU': fNEU } as const;
const cache = new Map<string, Promise<Hallencup>>();
function variant(name: keyof typeof VARIANTS): Promise<Hallencup> {
  const hit = cache.get(name) ?? VARIANTS[name]();
  cache.set(name, hit);
  return hit;
}

async function view(name: keyof typeof VARIANTS, audience: ViewAudience, medium: ViewMedium, locale: ViewLocale, edition?: ViewEdition): Promise<{ v: TournamentView; cup: Hallencup }> {
  const cup = await variant(name);
  return { v: buildTournamentView(cup.tournament, { audience, medium, locale, ...(edition ? { edition } : {}) }), cup };
}

const SIDES = {
  hf1Home: (v: TournamentView, cup: Hallencup) => v.byId.get(cup.tournament.matches[GAME.HF1].id)?.home,
  hf1Away: (v: TournamentView, cup: Hallencup) => v.byId.get(cup.tournament.matches[GAME.HF1].id)?.away,
  hf2Home: (v: TournamentView, cup: Hallencup) => v.byId.get(cup.tournament.matches[GAME.HF2].id)?.home,
  finalHome: (v: TournamentView, cup: Hallencup) => v.byId.get(cup.tournament.matches[GAME.FINAL].id)?.home,
} as const;

function expectSide(side: SideView | undefined, expected: ExpectedSide, locale: ViewLocale): void {
  expect(side?.label).toBe(expected.label[locale]);
  expect(side?.subLabel).toBe(expected.subLabel?.[locale]);
}

function planRows(name: keyof typeof EXPECTED_PLAN): Array<[string, ExpectedSide]> {
  return Object.entries(EXPECTED_PLAN[name]);
}

describe('@TM-015 @BM-014 F-HF Spielplan: besetzt mit Herkunft klein, offen mit Herkunft', () => {
  it.each(MATRIX)('@TM-015 @BM-014 %s·%s·%s', async (audience, medium, locale) => {
    const { v, cup } = await view('F-HF', audience, medium, locale);
    for (const [key, expected] of planRows('F-HF')) {
      expectSide(SIDES[key as keyof typeof SIDES](v, cup), expected, locale);
    }
  });

  it('@TM-015 F-3G: drei Gruppen in der Konfiguration (Drift) ändern die gespeicherte Herkunft nicht', async () => {
    for (const [audience, medium, locale] of MATRIX) {
      const { v, cup } = await view('F-3G', audience, medium, locale);
      for (const [key, expected] of planRows('F-3G')) {
        expectSide(SIDES[key as keyof typeof SIDES](v, cup), expected, locale);
      }
    }
  });
});

describe('@ZM-102 @BM-032 F-TAB: ausgeschaltete Tabellen verraten keinen Platz', () => {
  it.each(MATRIX)('@ZM-102 @BM-032 %s·%s·%s', async (audience, medium, locale) => {
    const { v, cup } = await view('F-TAB', audience, medium, locale);
    const rows = audience === 'organizer' && medium === 'app' ? planRows('F-TAB leitungApp') : planRows('F-TAB');
    for (const [key, expected] of rows) {
      expectSide(SIDES[key as keyof typeof SIDES](v, cup), expected, locale);
    }
  });

  it('@ZM-102 Gegenbeispiel: organizer·app bei F-TAB zeigt „Zweiter Gruppe B“', async () => {
    const { v, cup } = await view('F-TAB', 'organizer', 'app', 'de');
    expect(SIDES.hf1Away(v, cup)?.label).toBe('Zweiter Gruppe B');
  });
});

describe('@DR-005 @DR-018 Vorlage (Spielplan ohne Ergebnisse): Herkunft des Platzes, nie ein Teamname', () => {
  const blankNames = ['F-HF', 'F-TAB', 'F-3G', 'F-NEU'] as const;
  const blankCases = blankNames.flatMap((name) =>
    CELLS.flatMap(([audience, medium]) => LOCALES.map((locale) => [name, audience, medium, locale] as const)),
  );
  it.each(blankCases)('@DR-005 @DR-018 @ZM-102 %s %s·%s·%s', async (name, audience, medium, locale) => {
    const { v, cup } = await view(name, audience, medium, locale, 'blank');
    const row = name === 'F-TAB' && audience !== 'organizer' ? EXPECTED_BLANK['F-TAB öffentlich'] : EXPECTED_BLANK[name];
    for (const [key, expected] of Object.entries(row) as Array<[keyof typeof SIDES, Text]>) {
      expect(SIDES[key](v, cup)?.label).toBe(expected[locale]);
    }
  });

  it('@DR-005 Gegenbeispiel: in der Vorlage steht kein Teamname der Finalrunde, kein Stand, kein Zustand', async () => {
    for (const name of ['F-HF', 'F-NEU'] as const) {
      const { v } = await view(name, 'organizer', 'print', 'de', 'blank');
      const finals = v.matches.filter((m) => m.phase === 'final');
      expect(finals.flatMap((m) => [m.home.label, m.away.label])).not.toContain('FC Nord');
      expect(finals.flatMap((m) => [m.home.label, m.away.label])).not.toContain('TSV West');
      expect(v.matches.every((m) => m.score === undefined && m.status === 'scheduled')).toBe(true);
      expect(v.placement.state).toBe('open');
    }
  });

  it('@DR-005 Gruppenspiele der Vorlage zeigen die Teamnamen', async () => {
    const { v, cup } = await view('F-HF', 'organizer', 'print', 'de', 'blank');
    expect(v.byId.get(cup.tournament.matches[0].id)?.home.label).toBe('SC Ost');
  });
});

describe('@BM-014 F-NEU: nach „Neu besetzen“ keine Herkunftszeile, die Vorlage behält den Platz', () => {
  it.each(MATRIX)('@BM-014 %s·%s·%s', async (audience, medium, locale) => {
    const { v, cup } = await view('F-NEU', audience, medium, locale);
    expectSide(SIDES.hf2Home(v, cup), EXPECTED_PLAN['F-NEU'].hf2Home, locale);
    expect(SIDES.hf2Home(v, cup)?.origin).toEqual({ kind: 'groupRank', group: 'B', rank: 1 });
  });
});

describe('@DR-022 Spielbezeichnung in der Sprache der Ansicht (W7 „Halbfinale 1“)', () => {
  it.each(LOCALES)('@DR-022 %s', async (locale) => {
    const { v, cup } = await view('F-HF', 'organizer', 'print', locale);
    expect(v.byId.get(cup.tournament.matches[GAME.HF1].id)?.labelText).toBe(EXPECTED_LABEL.hf1[locale]);
    expect(v.byId.get(cup.tournament.matches[GAME.FINAL].id)?.labelText).toBe(EXPECTED_LABEL.final[locale]);
  });
});

describe('@TM-015 Gegenbeispiel: kein Anzeigetext enthält Rohschlüssel oder Kürzungen', () => {
  it('@TM-015 alle Varianten × Zielgruppen × Sprachen × Fassungen', async () => {
    for (const name of Object.keys(VARIANTS) as Array<keyof typeof VARIANTS>) {
      for (const [audience, medium, locale] of MATRIX) {
        for (const edition of ['plan', 'blank'] as const) {
          const { v } = await view(name, audience, medium, locale, edition);
          const texts = v.matches.flatMap((m) => [m.labelText, m.home.label, m.home.subLabel, m.away.label, m.away.subLabel]);
          for (const text of texts.filter((t): t is string => t !== undefined)) {
            for (const fragment of FORBIDDEN_FRAGMENTS) {
              expect(text).not.toContain(fragment);
            }
          }
        }
      }
    }
  });
});
