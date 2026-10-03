/**
 * A-03 (MVP-Bauplan, Spur A) – die eine Anzeige-Funktion für Spielseiten.
 * @TM-015 „Ein unbesetzter Platz zeigt seine Herkunft“ (Kern-Teil: die Funktion, die jede Ansicht ruft).
 *
 * `i18next` liefert im Test die Schlüssel zurück (src/test/setup.ts) – die Inhalte prüft `describeSlot`;
 * dass die Schlüssel in DE und EN existieren, prüft der letzte Block.
 */
import { describe, it, expect } from 'vitest';
import { describeSlot, slotLabel, teamDisplayName, type SlotKey } from '../slotLabel';
import { teamSlot, pendingSlot } from '../matchSlot';
import { testUuid } from '../../../test/testIds';
import de from '../../../i18n/locales/de/tournament.json';
import en from '../../../i18n/locales/en/tournament.json';

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
    expect(slotLabel(undefined, ctx)).toBe('tournament:slot.unknown');
  });
});

describe('@TM-015 describeSlot – offene Seite zeigt ihre Herkunft', () => {
  it('@TM-015 groupRank mit eigenem Gruppennamen', () => {
    const slot = pendingSlot({ kind: 'groupRank', group: 'A', rank: 2 });
    expect(describeSlot(slot, { ...ctx, groups: [{ id: 'A', customName: 'Löwen' }] })).toEqual({
      key: 'tournament:slot.groupRank',
      vars: { group: 'Löwen', rank: 2 },
    });
  });

  it('@TM-015 groupRank ohne eigenen Namen: „Gruppe A“', () => {
    const slot = pendingSlot({ kind: 'groupRank', group: 'B', rank: 1 });
    expect(describeSlot(slot, ctx)).toEqual({
      key: 'tournament:slot.groupRank',
      vars: { group: 'Gruppe B', rank: 1 },
    });
  });

  it('@TM-015 matchResult: Sieger des Spiels mit Bezeichnung', () => {
    const slot = pendingSlot({ kind: 'matchResult', matchId: SEMI1, role: 'winner' });
    expect(describeSlot(slot, ctx)).toEqual({
      key: 'tournament:slot.winnerOf',
      vars: { match: '1. Halbfinale' },
    });
  });

  it('@TM-015 matchResult ohne Bezeichnung: Spielnummer', () => {
    const slot = pendingSlot({ kind: 'matchResult', matchId: SEMI2, role: 'winner' });
    expect(describeSlot(slot, ctx)).toEqual({
      key: 'tournament:slot.winnerOf',
      vars: { match: { key: 'tournament:slot.matchNumber', vars: { number: 8 } } },
    });
    expect(slotLabel(slot, ctx)).toBe('tournament:slot.winnerOf');
  });

  it('@TM-015 Gegenbeispiel: Verlierer zeigt loserOf, nicht winnerOf', () => {
    const slot = pendingSlot({ kind: 'matchResult', matchId: SEMI1, role: 'loser' });
    const result = describeSlot(slot, ctx);
    expect(result).toEqual({ key: 'tournament:slot.loserOf', vars: { match: '1. Halbfinale' } });
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
    expect(teamDisplayName(teams, 'FC Nord')).toBe('tournament:slot.unknown');
  });
});

describe('slot.* Texte in DE und EN', () => {
  const keys: SlotKey[] = [
    'tournament:slot.groupRank',
    'tournament:slot.winnerOf',
    'tournament:slot.loserOf',
    'tournament:slot.matchNumber',
    'tournament:slot.unknown',
  ];

  it.each(keys)('@TM-015 %s existiert in beiden Sprachen mit denselben Platzhaltern', (key) => {
    const name = key.replace('tournament:slot.', '') as keyof typeof de.slot;
    const placeholders = (text: string) => (text.match(/\{\{\w+\}\}/g) ?? []).sort();
    expect(de.slot[name]).toBeTruthy();
    expect(en.slot[name]).toBeTruthy();
    expect(placeholders(en.slot[name])).toEqual(placeholders(de.slot[name]));
  });
});
