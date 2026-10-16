/**
 * A-36b `sideView` (Teilplan A-36 § 2.4 „Seite“, F1/M6): Zusatzzeile nur, wenn die Herkunft für dieses Team wahr ist.
 */
import { describe, expect, it, vi } from 'vitest';
import { sideView, type SideContext } from '../sides';
import type { Match } from '../../../types/tournament';
import type { SlotSource } from '../../models/schemas/MatchSlotSchema';
import { pendingSlot, resolveSlot, teamSlot } from '../../models/matchSlot';

vi.mock('i18next', async () => (await import('./realI18n')).realI18nModule());

const WEST = '00000000-0000-4000-8000-000000000003';
const GHOST = '00000000-0000-4000-8000-000000000099';
const A1: SlotSource = { kind: 'groupRank', group: 'A', rank: 1 };
const ctx = (groupOrigin: boolean): SideContext => ({
  audience: 'organizer',
  labels: { teams: [{ id: WEST, name: 'TSV West' }], matches: [], locale: 'de' },
  locale: 'de',
  rules: { groupOrigin },
  edition: 'plan',
});
const semi = (slotA: Match['slotA']): Pick<Match, 'slotA' | 'slotB' | 'originA' | 'originB' | 'isFinal'> => ({
  slotA, slotB: pendingSlot({ kind: 'groupRank', group: 'B', rank: 2 }), originA: A1, isFinal: true,
});

describe('@BM-014 Zusatzzeile „Erster Gruppe A“ unter dem Team', () => {
  it.each([
    ['automatisch besetzt (Resolver)', resolveSlot(A1, WEST), 'Erster Gruppe A'],
    ['„Weiterkommen festlegen“', { ...teamSlot(WEST), assignedBy: 'decided' as const }, 'Erster Gruppe A'],
    ['Ersatzteam @W5-010', { ...teamSlot(WEST), assignedBy: 'replaced' as const }, 'Erster Gruppe A'],
    ['„Neu besetzen“', { ...teamSlot(WEST), assignedBy: 'reassigned' as const }, undefined],
    ['ohne Merkmal (gilt als neu besetzt)', teamSlot(WEST), undefined],
  ])('@BM-014 %s', (_fall, slot, subLabel) => {
    const side = sideView(semi(slot), 'A', ctx(true));
    expect(side).toMatchObject({ pending: false, label: 'TSV West', teamName: 'TSV West', origin: A1 });
    expect(side.subLabel).toBe(subLabel);
  });

  it('@ZM-102 Gegenbeispiel: bei ausgeschalteten Tabellen keine Zusatzzeile mit Platz', () => {
    expect(sideView(semi(resolveSlot(A1, WEST)), 'A', ctx(false)).subLabel).toBeUndefined();
  });

  it('@TM-015 unbekannte Team-ID zeigt „?“, nie einen geratenen Namen', () => {
    const side = sideView(semi(teamSlot(GHOST)), 'A', ctx(true));
    expect(side.label).toBe('?');
    expect(side.teamName).toBeUndefined();
  });

  it('@ZM-102 @DR-018 Vorlage bei ausgeschalteten Tabellen: Leitung sieht den Gruppenrang, Zuschauer/Monitor nicht (K4)', () => {
    const open = semi(pendingSlot(A1));
    expect(sideView(open, 'A', { ...ctx(false), edition: 'blank' }).label).toBe('Erster Gruppe A');
    for (const audience of ['viewer', 'screen'] as const) {
      expect(sideView(open, 'A', { ...ctx(false), audience, edition: 'blank' }).label).toBe('noch offen');
      expect(sideView(open, 'A', { ...ctx(true), audience, edition: 'blank' }).label).toBe('Erster Gruppe A');
    }
  });

  it('@DR-005 Vorlage ohne gespeicherte Herkunft und mit besetzter Seite: „noch offen“, nie der Teamname', () => {
    const legacy = { slotA: teamSlot(WEST), slotB: teamSlot(WEST), isFinal: true };
    expect(sideView(legacy, 'A', { ...ctx(true), edition: 'blank' }).label).toBe('noch offen');
  });
});
