/**
 * @OB-075 Begriffe stehen ausgeschrieben, Kurzformen nur in Tabellenköpfen · @OB-076 zusammengesetzte Bezeichnungen folgen der Sprache.
 *
 * Teil 1: der Prüfer (scripts/check-terminology.cjs) an Fixtures mit Gegenbeispielen.
 * Teil 2: je Beispielzeile des Szenariogrundrisses @OB-075 (Deutsch und Englisch) die echten Texte der App.
 * Teil 3: @OB-076 (Englisch zeigt „Referee 2“, Paarungen „gegen“ / „vs“).
 * Teil 4: Gleichlauf Glossar ↔ Kurzform-Zuordnung der Komponente (SHORT_TERMS).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import i18next from 'i18next';
import checkTerminology from '../../../scripts/check-terminology.cjs';
import glossaryJson from '../glossary.json';
import { initRealGlobalI18n } from '../../test/realI18n';
import { SHORT_TERMS } from '../../components/ui/atoms/shortTerms';
import { matchLabelText } from '../../core/view/originText';
import { formatReferee } from '../../components/schedule/MatchCard/utils';
import { formatTableResult, type ResultFigures } from '../../components/schedule/matchResult';

// Echte Texte statt Passthrough-Mock (Muster: src/test/realDeI18n.ts)
vi.unmock('i18next');
vi.unmock('react-i18next');

const { runAllChecks } = checkTerminology;

/** Übersetzer wie `useTranslation('tournament').t` in der Ergebniszelle. */
const tTournament = (key: 'matchResult.overtimeShort' | 'matchResult.penaltyShort'): string => i18next.t(key, { ns: 'tournament' });

type Tree = { [key: string]: string | Tree };

// ---------------------------------------------------------------------------------------------------------------
// Teil 1: Prüfer an Fixtures
// ---------------------------------------------------------------------------------------------------------------

const GLOSSARY = {
  terms: {
    played: {
      de: 'Spiele', en: 'played', forbidden_de: ['Sp', 'Sp.'], forbidden_en: ['P'], reason: 'Fixture', i18nKey: 'tabelle.played', kuerzel: true,
      short: { de: 'Sp.', en: 'P', context: 'tabellenkopf', shortKey: 'tabellenkopf.played', usedBy: ['tournament:text.kopf'] },
    },
    versus: { de: 'gegen', en: 'vs', forbidden_de: ['vs', 'VS'], forbidden_en: [], reason: 'Fixture', i18nKey: 'tournament.versus', kuerzel: true },
    semifinal: { de: 'Halbfinale', en: 'semifinal', forbidden_de: ['HF'], forbidden_en: ['SF'], reason: 'Fixture', i18nKey: 'finalsTypes.semifinal', kuerzel: true },
  },
};

const SPORT_DE: Tree = { tabelle: { played: 'Spiele' }, tournament: { versus: 'gegen' }, finalsTypes: { semifinal: 'Halbfinale' } };
const SPORT_EN: Tree = { tabelle: { played: 'Played' }, tournament: { versus: 'vs' }, finalsTypes: { semifinal: 'Semifinal' } };
const SHORT_DE: Tree = { tabellenkopf: { played: 'Sp.' } };
const SHORT_EN: Tree = { tabellenkopf: { played: 'P' } };

interface Fixture { de: Record<string, Tree>; en: Record<string, Tree>; glossary?: unknown }

let root: string;
let counter = 0;
beforeAll(() => { root = mkdtempSync(join(tmpdir(), 'kurzformen-')); });
afterAll(() => { rmSync(root, { recursive: true, force: true }); });

