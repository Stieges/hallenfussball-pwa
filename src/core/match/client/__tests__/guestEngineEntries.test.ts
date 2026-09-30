/**
 * guestEngineEntries.test.ts — C3b-2c (G7): Prädikat hasGuestEngineEntries.
 *
 * G7 (.superpowers/sdd/2026-09-26-pr-c-ausgang/task-C3b-plan.md, Zeile G7): Ein Turnier
 * mit Engine-Einträgen in der lokalen Kopie des Gastkontos ('guest') darf auf KEINEM
 * Upload-Weg in das Konto geladen werden. Zuordnung: matchId ∈ tournament.matches,
 * „Einträge" = confirmed.length > 0.
 *
 * Jeder Test verwendet EIGENE Match-IDs: `fake-indexeddb` teilt den Store zwischen den
 * Tests, und `create` auf einer vorhandenen Kopie lässt `confirmed` erhalten (N2).
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { hasGuestEngineEntries, filterWithoutGuestEngineEntries } from '../guestEngineEntries';
import { LocalMatchStore } from '../LocalMatchStore';
import type { MatchCopy } from '../matchCopy';
import { ctx, ev, withSeq } from './fixtures';

function tournamentWithMatchIds(...matchIds: string[]): { id: string; matches: { id: string }[] } {
  return { id: 't1', matches: matchIds.map((id) => ({ id })) };
}

describe('hasGuestEngineEntries (C3b-2c, G7)', () => {
  let store: LocalMatchStore;

  beforeEach(() => {
    store = new LocalMatchStore();
  });

  it('true, wenn eine Gast-Kopie zum Match des Turniers bestätigte Einträge hat', async () => {
    await store.create('guest', 'ge-yes-m1', ctx);
    await store.addConfirmedLocal('guest', 'ge-yes-m1', ev({ id: 'e1', type: 'GOAL', at: 1000, teamId: 'teamA' }));

    await expect(hasGuestEngineEntries(tournamentWithMatchIds('ge-yes-m1'))).resolves.toBe(true);
  });

  it('false, wenn die Gast-Kopie keine bestätigten Einträge hat', async () => {
    await store.create('guest', 'ge-empty-m1', ctx);

    await expect(hasGuestEngineEntries(tournamentWithMatchIds('ge-empty-m1'))).resolves.toBe(false);
  });

  it('false, wenn die Einträge zu einem Match eines ANDEREN Turniers gehören', async () => {
    await store.create('guest', 'ge-fremd-m1', ctx);
    await store.addConfirmedLocal('guest', 'ge-fremd-m1', ev({ id: 'e1', type: 'GOAL', at: 1000, teamId: 'teamA' }));

    await expect(hasGuestEngineEntries(tournamentWithMatchIds('ge-own-m2'))).resolves.toBe(false);
  });

  it('false, wenn die Einträge in einem anderen Konto liegen (nicht guest)', async () => {
    await store.create('acc-user', 'ge-acc-m1', ctx);
    await store.applyConfirmed(
      'acc-user',
      'ge-acc-m1',
      [withSeq(ev({ id: 'e1', type: 'GOAL', at: 1000, teamId: 'teamA' }), 1)],
      1,
    );

    await expect(hasGuestEngineEntries(tournamentWithMatchIds('ge-acc-m1'))).resolves.toBe(false);
  });

  it('false ohne jede Gast-Kopie', async () => {
    await expect(hasGuestEngineEntries(tournamentWithMatchIds('ge-none-m1', 'ge-none-m2'))).resolves.toBe(false);
  });

  it('false, wenn das Turnier keine Matches hat (keine Zuordnung möglich)', async () => {
    await expect(hasGuestEngineEntries({ matches: [] })).resolves.toBe(false);
    await expect(hasGuestEngineEntries({})).resolves.toBe(false);
  });

  it('akzeptiert einen injizierten Store (Testbarkeit) und liest nur confirmed', async () => {
    const copies: MatchCopy[] = [
      {
        formatVersion: 2,
        accountId: 'guest',
        matchId: 'ge-inj-m1',
        ctx,
        confirmed: [withSeq(ev({ id: 'p1', type: 'GOAL', at: 1 }), 1)],
        watermarkSeq: 1,
        acked: [],
        pending: [],
        rejected: [],
        review: [],
        updatedAt: 1,
      },
    ];
    const injected = { forAccount: async () => copies };

    await expect(hasGuestEngineEntries(tournamentWithMatchIds('ge-inj-m1'), injected)).resolves.toBe(true);
  });

  it('wirft bei einem Store-Lesefehler (kein stilles true, PC29)', async () => {
    const broken = {
      forAccount: async (): Promise<MatchCopy[]> => {
        throw new Error('DB weg');
      },
    };

    await expect(hasGuestEngineEntries(tournamentWithMatchIds('ge-err-m1'), broken)).rejects.toThrow('DB weg');
  });

  it('filterWithoutGuestEngineEntries zeigt bei Store-Lesefehler das Turnier an (fail-open, PC29)', async () => {
    const broken = {
      forAccount: async (): Promise<MatchCopy[]> => {
        throw new Error('DB weg');
      },
    };
    const t = tournamentWithMatchIds('ge-err-filt-m1');

    await expect(filterWithoutGuestEngineEntries([t], broken)).resolves.toEqual([t]);
  });

  it('filterWithoutGuestEngineEntries entfernt nur Turniere mit Einträgen', async () => {
    const store = new LocalMatchStore();
    await store.create('guest', 'ge-filt-g', ctx);
    await store.addConfirmedLocal('guest', 'ge-filt-g', ev({ id: 'e1', type: 'GOAL', at: 1000, teamId: 'teamA' }));
    const guarded = tournamentWithMatchIds('ge-filt-g');
    const free = tournamentWithMatchIds('ge-filt-f');

    const visible = await filterWithoutGuestEngineEntries([guarded, free]);

    expect(visible).toEqual([free]);
  });
});