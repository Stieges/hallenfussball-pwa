/**
 * A-01 (MVP-Bauplan, Spur A) – Slot-Modell einer Spielseite.
 * Anforderung: docs/anforderungen – @TM-015 („Ein unbesetzter Platz zeigt seine Herkunft“).
 * Eine Spielseite ist entweder ein Team (Team-ID) oder „noch offen“ mit strukturierter Herkunft.
 */
import { describe, it, expect } from 'vitest';
import {
  TeamIdSchema,
  SlotSourceSchema,
  MatchSlotSchema,
  type MatchSlot,
  type SlotSource,
} from '../schemas/MatchSlotSchema';
import {
  teamSlot,
  pendingSlot,
  slotTeamId,
  slotSource,
  isPendingSlot,
  matchTeamIds,
  matchInvolvesTeam,
  matchAwaitsTeams,
  resolveSlot,
  requireTeamId,
  copySlot,
} from '../matchSlot';

const T1 = '11111111-1111-4111-8111-111111111111';
const T2 = '22222222-2222-4222-8222-222222222222';
const M_SEMI1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const M_NEW = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const groupA1: SlotSource = { kind: 'groupRank', group: 'A', rank: 1 };
const winnerSemi1: SlotSource = { kind: 'matchResult', matchId: M_SEMI1, role: 'winner' };

describe('MatchSlotSchema – gültige Spielseiten', () => {
  it.each<[string, unknown]>([
    ['@TM-015 team', { kind: 'team', teamId: T1 }],
    ['@TM-015 team mit resolvedFrom', { kind: 'team', teamId: T1, resolvedFrom: groupA1 }],
    ['@TM-015 pending groupRank', { kind: 'pending', source: groupA1 }],
    ['@TM-015 pending matchResult', { kind: 'pending', source: winnerSemi1 }],
  ])('%s ist gültig', (_name, slot) => {
    expect(MatchSlotSchema.safeParse(slot).success).toBe(true);
  });
});

describe('MatchSlotSchema – fast richtig ist ungültig', () => {
  it.each<[string, unknown]>([
    ['leere Team-ID', { kind: 'team', teamId: '' }],
    ['Teamname statt Team-ID', { kind: 'team', teamId: 'FC Nord' }],
    ['Zusatzschlüssel name', { kind: 'team', teamId: T1, name: 'FC Nord' }],
    ['rank 0', { kind: 'pending', source: { kind: 'groupRank', group: 'A', rank: 0 } }],
    ['rank 1.5', { kind: 'pending', source: { kind: 'groupRank', group: 'A', rank: 1.5 } }],
    ['rank 100', { kind: 'pending', source: { kind: 'groupRank', group: 'A', rank: 100 } }],
    ['rank als String', { kind: 'pending', source: { kind: 'groupRank', group: 'A', rank: '1' } }],
    ['leere Gruppe', { kind: 'pending', source: { kind: 'groupRank', group: '', rank: 1 } }],
    ['Gruppe länger als 40', { kind: 'pending', source: { kind: 'groupRank', group: 'x'.repeat(41), rank: 1 } }],
    ['role draw', { kind: 'pending', source: { kind: 'matchResult', matchId: M_SEMI1, role: 'draw' } }],
    ['matchId = Definitions-ID semi1', { kind: 'pending', source: { kind: 'matchResult', matchId: 'semi1', role: 'winner' } }],
    ['matchId in Großbuchstaben', { kind: 'pending', source: { kind: 'matchResult', matchId: M_SEMI1.toUpperCase(), role: 'winner' } }],
    ['pending ohne source', { kind: 'pending' }],
    ['Platzhalter-String', 'group-a-1st'],
    ['Herkunft direkt als Slot', { kind: 'groupRank', group: 'A', rank: 1 }],
    ['pending mit Zusatzschlüssel teamId', { kind: 'pending', source: groupA1, teamId: T1 }],
  ])('%s', (_name, slot) => {
    expect(MatchSlotSchema.safeParse(slot).success).toBe(false);
  });
});

describe('TeamIdSchema', () => {
  it('@TM-015 akzeptiert eine Team-UUID', () => {
    expect(TeamIdSchema.parse(T1)).toBe(T1);
  });

  it('@TM-015 Gegenbeispiel: Teamname statt ID scheitert', () => {
    expect(TeamIdSchema.safeParse('FC Nord').success).toBe(false);
    expect(TeamIdSchema.safeParse('Bayern').success).toBe(false);
    expect(TeamIdSchema.safeParse('').success).toBe(false);
  });

  it('SlotSourceSchema lehnt eine Herkunft mit Zusatzschlüssel ab', () => {
    expect(SlotSourceSchema.safeParse({ ...groupA1, label: 'Erster Gruppe A' }).success).toBe(false);
  });
});