/** Schreibt Sprachdateien und Glossar in ein Wegwerf-Verzeichnis und lässt den echten Prüfer darüber laufen. */
function pruefe(fixture: Fixture) {
  const dir = join(root, String(counter++));
  for (const lang of ['de', 'en'] as const) {
    mkdirSync(join(dir, 'locales', lang), { recursive: true });
    for (const [ns, tree] of Object.entries(fixture[lang])) {
      writeFileSync(join(dir, 'locales', lang, `${ns}.json`), JSON.stringify(tree));
    }
  }
  const glossaryPath = join(dir, 'glossary.json');
  writeFileSync(glossaryPath, JSON.stringify(fixture.glossary ?? GLOSSARY));
  const { results } = runAllChecks(join(dir, 'locales'), glossaryPath);
  const errors = (name: string) => results.find((r: { check: string }) => r.check === name)?.errors ?? [];
  return { synonyme: errors('Verbotene Synonyme'), kurzformen: errors('Kurzformen'), schluessel: errors('Glossar-Schlüssel'), alle: results.flatMap((r: { errors: string[] }) => r.errors) };
}

function sauber(): Fixture {
  return {
    de: { sport: SPORT_DE, short: SHORT_DE, tournament: { text: { ueberschrift: 'Halbfinale 1', paarung: 'A gegen B', kopf: '$t(short:tabellenkopf.played)' } } },
    en: { sport: SPORT_EN, short: SHORT_EN, tournament: { text: { ueberschrift: 'Semifinal 1', paarung: 'A vs B', kopf: '$t(short:tabellenkopf.played)' } } },
  };
}

