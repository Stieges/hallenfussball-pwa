/**
 * A-36b (W2, W7, Konsolidierung G62): Herkunftstexte der gemeinsamen Ansicht.
 * - W2: „noch offen“ ersetzt nur die Herkunft mit Platz (Gruppenrang), „Sieger Halbfinale 1“ bleibt (@BM-032).
 * - W7: Record-Wortlaut „Halbfinale 1“; englisch „to be decided“ (@ZM-102).
 */
import { describe, expect, it, vi } from 'vitest';
import { describeOrigin, matchLabelText, originText, slotLabel } from '../originText';
import { pendingSlot, teamSlot } from '../../models/matchSlot';

vi.mock('i18next', async () => (await import('./realI18n')).realI18nModule());

const SEMI1 = '00000000-0000-4000-8000-000000000101';
const NORD = '00000000-0000-4000-8000-000000000001';
const ctx = { teams: [{ id: NORD, name: 'FC Nord' }], matches: [{ id: SEMI1, label: '1. Halbfinale' }] };

describe('@BM-032 W2: nur der Platz wird verborgen, nicht der Sieger eines Spiels', () => {
  it.each([
    ['de', 'Sieger Halbfinale 1', 'noch offen'],
    ['en', 'Winner of Semifinal 1', 'to be decided'],
  ] as const)('@BM-032 @ZM-102 %s', (locale, winner, undecided) => {
    const hidden = { ...ctx, locale, hidePendingOrigin: true };
    expect(slotLabel(pendingSlot({ kind: 'matchResult', matchId: SEMI1, role: 'winner' }), hidden)).toBe(winner);
    expect(slotLabel(pendingSlot({ kind: 'groupRank', group: 'B', rank: 2 }), hidden)).toBe(undecided);
  });

  it('@BM-032 Gegenbeispiel: besetzte Seite bleibt der Teamname', () => {
    expect(slotLabel(teamSlot(NORD), { ...ctx, locale: 'de', hidePendingOrigin: true })).toBe('FC Nord');
  });
});

describe('@DR-022 W7: Wortlaut nach Record in der verlangten Sprache', () => {
  it.each([
    ['de', 'Halbfinale 1', 'Erster Gruppe A'],
    ['en', 'Semifinal 1', '1st Group A'],
  ] as const)('@DR-022 %s', (locale, label, origin) => {
    expect(matchLabelText('1. Halbfinale', locale)).toBe(label);
    expect(originText(describeOrigin({ kind: 'groupRank', group: 'A', rank: 1 }, ctx), locale)).toBe(origin);
  });
});
