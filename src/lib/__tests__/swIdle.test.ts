/**
 * Task C3b-2d (G8): Leerlauf-Pruefung vor dem automatischen Neuladen.
 * Leerlauf = kein modaler Dialog UND Ausgang des aktuellen Kontos sicher leer.
 * Fake-Timers sind hier nicht noetig (keine Zeitlogik in `isIdle`); die
 * Wiederhol-Pruefung ueber den 60-s-Takt laeuft in `swRegistration.test.ts`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MatchCopy } from '../../core/match/client/matchCopy';
import { countWaitingEntries } from '../../features/collaboration/outbox/countWaitingEntries';
import type { EngineEvent, MatchContext } from '../../core/match/types';
import { hasOpenModalDialog, isIdle, type IdleDeps } from '../swIdle';

const CTX: MatchContext = { matchId: 'm1', teamAId: 'team-a', teamBId: 'team-b' };

function ev(id: string): EngineEvent {
  return {
    id,
    type: 'GOAL',
    actor: 'helper',
    at: 1000,
    section: 1,
    clockMs: 0,
    teamId: 'team-a',
    payload: {},
  };
}

function copy(
  matchId: string,
  lists: Partial<Pick<MatchCopy, 'pending' | 'acked' | 'rejected' | 'review'>>,
): MatchCopy {
  return {
    formatVersion: 2,
    accountId: 'acc1',
    matchId,
    ctx: CTX,
    confirmed: [],
    watermarkSeq: 0,
    acked: [],
    pending: [],
    rejected: [],
    review: [],
    updatedAt: 0,
    ...lists,
  };
}

function deps(overrides: Partial<IdleDeps> = {}): IdleDeps {
  return {
    hasOpenModalDialog: () => hasOpenModalDialog(document),
    countWaiting: vi.fn(async () => 0),
    hasAccount: () => true,
    ...overrides,
  };
}

describe('isIdle', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('offener modaler Dialog → kein Reload; Dialog zu → Reload', async () => {
    document.body.innerHTML =
      '<div role="dialog" aria-modal="true"><button>Speichern</button></div>';
    const offen = deps({ countWaiting: vi.fn(async () => 0) });
    await expect(isIdle(offen)).resolves.toBe(false);
    expect(offen.countWaiting).not.toHaveBeenCalled();

    document.body.innerHTML = '<main>Startseite</main>';
    await expect(isIdle(deps({ countWaiting: vi.fn(async () => 0) }))).resolves.toBe(true);
  });

  it('Gegenbeispiel: role="dialog" OHNE aria-modal="true" blockiert nicht', async () => {
    document.body.innerHTML = '<div role="dialog"><button>Filter</button></div>';
    await expect(isIdle(deps({ countWaiting: vi.fn(async () => 0) }))).resolves.toBe(true);
  });

  it('Ausgang nicht leer → kein Reload; Ausgang leer → Reload', async () => {
    const wartet = {
      forAccount: vi.fn(async () => [copy('m1', { pending: [ev('e1')] })]),
    };
    await expect(
      isIdle(
        deps({
          countWaiting: () => countWaitingEntries(wartet, 'acc1'),
        }),
      ),
    ).resolves.toBe(false);

    const leer = { forAccount: vi.fn(async () => []) };
    await expect(
      isIdle(
        deps({
          countWaiting: () => countWaitingEntries(leer, 'acc1'),
        }),
      ),
    ).resolves.toBe(true);
    expect(leer.forAccount).toHaveBeenCalledWith('acc1');
  });

  it('Gegenbeispiel: nur acked (pending leer) blockiert auch', async () => {
    const nurAcked = {
      forAccount: vi.fn(async () => [copy('m1', { acked: [ev('e1')] })]),
    };
    await expect(
      isIdle(
        deps({
          countWaiting: () => countWaitingEntries(nurAcked, 'acc1'),
        }),
      ),
    ).resolves.toBe(false);
  });

  it('Ausgang nicht lesbar → nicht Leerlauf (Regel 2), spaeterer Versuch kann greifen', async () => {
    const countWaiting = vi
      .fn<() => Promise<number>>()
      .mockRejectedValueOnce(new Error('IndexedDB nicht lesbar'))
      .mockResolvedValueOnce(0);
    const d = deps({ countWaiting });
    await expect(isIdle(d)).resolves.toBe(false);
    await expect(isIdle(d)).resolves.toBe(true);
    expect(countWaiting).toHaveBeenCalledTimes(2);
  });

  it('ohne Konto/Engine-Kontext zaehlt nur die Dialog-Bedingung', async () => {
    const countWaiting = vi.fn(async () => 3);
    const ohneKonto = deps({ countWaiting, hasAccount: () => false });
    await expect(isIdle(ohneKonto)).resolves.toBe(true);
    expect(countWaiting).not.toHaveBeenCalled();

    document.body.innerHTML = '<div role="dialog" aria-modal="true"></div>';
    await expect(isIdle(deps({ countWaiting, hasAccount: () => false }))).resolves.toBe(false);
  });

  it('unerwartete Wuerfe gelten als nicht Leerlauf und brechen nicht aus', async () => {
    const hasOpen = vi.fn(() => {
      throw new Error('DOM weg');
    });
    await expect(isIdle(deps({ hasOpenModalDialog: hasOpen }))).resolves.toBe(false);
  });

  it('Zaehler > 0 ist nicht Leerlauf, auch ohne Dialog', async () => {
    await expect(isIdle(deps({ countWaiting: vi.fn(async () => 2) }))).resolves.toBe(false);
  });
});