describe('Prüfer für Kürzel und Kurzformen (@OB-075)', () => {
  it('Ausgangslage der Fixtures ist sauber (sonst wären die Gegenbeispiele wertlos)', () => {
    expect(pruefe(sauber()).alle).toEqual([]);
  });

  it('@OB-075 ein Kürzel im Text wird gemeldet (HF 1)', () => {
    const f = sauber();
    f.de.tournament = { text: { x: 'HF 1' } };
    const { synonyme } = pruefe(f);
    expect(synonyme).toHaveLength(1);
    expect(synonyme[0]).toContain('Kürzel "HF"');
    expect(synonyme[0]).toContain('tournament.json');
  });

  it('@OB-075 die Kurzform „Sp.“ im Tabellenkopf-Kontext (short-Namensraum) wird NICHT gemeldet', () => {
    const { alle } = pruefe(sauber());
    expect(alle).toEqual([]);
  });

  it('@OB-075 dieselbe Kurzform „Sp.“ in einem Fließtext wird gemeldet', () => {
    const f = sauber();
    f.de.tournament = { text: { x: 'Sp. gespielt: 3' } };
    expect(pruefe(f).synonyme).toHaveLength(1);
  });

  it('@OB-075 Kürzel sind groß-/kleinschreibungssensibel: „Hf“ oder „Chef“ sind keine Fundstelle', () => {
    const f = sauber();
    f.de.tournament = { text: { x: 'Hf Chef HFA' } };
    expect(pruefe(f).synonyme).toEqual([]);
  });

  it('@OB-075 Platzhalter sind keine Kürzel: {{Sp}} und $t(…) zählen nicht', () => {
    const f = sauber();
    f.de.tournament = { text: { x: '{{Sp}} von {{HF}} $t(sport:finalsTypes.semifinal)' } };
    expect(pruefe(f).synonyme).toEqual([]);
  });

  it('@OB-075 Mechanismus-Lücke: ein Verweis $t(short:…) an einer Stelle, die das Glossar nicht nennt (usedBy), wird gemeldet', () => {
    const f = sauber();
    f.de.tournament = { text: { kopf: '$t(short:tabellenkopf.played)', woanders: 'Spiele: $t(short:tabellenkopf.played)' } };
    const { kurzformen } = pruefe(f);
    expect(kurzformen).toHaveLength(1);
    expect(kurzformen[0]).toContain('tournament:text.woanders');
    expect(kurzformen[0]).toContain('nicht erlaubt');
  });

  it('@OB-075 Namensraum-Option: $t(tabellenkopf.points, {"ns": "short"}) schleust die Kurzform ohne „short:“ ein und wird gemeldet', () => {
    const f = sauber();
    f.de.tournament = { text: { kopf: '$t(short:tabellenkopf.played)', punkte: 'Ihr habt 3 $t(tabellenkopf.points, {"ns": "short"})' } };
    const { kurzformen } = pruefe(f);
    expect(kurzformen).toHaveLength(1);
    expect(kurzformen[0]).toContain('Namensraum-Option');
    expect(kurzformen[0]).toContain('tournament.json');
    // Einfache Anführungszeichen und Liste von Namensräumen zählen ebenso
    const g = sauber();
    g.de.tournament = { text: { kopf: '$t(short:tabellenkopf.played)', a: "$t(x, {'ns': 'short'})", b: '$t(x, {"ns": ["sport", "short"]})' } };
    expect(pruefe(g).kurzformen).toHaveLength(2);
  });

  it('@OB-075 Gegenbeispiel: die Namensraum-Option eines anderen Namensraums („ns“: „sport“) wird nicht gemeldet', () => {
    const f = sauber();
    f.de.tournament = { text: { kopf: '$t(short:tabellenkopf.played)', ok: '$t(zeit.minuteCount, {"ns": "sport", "count": 3})' } };
    expect(pruefe(f).kurzformen).toEqual([]);
  });

  it('@OB-075 ein Verweis auf eine Kurzform ganz ohne usedBy (Tabellenkopf-Kurzform im Fließtext) wird gemeldet', () => {
    const glossary = JSON.parse(JSON.stringify(GLOSSARY)) as typeof GLOSSARY;
    delete (glossary.terms.played.short as { usedBy?: string[] }).usedBy;
    expect(pruefe({ ...sauber(), glossary }).kurzformen).toHaveLength(2); // je Sprache einmal
  });

  it('@OB-075 verbotene deutsche Formen gelten auch in englischen Texten („HF 1“), außer die Form ist selbst englisch („vs“)', () => {
    const f = sauber();
    f.en.tournament = { text: { kopf: '$t(short:tabellenkopf.played)', x: 'HF 1', y: 'A vs B' } };
    const { synonyme } = pruefe(f);
    expect(synonyme).toHaveLength(1);
    expect(synonyme[0]).toContain('"HF"');
  });

  it('@OB-076 forbidden_de gilt nur auf Deutsch: „vs“ ist im Englischen erlaubt, „gegen“ im Deutschen', () => {
    const f = sauber();
    f.en.tournament = { text: { x: 'A vs B' } };
    expect(pruefe(f).synonyme).toEqual([]);
    const g = sauber();
    g.de.tournament = { text: { x: 'A vs B' } };
    expect(pruefe(g).synonyme).toHaveLength(1);
  });

  it('@OB-075 forbidden_en gilt nur auf Englisch: „SF“ im englischen Text wird gemeldet, im deutschen nicht', () => {
    const f = sauber();
    f.en.tournament = { text: { x: 'SF 1' } };
    expect(pruefe(f).synonyme).toHaveLength(1);
    const g = sauber();
    g.de.tournament = { text: { x: 'SF 1' } };
    expect(pruefe(g).synonyme).toEqual([]);
  });

  it('@OB-075 eine Kurzform, die vom Glossar abweicht, wird gemeldet', () => {
    const f = sauber();
    f.de.short = { tabellenkopf: { played: 'Spl.' } };
    const { kurzformen } = pruefe(f);
    expect(kurzformen).toHaveLength(1);
    expect(kurzformen[0]).toContain('erwartet "Sp."');
  });

  it('@OB-075 eine Kurzform ohne Glossar-Eintrag wird gemeldet (es gibt nur Kurzformen, die das Glossar erlaubt)', () => {
    const f = sauber();
    f.de.short = { tabellenkopf: { played: 'Sp.', dazu: 'Zz.' } };
    f.en.short = { tabellenkopf: { played: 'P', dazu: 'Zz.' } };
    const { kurzformen } = pruefe(f);
    expect(kurzformen).toHaveLength(2);
    expect(kurzformen[0]).toContain('keinen Glossar-Eintrag');
  });

  it('@OB-075 fehlt die Kurzform des Glossars in short.json, wird das gemeldet', () => {
    const f = sauber();
    f.en.short = { tabellenkopf: { andere: 'X' } };
    expect(pruefe(f).kurzformen.length).toBeGreaterThan(0);
  });

  it('@OB-075 ein unbekannter Ort (short.context) wird gemeldet', () => {
    const glossary = JSON.parse(JSON.stringify(GLOSSARY)) as typeof GLOSSARY;
    (glossary.terms.played.short as { context: string }).context = 'ueberall';
    expect(pruefe({ ...sauber(), glossary }).kurzformen.some((e: string) => e.includes('unbekannt'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Teil 2/3: die echten Texte der App
// ---------------------------------------------------------------------------------------------------------------

/** Alle Texte aller Sprachdateien außerhalb des Namensraums „short“ (dort dürfen Kurzformen stehen). */
async function alleTexte(lang: 'de' | 'en'): Promise<string[]> {
  const out: string[] = [];
  const walk = (node: unknown) => {
    if (typeof node === 'string') { out.push(node); } else if (node !== null && typeof node === 'object') { Object.values(node).forEach(walk); }
  };
  for (const ns of ['common', 'auth', 'dashboard', 'wizard', 'tournament', 'cockpit', 'monitor', 'settings', 'admin', 'sport', 'publicView', 'helpers']) {
    walk((await import(`../locales/${lang}/${ns}.json`)).default);
  }
  return out;
}

const KUERZEL = {
  de: ['HF', 'VF', 'AF', 'SR', 'Gr.', 'Gr', 'Grp', 'P3', 'Pl.', 'Pl', 'Sp.', 'Sp', 'Pkt.', 'Pkt', 'Diff.', 'Diff', 'Nr.', 'Nr', 'Min.', 'Min', 'n. V.', 'i. E.', 'vs', 'VS', 'KO', 'BFV', 'Unent.', 'Niederl.'],
  en: ['SF', 'QF', 'R16', 'Ref', 'SR', 'Gr.', 'Grp', 'P3', 'Pos', 'GD', 'Diff', 'Pts', 'No.', 'min', 'a.e.t.', 'pens', 'KO', 'BFV'],
} as const;

const wort = (k: string) => new RegExp(`(?<![A-Za-zÀ-ÖØ-öø-ÿ0-9_])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-zÀ-ÖØ-öø-ÿ0-9_])`, 'u');

describe('@OB-075 Beispielzeilen des Szenariogrundrisses (echte Texte)', () => {
  beforeAll(async () => { await initRealGlobalI18n('de'); });
  beforeEach(async () => { await initRealGlobalI18n('de'); });

  it.each([
    ['Halbfinale', 'de', '1. Halbfinale', 'Halbfinale 1', 'HF 1'],
    ['Halbfinale', 'en', '1. Halbfinale', 'Semifinal 1', 'SF 1'],
  ] as const)('@OB-075 %s (%s): „%s“ lautet „%s“, nie „%s“', (_begriff, sprache, label, erwartet, kuerzel) => {
    expect(matchLabelText(label, sprache)).toBe(erwartet);
    expect(matchLabelText(label, sprache)).not.toContain(kuerzel.split(' ')[0]);
  });

  it('@OB-075 Schiedsrichter (Deutsch): „Schiedsrichter 2“, nie „SR 2“', () => {
    expect(formatReferee(2)).toBe('Schiedsrichter 2');
  });

  it('@OB-075 Schiedsrichter (Englisch): „Referee 2“, nie „Ref 2“ oder „SR 2“', async () => {
    await initRealGlobalI18n('en');
    expect(formatReferee(2)).toBe('Referee 2');
  });

  it('@OB-075 Gruppe: „Gruppe A“ auf Deutsch, „Group A“ auf Englisch, nie „Gr. A“', async () => {
    expect(i18next.t('tournament:matchCard.groupPrefix', { group: 'A' })).toBe('Gruppe A');
    expect(i18next.t('tournament:matchCard.groupShort', { group: 'A' })).toBe('Gruppe A');
    await initRealGlobalI18n('en');
    expect(i18next.t('tournament:matchCard.groupPrefix', { group: 'A' })).toBe('Group A');
  });

  it('@OB-075 Spiel um Platz 3: ausgeschrieben, die Kennung „P3“ steht in keinem Text einer Sprachdatei', async () => {
    expect(i18next.t('sport:finalsTypes.thirdPlace')).toBe('Spiel um Platz 3');
    expect(matchLabelText('Spiel um Platz 3', 'de')).toBe('Spiel um Platz 3');
    for (const lang of ['de', 'en'] as const) {
      expect((await alleTexte(lang)).filter((text) => wort('P3').test(text))).toEqual([]);
    }
    await initRealGlobalI18n('en');
    expect(i18next.t('sport:finalsTypes.thirdPlace')).toBe('Third-place match');
  });

  it('@OB-075 Platz: im Text „Platz“ / „Position“, im Tabellenkopf nur „#“ (beide Sprachen); „Pl.“ und „Pos“ gibt es nicht', async () => {
    expect(i18next.t('sport:tabelle.rank')).toBe('Platz');
    expect(i18next.t('short:tabellenkopf.rank')).toBe('#');
    await initRealGlobalI18n('en');
    expect(i18next.t('sport:tabelle.rank')).toBe('Position');
    expect(i18next.t('short:tabellenkopf.rank')).toBe('#');
  });

  it('@OB-075 Tordifferenz: im Text ausgeschrieben, Kurzform „Diff.“ nur im Tabellenkopf', async () => {
    expect(i18next.t('dashboard:card.placementAbbreviations.goalDifference')).toBe('Tordifferenz');
    expect(i18next.t('short:tabellenkopf.goalDifference')).toBe('Diff.');
    expect(i18next.t('sport:tabelle.goalDifference')).toBe('Tordifferenz');
  });

  it('@OB-075 Punkte (Englisch): „Points“ im Text, Kurzform „Pts“ nur im Tabellenkopf', async () => {
    await initRealGlobalI18n('en');
    expect(i18next.t('dashboard:card.placementAbbreviations.points')).toBe('Points');
    expect(i18next.t('short:tabellenkopf.points')).toBe('Pts');
    expect(i18next.t('sport:tabelle.points')).toBe('Points');
  });

  it('@OB-075 Strafstoßschießen (Deutsch): im Text „nach Strafstoßschießen“, nie „i. E.“; nur in der Ergebniszelle „2:2 (4:3 i. E.)“', () => {
    expect(i18next.t('sport:phases.afterPenalties')).toBe('nach Strafstoßschießen');
    expect(i18next.t('tournament:matchResult.finishedPenalty')).toBe('beendet nach Strafstoßschießen');
    const figures: ResultFigures = { goalsA: 2, goalsB: 2, penaltyA: 4, penaltyB: 3, winner: 'a', decision: 'penalty' };
    expect(formatTableResult(figures, tTournament)).toBe('2:2 (4:3 i. E.)');
  });

  it('@OB-075 Strafstoßschießen (Englisch): „on penalties“, nie „pens“', async () => {
    await initRealGlobalI18n('en');
    expect(i18next.t('sport:phases.afterPenalties')).toBe('on penalties');
    expect(i18next.t('tournament:matchResult.finishedPenalty')).toBe('ended on penalties');
  });

  it('@OB-075 Verlängerung: ausgeschrieben im Text, „n. V.“ / „a.e.t.“ nur in der Ergebniszelle', async () => {
    expect(i18next.t('sport:phases.afterExtraTime')).toBe('nach Verlängerung');
    expect(i18next.t('tournament:matchResult.finishedOvertime')).toBe('beendet nach Verlängerung');
    const figures: ResultFigures = { goalsA: 3, goalsB: 2, winner: 'a', decision: 'overtime' };
    expect(formatTableResult(figures, tTournament)).toBe('3:2 n. V.');
    await initRealGlobalI18n('en');
    expect(formatTableResult(figures, tTournament)).toBe('3:2 a.e.t.');
  });

  it.each(['de', 'en'] as const)('@OB-075 Gegenbeispiel: in keinem Text (%s) steht ein Kürzel der Liste, Kurzformen stehen nur im Namensraum „short“', async (sprache) => {
    const treffer = (await alleTexte(sprache)).flatMap((text) => {
      const bereinigt = text.replace(/\$t\([^)]*\)/g, '').replace(/\{\{[^}]*\}\}/g, '');
      return KUERZEL[sprache].filter((k) => wort(k).test(bereinigt)).map((k) => `${k}: ${text}`);
    });
    expect(treffer).toEqual([]);
  });

  it('@OB-075 Gegenbeispiel Tabellenkopf: die Kurzformen gibt es, mit ausgeschriebenem Begriff als Hinweis (SHORT_TERMS)', async () => {
    const erwartet = { de: { played: 'Sp.', won: 'S', drawn: 'U', lost: 'N', goalDifference: 'Diff.', points: 'Pkt.', number: 'Nr.', rank: '#' }, en: { played: 'P', won: 'W', drawn: 'D', lost: 'L', goalDifference: 'GD', points: 'Pts', number: 'No.', rank: '#' } } as const;
    for (const lang of ['de', 'en'] as const) {
      await initRealGlobalI18n(lang);
      for (const [term, kurz] of Object.entries(erwartet[lang])) {
        const keys = SHORT_TERMS[term as keyof typeof SHORT_TERMS];
        expect(i18next.t(keys.short)).toBe(kurz);
        const lang_ = i18next.t(keys.long);
        expect(lang_.length).toBeGreaterThan(kurz.length - 1);
        expect(lang_).not.toBe(kurz);
      }
    }
  });
});

describe('@OB-076 zusammengesetzte Bezeichnungen folgen der Sprache', () => {
  beforeEach(async () => { await initRealGlobalI18n('de'); });

  it('@OB-076 Englisch: Spiel 4 hat Schiedsrichter 2, im Spielplan steht „Referee 2“ (nicht „SR 2“, nicht „Schiedsrichter 2“)', async () => {
    await initRealGlobalI18n('en');
    for (const text of [
      formatReferee(2),
      i18next.t('tournament:matchCard.refereeSR', { referee: 2 }),
      i18next.t('tournament:groupStage.refereeLabel', { number: 2 }),
      i18next.t('tournament:refereeOptions.numbered', { number: 2 }),
      i18next.t('wizard:referees.organizerSettings.nameLabel', { number: 2 }),
    ]) {
      expect(text).toContain('Referee');
      expect(text).not.toMatch(/\bSR\b|Schiedsrichter|\bRef\b/);
    }
    expect(i18next.t('tournament:groupStage.refereeLabel', { number: 2 })).toBe('Referee 2');
  });

  it('@OB-076 Deutsch: „Schiedsrichter 2“', () => {
    expect(i18next.t('tournament:groupStage.refereeLabel', { number: 2 })).toBe('Schiedsrichter 2');
    expect(i18next.t('tournament:matchCard.refereeSR', { referee: 2 })).toBe('Schiedsrichter 2');
  });

  it('@OB-076 die Paarung lautet auf Deutsch „DJK Kammer gegen TSV Petting“, auf Englisch „DJK Kammer vs TSV Petting“', async () => {
    const paarung = () => `DJK Kammer ${i18next.t('sport:tournament.versus')} TSV Petting`;
    expect(paarung()).toBe('DJK Kammer gegen TSV Petting');
    await initRealGlobalI18n('en');
    expect(paarung()).toBe('DJK Kammer vs TSV Petting');
    expect(i18next.t('tournament:schedule.runningMatch.message', { teamA: 'DJK Kammer', teamB: 'TSV Petting', scoreA: 1, scoreB: 0 })).toContain('DJK Kammer vs TSV Petting');
    await initRealGlobalI18n('de');
    expect(i18next.t('tournament:schedule.runningMatch.message', { teamA: 'DJK Kammer', teamB: 'TSV Petting', scoreA: 1, scoreB: 0 })).toContain('DJK Kammer gegen TSV Petting');
  });

  it('@OB-076 Minuten: in beiden Sprachen mit Zählform („1 Minute“, „5 Minuten“ / „1 minute“, „5 minutes“)', async () => {
    expect(i18next.t('sport:zeit.minuteCount', { count: 1 })).toBe('1 Minute');
    expect(i18next.t('sport:zeit.minuteCount', { count: 5 })).toBe('5 Minuten');
    expect(i18next.t('cockpit:strafen.dauer', { minuten: 2 })).toBe('Zeitstrafe 2 Minuten');
    await initRealGlobalI18n('en');
    expect(i18next.t('sport:zeit.minuteCount', { count: 1 })).toBe('1 minute');
    expect(i18next.t('cockpit:strafen.dauer', { minuten: 2 })).toBe('Time penalty 2 minutes');
  });

  it('@OB-075 Minuten haben keine Kurzform, auch nicht am Monitor und an der Tafel: „~5 Minuten“, „überfällig 7 Minuten“, „1 Minute“', async () => {
    expect(i18next.t('monitor:nextMatch.title', { minutes: 5 })).toBe('Nächstes Spiel in ~5 Minuten');
    expect(i18next.t('cockpit:tafel.vor.ueberfaellig', { minuten: 7 })).toBe('überfällig 7 Minuten');
    expect(i18next.t('cockpit:spalte.strafeDauer', { minuten: 1 })).toBe('1 Minute');
    expect(i18next.t('short:uhr.minutes', { defaultValue: '' })).toBe('');
    await initRealGlobalI18n('en');
    expect(i18next.t('monitor:nextMatch.title', { minutes: 5 })).toBe('Next match in ~5 minutes');
    expect(i18next.t('cockpit:tafel.vor.ueberfaellig', { minuten: 7 })).toBe('overdue 7 minutes');
  });

  it('@OB-075 BFV wird ausgeschrieben, in beiden Sprachen', async () => {
    expect(i18next.t('wizard:placementLogic.bfvHelp')).toContain('Bayerischen Fußball-Verbands');
    expect(i18next.t('wizard:placementLogic.bfvHelp')).not.toMatch(/\bBFV\b/);
    await initRealGlobalI18n('en');
    expect(i18next.t('wizard:placementLogic.bfvHelp')).toContain('Bavarian Football Association');
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Teil 4: Gleichlauf
// ---------------------------------------------------------------------------------------------------------------

describe('Gleichlauf Glossar ↔ Komponente ShortLabel', () => {
  it('jede Kurzform des Glossars hat einen Eintrag in SHORT_TERMS mit gleichem Schlüssel und ausgeschriebenem Begriff', () => {
    const mitKurzform = Object.values(glossaryJson.terms as Record<string, { i18nKey: string; short?: { shortKey: string } }>).filter((t) => t.short !== undefined);
    const bekannt = Object.values(SHORT_TERMS).map((t) => `${t.short}|${t.long}`).sort();
    const aus_glossar = mitKurzform.map((t) => `short:${t.short?.shortKey ?? ''}|sport:${t.i18nKey}`).sort();
    expect(bekannt).toEqual(aus_glossar);
  });
});
