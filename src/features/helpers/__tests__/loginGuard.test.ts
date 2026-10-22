/**
 * @HE-094 (Logik): Anmelden mit einem Konto auf einem Gerät mit Helfer-Zugang fragt vorher; wartende Helfer-Einträge
 * verhindern das Anmelden. Text und Dialog: A-17c / B-30 (I-6).
 */
import { describe, expect, it, vi } from 'vitest';
import { HELPER_ACCESS_STORAGE_KEY, type HelperAccessEntry } from '../../../core/repositories/helperAccessRpc';
import type { SessionInfo } from '../../../core/auth/deviceSession';
import { upsertHelperAccessEntry, type HelperAccessStorage } from '../helperAccessStore';
import { checkLoginOnHelperDevice, decideLogin, onAccountSignedIn } from '../loginGuard';

function memory(): HelperAccessStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); }, removeItem: (k) => { data.delete(k); } };
}

function entry(relation: HelperAccessEntry['relation'], title = 'Live-Cup', id = 't-cup'): HelperAccessEntry {
  return {
    tournamentId: id, title, date: '2026-11-28', code: 'C', field: 2, relation, closed: false, checkNumber: null,
    homeHintDismissed: false, offlineReadyAt: null, updatedAt: '2026-11-28T09:00:00Z',
  };
}

const DEVICE: SessionInfo = { kind: 'device', userId: 'anon-tom' };

function setup(entries: HelperAccessEntry[], waiting = 0, session: SessionInfo = DEVICE) {
  const storage = memory();
  for (const e of entries) {upsertHelperAccessEntry('anon-tom', e, storage);}
  const countWaiting = vi.fn(async () => waiting);
  return { storage, countWaiting, deps: { readSession: async () => session, countWaiting, storage } };
}

describe('@HE-094 Anmelden auf einem Gerät mit Helfer-Zugang', () => {
  it('Helfer-Zugang zum Live-Cup → Rückfrage mit Turniername', async () => {
    const { deps, countWaiting } = setup([entry('accepted')]);
    await expect(checkLoginOnHelperDevice(deps)).resolves.toEqual({ kind: 'confirm', tournamentTitles: ['Live-Cup'] });
    expect(countWaiting).toHaveBeenCalledWith('anon-tom');
  });

  it('2 Helfer-Einträge warten → nicht anmelden, „Erst verbinden – 2 Einträge warten“', async () => {
    const { deps } = setup([entry('accepted')], 2);
    await expect(checkLoginOnHelperDevice(deps)).resolves.toEqual({ kind: 'blocked', waitingCount: 2 });
  });

  it('„nur zusehen“ und offene Anfrage zählen als Zugang; entzogen/abgelehnt/verfallen nicht', async () => {
    const both = setup([entry('viewer'), entry('pending', 'Zweiter Cup', 't-2'), entry('revoked', 'Alt', 't-3')]);
    await expect(checkLoginOnHelperDevice(both.deps)).resolves.toEqual({ kind: 'confirm', tournamentTitles: ['Live-Cup', 'Zweiter Cup'] });
    const gone = setup([entry('revoked'), entry('declined', 'B', 't-2'), entry('expired', 'C', 't-3')]);
    await expect(checkLoginOnHelperDevice(gone.deps)).resolves.toEqual({ kind: 'proceed' });
  });

  it('Gegenbeispiel: kein Helfer-Gerät (Konto, keine Sitzung, Gast ohne Index) → ohne Rückfrage anmelden', async () => {
    const account = setup([entry('accepted')], 0, { kind: 'account', userId: 'greta' });
    await expect(checkLoginOnHelperDevice(account.deps)).resolves.toEqual({ kind: 'proceed' });
    expect(account.countWaiting).not.toHaveBeenCalled();
    const none = setup([], 0, { kind: 'none', userId: null });
    await expect(checkLoginOnHelperDevice(none.deps)).resolves.toEqual({ kind: 'proceed' });
    const guest = setup([], 3);
    await expect(checkLoginOnHelperDevice(guest.deps)).resolves.toEqual({ kind: 'proceed' });
  });

  it('Zählfehler blockiert nicht (wie useGuardedLogout)', async () => {
    const { deps } = setup([entry('accepted')]);
    deps.countWaiting.mockRejectedValueOnce(new Error('IndexedDB'));
    await expect(checkLoginOnHelperDevice(deps)).resolves.toEqual({ kind: 'confirm', tournamentTitles: ['Live-Cup'] });
  });

  it('nach der Anmeldung des Kontos ist der Zugangs-Index leer', () => {
    const { storage } = setup([entry('accepted')]);
    expect(storage.data.has(HELPER_ACCESS_STORAGE_KEY)).toBe(true);
    onAccountSignedIn(storage);
    expect(storage.data.has(HELPER_ACCESS_STORAGE_KEY)).toBe(false);
  });

  it('decideLogin ohne Index → anmelden', () => {
    expect(decideLogin(DEVICE, null, 5)).toEqual({ kind: 'proceed' });
  });
});
