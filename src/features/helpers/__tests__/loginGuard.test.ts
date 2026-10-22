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

  it('Gegenbeispiel: Konto oder keine Sitzung → ohne Rückfrage anmelden, nichts gezählt', async () => {
    const account = setup([entry('accepted')], 0, { kind: 'account', userId: 'greta' });
    await expect(checkLoginOnHelperDevice(account.deps)).resolves.toEqual({ kind: 'proceed' });
    expect(account.countWaiting).not.toHaveBeenCalled();
    const none = setup([], 0, { kind: 'none', userId: null });
    await expect(checkLoginOnHelperDevice(none.deps)).resolves.toEqual({ kind: 'proceed' });
    const guestNothingWaiting = setup([], 0);
    await expect(checkLoginOnHelperDevice(guestNothingWaiting.deps)).resolves.toEqual({ kind: 'proceed' });
  });

  // Vorher falsch festgeschrieben: „Gast ohne Index, 3 wartend → anmelden“. @HE-094 „Aber …“: wartende Einträge der
  // Gerätesitzung sperren das Anmelden unabhängig vom Index (privates Fenster, verworfener Index, Gast mit anonymer Sitzung).
  it('Aber: wartende Einträge sperren auch ohne Index (Review #331 H-2)', async () => {
    const guest = setup([], 3);
    await expect(checkLoginOnHelperDevice(guest.deps)).resolves.toEqual({ kind: 'blocked', waitingCount: 3 });
  });

  // Vorher falsch festgeschrieben: „Zählfehler blockiert nicht“. Eine anonyme Gerätesitzung kommt nach dem Anmelden nicht
  // zurück – fail-closed.
  it('Aber: Zählfehler auf einer Gerätesitzung → nicht anmelden, ohne Zahl', async () => {
    const { deps } = setup([entry('accepted')]);
    deps.countWaiting.mockRejectedValueOnce(new Error('IndexedDB'));
    await expect(checkLoginOnHelperDevice(deps)).resolves.toEqual({ kind: 'blocked', waitingCount: null });
  });

  it('Aber: Sitzung nicht lesbar und Helfer-Index liegt auf dem Gerät → nicht anmelden; ohne Index → anmelden', async () => {
    const withIndex = setup([entry('accepted')], 0, { kind: 'unknown', userId: null });
    await expect(checkLoginOnHelperDevice(withIndex.deps)).resolves.toEqual({ kind: 'blocked', waitingCount: null });
    expect(withIndex.storage.data.has(HELPER_ACCESS_STORAGE_KEY)).toBe(true);
    const withoutIndex = setup([], 0, { kind: 'unknown', userId: null });
    await expect(checkLoginOnHelperDevice(withoutIndex.deps)).resolves.toEqual({ kind: 'proceed' });
  });

  it('nach der Anmeldung des Kontos ist der Zugangs-Index leer', () => {
    const { storage } = setup([entry('accepted')]);
    expect(storage.data.has(HELPER_ACCESS_STORAGE_KEY)).toBe(true);
    onAccountSignedIn(storage);
    expect(storage.data.has(HELPER_ACCESS_STORAGE_KEY)).toBe(false);
  });

  // Vorher falsch festgeschrieben: decideLogin(Gerät, ohne Index, 5 wartend) → anmelden. Die Zählung kommt zuerst.
  it('decideLogin prüft die Zählung vor dem Index: ohne Index, 5 wartend → gesperrt; ohne Index, 0 → anmelden', () => {
    expect(decideLogin(DEVICE, null, 5)).toEqual({ kind: 'blocked', waitingCount: 5 });
    expect(decideLogin(DEVICE, null, null)).toEqual({ kind: 'blocked', waitingCount: null });
    expect(decideLogin(DEVICE, null, 0)).toEqual({ kind: 'proceed' });
    expect(decideLogin({ kind: 'account', userId: 'greta' }, null, 5)).toEqual({ kind: 'proceed' });
  });
});
