/**
 * Einträge für den Start laden und frisch abgleichen (A-17c): @HE-098 (Server sagt entzogen/abgeschlossen), @HE-028
 * (ohne Netz gilt der gespeicherte Eintrag; unlesbare Sitzung verwirft den Index nicht).
 */
import { describe, expect, it, vi } from 'vitest';
import type { HelperAccessEntry, HelperAccessStatus, HelperRpcResult } from '../../../core/repositories/helperAccessRpc';
import { HELPER_ACCESS_STORAGE_KEY } from '../../../core/repositories/helperAccessRpc';
import { findHelperAccessEntry, upsertHelperAccessEntry, type HelperAccessStorage } from '../helperAccessStore';
import { loadHelperStartContext } from '../helperStartContext';

const CUP = { id: 't-cup', title: 'Live-Cup', date: '2026-11-28' };
const entry = (o: Partial<HelperAccessEntry> = {}): HelperAccessEntry => ({
  tournamentId: 't-cup', title: 'Live-Cup', date: '2026-11-28', code: 'CUPCODE123', field: 2, relation: 'accepted',
  closed: false, checkNumber: null, homeHintDismissed: false, offlineReadyAt: null, updatedAt: '2026-11-28T10:00:00Z', ...o,
});
function memory(): HelperAccessStorage {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); }, removeItem: (k) => { data.delete(k); } };
}
const ok = (data: HelperAccessStatus): HelperRpcResult<HelperAccessStatus> => ({ ok: true, data });

describe('loadHelperStartContext', () => {
  it('@HE-098 Zeile 1: der Server meldet „entzogen“ → Eintrag wird entzogen und im Index nachgeführt', async () => {
    const storage = memory();
    upsertHelperAccessEntry('anon-tom', entry(), storage);
    const context = await loadHelperStartContext({
      readSession: async () => ({ kind: 'device', userId: 'anon-tom' }),
      fetchStatus: async () => ok({ state: 'open', relation: 'revoked', tournament: CUP }),
      storage,
    });
    expect(context.entries[0].relation).toBe('revoked');
    expect(findHelperAccessEntry('anon-tom', 't-cup', storage)?.relation).toBe('revoked');
  });

  it('@HE-098 Zeile 2: der Server meldet „abgeschlossen“ → closed', async () => {
    const storage = memory();
    upsertHelperAccessEntry('anon-tom', entry(), storage);
    const context = await loadHelperStartContext({
      readSession: async () => ({ kind: 'device', userId: 'anon-tom' }),
      fetchStatus: async () => ok({ state: 'closed', relation: 'accepted', field: 2, closed: true, tournament: CUP }),
      storage,
    });
    expect(context.entries[0].closed).toBe(true);
  });

  it('Gegenbeispiel @HE-028: ohne Netz gilt der gespeicherte Eintrag (Feld bleibt erreichbar)', async () => {
    const storage = memory();
    upsertHelperAccessEntry('anon-tom', entry(), storage);
    const context = await loadHelperStartContext({
      readSession: async () => ({ kind: 'device', userId: 'anon-tom' }),
      fetchStatus: async () => ({ ok: false, error: { kind: 'network' } }),
      storage,
    });
    expect(context.entries).toEqual([entry()]);
  });

  it('Gegenbeispiel: hängt der Server länger als das Zeitlimit, startet die App mit dem gespeicherten Stand', async () => {
    vi.useFakeTimers();
    try {
      const storage = memory();
      upsertHelperAccessEntry('anon-tom', entry(), storage);
      const pending = loadHelperStartContext({
        readSession: async () => ({ kind: 'device', userId: 'anon-tom' }),
        fetchStatus: () => new Promise(() => undefined),
        storage,
        timeoutMs: 2500,
      });
      await vi.advanceTimersByTimeAsync(2600);
      expect((await pending).entries).toEqual([entry()]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('@HE-028 Sitzung nicht lesbar (unknown): Index roh lesen und nicht verwerfen', async () => {
    const storage = memory();
    upsertHelperAccessEntry('anon-tom', entry(), storage);
    const context = await loadHelperStartContext({
      readSession: async () => ({ kind: 'unknown', userId: null }),
      fetchStatus: async () => ({ ok: false, error: { kind: 'network' } }),
      storage,
    });
    expect(context.entries).toHaveLength(1);
    expect(storage.getItem(HELPER_ACCESS_STORAGE_KEY)).not.toBeNull();
  });

  it('Gegenbeispiel: Konto oder keine Sitzung → keine Einträge, kein Aufruf', async () => {
    const storage = memory();
    upsertHelperAccessEntry('anon-tom', entry(), storage);
    const fetchStatus = vi.fn();
    for (const kind of ['account', 'none'] as const) {
      const context = await loadHelperStartContext({ readSession: async () => ({ kind, userId: kind === 'account' ? 'greta' : null }), fetchStatus, storage });
      expect(context.entries).toEqual([]);
    }
    expect(fetchStatus).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: „keine Anfrage dieses Geräts“ (none) entfernt den veralteten Eintrag', async () => {
    const storage = memory();
    upsertHelperAccessEntry('anon-tom', entry(), storage);
    const context = await loadHelperStartContext({
      readSession: async () => ({ kind: 'device', userId: 'anon-tom' }),
      fetchStatus: async () => ok({ relation: 'none' }),
      storage,
    });
    expect(context.entries).toEqual([]);
    expect(findHelperAccessEntry('anon-tom', 't-cup', storage)).toBeNull();
  });

  it('Endzustände (entzogen) werden nicht noch einmal abgefragt', async () => {
    const storage = memory();
    upsertHelperAccessEntry('anon-tom', entry({ relation: 'revoked' }), storage);
    const fetchStatus = vi.fn();
    await loadHelperStartContext({ readSession: async () => ({ kind: 'device', userId: 'anon-tom' }), fetchStatus, storage });
    expect(fetchStatus).not.toHaveBeenCalled();
  });
});
