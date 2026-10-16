/**
 * A-03 (MVP-Bauplan, Spur A) – die eine Anzeige-Funktion für Spielseiten.
 * @TM-015 „Ein unbesetzter Platz zeigt seine Herkunft“ (Kern-Teil: die Funktion, die jede Ansicht ruft).
 *
 * Diese Datei ersetzt den globalen i18next-Mock (src/test/setup.ts, gibt Schlüssel zurück) durch eine ECHTE
 * Instanz mit den DE- und EN-Texten aus tournament.json – damit prüft sie auch den gerenderten Wortlaut.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  describeSlot,
  describeMatchLabel,
  describeAwaiting,
  awaitingLabel,
  matchLabelText,
  slotLabel,
  teamDisplayName,
  type SlotKey,
} from '../slotLabel';
import { teamSlot, pendingSlot } from '../matchSlot';
import { testUuid } from '../../../test/testIds';
import de from '../../../i18n/locales/de/tournament.json';
import en from '../../../i18n/locales/en/tournament.json';

vi.mock('i18next', async () => {
  const actual = await vi.importActual<typeof import('i18next')>('i18next');
  const de = (await import('../../../i18n/locales/de/tournament.json')).default;
  const en = (await import('../../../i18n/locales/en/tournament.json')).default;
  const instance = actual.default.createInstance();
  await instance.init({
    lng: 'de',
    fallbackLng: false,
    resources: { de: { tournament: de }, en: { tournament: en } },
    interpolation: { escapeValue: false },
  });
  return { default: instance };
});

const NORD = testUuid(1);
const UFER = testUuid(2);
const SEMI1 = testUuid(101);
const SEMI2 = testUuid(102);

const teams = [
  { id: NORD, name: 'FC Nord' },
  { id: UFER, name: 'VfB Ufer' },
];
const matches = [
  { id: SEMI1, label: '1. Halbfinale', matchNumber: 7 },
  { id: SEMI2, matchNumber: 8 },
];
const ctx = { teams, matches };

describe('@TM-015 describeSlot – besetzte Seite', () => {
  it('@TM-015 team zeigt den Namen des Teams mit dieser ID', () => {
    expect(describeSlot(teamSlot(NORD), ctx)).toEqual({ text: 'FC Nord' });
  });

  it('@TM-015 Umbenennen: derselbe Slot zeigt den neuen Namen', () => {
    const renamed = [{ id: NORD, name: 'FC Nordlicht' }, teams[1]];
    expect(describeSlot(teamSlot(NORD), { ...ctx, teams: renamed })).toEqual({ text: 'FC Nordlicht' });
  });

  it('@TM-033 Gegenbeispiel: unbekannte Team-ID zeigt slot.unknown, nie einen Namen aus anderer Quelle', () => {
    // Das Team „FC Nord“ existiert – aber unter anderer ID. Ein Namens-Lookup würde es fälschlich finden.
    const fremd = [{ id: testUuid(9), name: NORD }];
    expect(describeSlot(teamSlot(NORD), { ...ctx, teams: fremd })).toEqual({
      key: 'tournament:slot.unknown',
      vars: {},
    });
    expect(describeSlot(teamSlot(testUuid(77)), ctx)).toEqual({ key: 'tournament:slot.unknown', vars: {} });
  });

  it('@TM-033 Gegenbeispiel: Team, dessen NAME wie eine fremde Team-ID aussieht, wird nicht über den Namen gefunden', () => {
    const verdreht = [{ id: testUuid(3), name: UFER }, { id: UFER, name: 'VfB Ufer' }];
    expect(describeSlot(teamSlot(UFER), { ...ctx, teams: verdreht })).toEqual({ text: 'VfB Ufer' });
  });

  it('@TM-033 fehlender Slot (Altdaten ohne slotA) zeigt slot.unknown statt eines Platzhaltertexts', () => {
    expect(describeSlot(undefined, ctx)).toEqual({ key: 'tournament:slot.unknown', vars: {} });
    expect(slotLabel(undefined, ctx)).toBe('?');
  });
});

describe('@TM-015 describeSlot – offene Seite zeigt ihre Herkunft', () => {
  it('@TM-015 groupRank mit eigenem Gruppennamen', () => {
    const slot = pendingSlot({ kind: 'groupRank', group: 'A', rank: 2 });
    expect(describeSlot(slot, { ...ctx, groups: [{ id: 'A', customName: 'Löwen' }] })).toEqual({
      key: 'tournament:slot.groupRank',
      vars: { rankWord: { key: 'tournament:slot.rank2', vars: {} }, group: 'Löwen' },
    });
  });

  it('@TM-015 groupRank ohne eigenen Namen: Standardname über Schlüssel (DE/EN)', () => {
    const slot = pendingSlot({ kind: 'groupRank', group: 'B', rank: 1 });
    expect(describeSlot(slot, ctx)).toEqual({
      key: 'tournament:slot.groupRank',
      vars: {
        rankWord: { key: 'tournament:slot.rank1', vars: {} },
        group: { key: 'tournament:slot.groupDefault', vars: { id: 'B' } },
      },
    });
  });

  it('@TM-015 Rang ohne Ordinalwort (5) nutzt den Rückfall-Schlüssel', () => {
    const slot = pendingSlot({ kind: 'groupRank', group: 'A', rank: 5 });
    expect(describeSlot(slot, ctx)).toMatchObject({ key: 'tournament:slot.groupRankFallback', vars: { rank: 5 } });
  });

  it('@TM-015 matchResult: Sieger des Spiels mit Bezeichnung', () => {
    const slot = pendingSlot({ kind: 'matchResult', matchId: SEMI1, role: 'winner' });
    expect(describeSlot(slot, ctx)).toEqual({
      key: 'tournament:slot.winnerOf',
      vars: { match: { key: 'tournament:slot.playoffSemifinal', vars: { n: 1 } } },
    });
  });

  it('@TM-015 matchResult ohne Bezeichnung: Spielnummer', () => {
    const slot = pendingSlot({ kind: 'matchResult', matchId: SEMI2, role: 'winner' });
    expect(describeSlot(slot, ctx)).toEqual({
      key: 'tournament:slot.winnerOf',
      vars: { match: { key: 'tournament:slot.matchNumber', vars: { number: 8 } } },
    });
    expect(slotLabel(slot, ctx)).toBe('Sieger Spiel 8');
  });

  it('@TM-015 Gegenbeispiel: Verlierer zeigt loserOf, nicht winnerOf', () => {
    const slot = pendingSlot({ kind: 'matchResult', matchId: SEMI1, role: 'loser' });
    const result = describeSlot(slot, ctx);
    expect(result).toEqual({
      key: 'tournament:slot.loserOf',
      vars: { match: { key: 'tournament:slot.playoffSemifinal', vars: { n: 1 } } },
    });
  });

  it('@TM-015 Gegenbeispiel: Verweis auf ein nicht vorhandenes Spiel zeigt slot.unknown', () => {
    const slot = pendingSlot({ kind: 'matchResult', matchId: testUuid(500), role: 'winner' });
    expect(describeSlot(slot, ctx)).toEqual({ key: 'tournament:slot.unknown', vars: {} });
  });

  it('@TM-015 Gegenbeispiel: Spiel ohne Bezeichnung und ohne Nummer zeigt slot.unknown, keine ID', () => {
    const slot = pendingSlot({ kind: 'matchResult', matchId: SEMI1, role: 'winner' });
    expect(describeSlot(slot, { ...ctx, matches: [{ id: SEMI1 }] })).toEqual({
      key: 'tournament:slot.unknown',
      vars: {},
    });
  });

  it('@TM-015 Gegenbeispiel: eine Bezeichnung als matchId findet kein Spiel', () => {
    // Source.matchId ist per Schema eine UUID; hier bewusst am Schema vorbei, um den Lookup zu prüfen.
    const slot = { kind: 'pending', source: { kind: 'matchResult', matchId: '1. Halbfinale', role: 'winner' } } as const;
    expect(describeSlot(slot as never, ctx)).toEqual({ key: 'tournament:slot.unknown', vars: {} });
  });

  it('@TM-034 aufgelöste Seite zeigt den Teamnamen, nicht die Herkunft', () => {
    const slot = teamSlot(NORD, { kind: 'groupRank', group: 'A', rank: 1 });
    expect(slotLabel(slot, ctx)).toBe('FC Nord');
  });
});

describe('teamDisplayName', () => {
  it('@TM-015 liefert den Namen zur Team-ID', () => {
    expect(teamDisplayName(teams, UFER)).toBe('VfB Ufer');
  });

  it('@TM-033 Gegenbeispiel: ein Teamname als „ID“ findet nichts → slot.unknown', () => {
    expect(teamDisplayName(teams, 'FC Nord')).toBe('?');
  });
});

describe('slot.* Texte in DE und EN', () => {
  const keys: SlotKey[] = [
    'tournament:slot.groupRank',
    'tournament:slot.groupRankFallback',
    'tournament:slot.groupDefault',
    'tournament:slot.rank1',
    'tournament:slot.rank2',
    'tournament:slot.rank3',
    'tournament:slot.rank4',
    'tournament:slot.winnerOf',
    'tournament:slot.loserOf',
    'tournament:slot.matchNumber',
    'tournament:slot.unknown',
    'tournament:slot.playoffFinal',
    'tournament:slot.playoffSemifinal',
    'tournament:slot.playoffQuarterfinal',
    'tournament:slot.playoffRoundOf16',
    'tournament:slot.playoffPlace',
    'tournament:slot.awaitGroup',
    'tournament:slot.awaitMatch',
  ];

  it.each(keys)('@TM-015 %s existiert in beiden Sprachen mit denselben Platzhaltern', (key) => {
    const name = key.replace('tournament:slot.', '') as keyof typeof de.slot;
    const placeholders = (text: string) => (text.match(/\{\{\w+\}\}/g) ?? []).sort();
    expect(de.slot[name]).toBeTruthy();
    expect(en.slot[name]).toBeTruthy();
    expect(placeholders(en.slot[name])).toEqual(placeholders(de.slot[name]));
  });
});

describe('@TM-015 gerenderter Wortlaut (echte i18n-Instanz, DE und EN)', () => {
  const groups = [{ id: 'A', customName: 'Löwen' }];
  const hf1 = pendingSlot({ kind: 'groupRank', group: 'A', rank: 1 });
  const hf2 = pendingSlot({ kind: 'groupRank', group: 'B', rank: 2 });

  it.each([
    ['de', 'Erster Gruppe A', 'Zweiter Gruppe B'],
    ['en', '1st Group A', '2nd Group B'],
  ] as const)('@TM-015 Halbfinale 1 zeigt in %s „%s gegen %s“', (locale, home, away) => {
    expect(slotLabel(hf1, { ...ctx, locale })).toBe(home);
    expect(slotLabel(hf2, { ...ctx, locale })).toBe(away);
  });

  it.each([
    ['de', 'Dritter Gruppe C', 'Vierter Gruppe D', '7. Gruppe A'],
    ['en', '3rd Group C', '4th Group D', '#7 Group A'],
  ] as const)('@TM-015 weitere Ränge in %s', (locale, third, fourth, fallback) => {
    expect(slotLabel(pendingSlot({ kind: 'groupRank', group: 'C', rank: 3 }), { ...ctx, locale })).toBe(third);
    expect(slotLabel(pendingSlot({ kind: 'groupRank', group: 'D', rank: 4 }), { ...ctx, locale })).toBe(fourth);
    expect(slotLabel(pendingSlot({ kind: 'groupRank', group: 'A', rank: 7 }), { ...ctx, locale })).toBe(fallback);
  });

  it('@TM-015 eigener Gruppenname ersetzt „Gruppe A“', () => {
    expect(slotLabel(hf1, { ...ctx, groups, locale: 'de' })).toBe('Erster Löwen');
  });

  it.each([
    ['de', 'Sieger Halbfinale 1', 'Verlierer Spiel 8'],
    ['en', 'Winner of Semifinal 1', 'Loser of Match 8'],
  ] as const)('@TM-015 Sieger/Verlierer eines Spiels in %s (inkl. verschachteltem Spielnummer-Text)', (locale, byLabel, byNumber) => {
    expect(slotLabel(pendingSlot({ kind: 'matchResult', matchId: SEMI1, role: 'winner' }), { ...ctx, locale })).toBe(byLabel);
    expect(slotLabel(pendingSlot({ kind: 'matchResult', matchId: SEMI2, role: 'loser' }), { ...ctx, locale })).toBe(byNumber);
  });

  it('@TM-033 unbekannt zeigt „?“ in beiden Sprachen', () => {
    expect(slotLabel(undefined, { ...ctx, locale: 'en' })).toBe('?');
  });
});

describe('@TM-015 Playoff-Bezeichnungen als Schlüssel (K1-Rest): EN zeigt keine deutschen Teile', () => {
  const hf1 = pendingSlot({ kind: 'matchResult', matchId: SEMI1, role: 'winner' });

  it.each([
    ['de', 'Sieger Halbfinale 1'],
    ['en', 'Winner of Semifinal 1'],
  ] as const)('@TM-015 Sieger des 1. Halbfinales in %s: „%s“', (locale, expected) => {
    expect(slotLabel(hf1, { ...ctx, locale })).toBe(expected);
  });

  it.each([
    ['Finale', 'de', 'Finale'],
    ['Finale', 'en', 'Final'],
    ['2. Halbfinale', 'en', 'Semifinal 2'],
    ['Viertelfinale 3', 'en', 'Quarterfinal 3'],
    ['Achtelfinale 8', 'en', 'Round of 16, match 8'],
    ['Spiel um Platz 5', 'en', 'Match for place 5'],
    ['Spiel um Platz 5', 'de', 'Spiel um Platz 5'],
  ] as const)('@TM-015 matchLabelText(%s, %s) = %s', (label, locale, expected) => {
    expect(matchLabelText(label, locale)).toBe(expected);
  });

  it('@TM-015 Gegenbeispiel: eine eigene Bezeichnung der Leitung bleibt unverändert, auch in EN', () => {
    expect(matchLabelText('Traumfinale', 'en')).toBe('Traumfinale');
    expect(describeMatchLabel('Halbfinale')).toEqual({ text: 'Halbfinale' });
  });

  it('@TM-015 Gegenbeispiel: EN-Text der Herkunft enthält kein „Sieger“ und kein „Halbfinale“', () => {
    const text = slotLabel(hf1, { ...ctx, locale: 'en' });
    expect(text).not.toMatch(/Sieger|Halbfinale/);
  });
});

describe('@TM-033 Wartegrund einer offenen Seite', () => {
  const zweiterB = pendingSlot({ kind: 'groupRank', group: 'B', rank: 2 });
  const siegerHf1 = pendingSlot({ kind: 'matchResult', matchId: SEMI1, role: 'winner' });

  it.each([
    ['de', 'Abschluss von Gruppe B'],
    ['en', 'Completion of Group B'],
  ] as const)('@TM-033 offene Gruppenseite nennt den Abschluss der Gruppe in %s: „%s“', (locale, expected) => {
    expect(awaitingLabel(zweiterB, { ...ctx, locale })).toBe(expected);
  });

  it('@TM-033 eigener Gruppenname wird im Wartegrund genannt', () => {
    expect(awaitingLabel(zweiterB, { ...ctx, groups: [{ id: 'B', customName: 'Löwen' }] })).toBe('Abschluss von Löwen');
  });

  it.each([
    ['de', 'Abschluss von Halbfinale 1'],
    ['en', 'Completion of Semifinal 1'],
  ] as const)('@TM-033 offene Seite aus einem Spielergebnis nennt den Abschluss des Spiels in %s', (locale, expected) => {
    expect(awaitingLabel(siegerHf1, { ...ctx, locale })).toBe(expected);
  });

  it('@TM-033 Gegenbeispiel: eine besetzte Seite (auch aufgelöst) hat keinen Wartegrund', () => {
    expect(awaitingLabel(teamSlot(NORD), ctx)).toBeUndefined();
    expect(describeAwaiting(teamSlot(NORD, { kind: 'groupRank', group: 'A', rank: 1 }), ctx)).toBeUndefined();
    expect(describeAwaiting(undefined, ctx)).toBeUndefined();
  });

  it('@TM-033 Gegenbeispiel: unbekanntes Vorgängerspiel nennt „?“ statt einer ID', () => {
    const slot = pendingSlot({ kind: 'matchResult', matchId: testUuid(500), role: 'winner' });
    expect(awaitingLabel(slot, ctx)).toBe('?');
  });
});