describe('matchSlot – Hilfsfunktionen', () => {
  it('teamSlot erzeugt einen team-Slot mit der ID', () => {
    expect(teamSlot(T1)).toEqual({ kind: 'team', teamId: T1 });
    expect(teamSlot(T1, groupA1)).toEqual({ kind: 'team', teamId: T1, resolvedFrom: groupA1 });
  });

  it('teamSlot lehnt einen Teamnamen ab', () => {
    expect(() => teamSlot('FC Nord')).toThrow();
  });

  it('pendingSlot erzeugt einen offenen Slot und lehnt eine ungültige Herkunft ab', () => {
    expect(pendingSlot(groupA1)).toEqual({ kind: 'pending', source: groupA1 });
    expect(() => pendingSlot({ kind: 'matchResult', matchId: 'semi1', role: 'winner' })).toThrow();
  });

  it('slotTeamId: team → ID, pending → undefined', () => {
    expect(slotTeamId(teamSlot(T1))).toBe(T1);
    expect(slotTeamId(pendingSlot(groupA1))).toBeUndefined();
  });

  it('slotSource: pending → source, aufgelöst → resolvedFrom, team ohne Herkunft → undefined', () => {
    expect(slotSource(pendingSlot(winnerSemi1))).toEqual(winnerSemi1);
    expect(slotSource(teamSlot(T1, groupA1))).toEqual(groupA1);
    expect(slotSource(teamSlot(T1))).toBeUndefined();
  });

  it('isPendingSlot unterscheidet offen und besetzt', () => {
    expect(isPendingSlot(pendingSlot(groupA1))).toBe(true);
    expect(isPendingSlot(teamSlot(T1))).toBe(false);
  });

  it('matchTeamIds / matchInvolvesTeam / matchAwaitsTeams', () => {
    const full = { slotA: teamSlot(T1), slotB: teamSlot(T2) };
    const half = { slotA: teamSlot(T1), slotB: pendingSlot(groupA1) };
    expect(matchTeamIds(full)).toEqual([T1, T2]);
    expect(matchTeamIds(half)).toEqual([T1]);
    expect(matchInvolvesTeam(full, T2)).toBe(true);
    expect(matchInvolvesTeam(half, T2)).toBe(false);
    expect(matchAwaitsTeams(full)).toBe(false);
    expect(matchAwaitsTeams(half)).toBe(true);
  });

  it('matchInvolvesTeam mit pending ist false, auch wenn die Herkunft „passt“', () => {
    const match = { slotA: pendingSlot(groupA1), slotB: pendingSlot(winnerSemi1) };
    expect(matchInvolvesTeam(match, 'A')).toBe(false);
    expect(matchInvolvesTeam(match, M_SEMI1)).toBe(false);
  });

  it('resolveSlot setzt das Team und behält die Herkunft', () => {
    expect(resolveSlot(groupA1, T1)).toEqual({ kind: 'team', teamId: T1, resolvedFrom: groupA1 });
  });

  it('requireTeamId liefert die ID und wirft bei pending', () => {
    expect(requireTeamId(teamSlot(T1))).toBe(T1);
    expect(() => requireTeamId(pendingSlot(groupA1))).toThrow('Gruppenspiel ohne Team');
  });
});

describe('copySlot – Turnier kopieren', () => {
  const teamIdMap = new Map([[T1, T2]]);
  const matchIdMap = new Map([[M_SEMI1, M_NEW]]);

  it('team ohne Herkunft → neue Team-ID', () => {
    expect(copySlot(teamSlot(T1), teamIdMap, matchIdMap)).toEqual(teamSlot(T2));
  });

  it('aufgelöster Slot → wieder pending mit Herkunft', () => {
    expect(copySlot(teamSlot(T1, groupA1), teamIdMap, matchIdMap)).toEqual(pendingSlot(groupA1));
  });

  it('matchResult-Herkunft zeigt auf die neue Spiel-ID (keine alte ID bleibt)', () => {
    const copied: MatchSlot = copySlot(teamSlot(T1, winnerSemi1), teamIdMap, matchIdMap);
    expect(copied).toEqual(pendingSlot({ kind: 'matchResult', matchId: M_NEW, role: 'winner' }));
    expect(JSON.stringify(copied)).not.toContain(M_SEMI1);
  });

  it('fehlende Zuordnung wirft', () => {
    expect(() => copySlot(teamSlot(T2), teamIdMap, matchIdMap)).toThrow();
    expect(() =>
      copySlot(pendingSlot({ kind: 'matchResult', matchId: M_NEW, role: 'loser' }), teamIdMap, matchIdMap),
    ).toThrow();
  });
});
