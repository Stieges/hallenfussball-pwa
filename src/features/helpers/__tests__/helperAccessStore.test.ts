/**
 * Zugangs-Index `helper:access:v1` (§ 3.2, A-17a). Er muss das Schließen des Tabs überstehen (@HE-074, @HE-095):
 * also `localStorage`, nicht `sessionStorage`.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { HELPER_ACCESS_STORAGE_KEY, type HelperAccessEntry } from '../../../core/repositories/helperAccessRpc';
import { safeLocalStorage, safeSessionStorage } from '../../../core/utils/safeStorage';
import {
  clearHelperAccessIndex,
  entryFromServer,
  hasStoredHelperAccessIndex,
  findHelperAccessEntry,
  readHelperAccessIndex,
  removeHelperAccessEntry,
  syncHelperAccessEntry,
  upsertHelperAccessEntry,
  type HelperAccessStorage,
} from '../helperAccessStore';

const CUP = { id: 't-cup', title: 'Live-Cup', date: '2026-11-28' };
const NOW = new Date('2026-11-28T09:00:00Z');

function memory(): HelperAccessStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => { data.set(k, v); },
    removeItem: (k) => { data.delete(k); },
  };
}

function entry(overrides: Partial<HelperAccessEntry> = {}): HelperAccessEntry {
  return {
    tournamentId: 't-cup', title: 'Live-Cup', date: '2026-11-28', code: 'CODE123456', field: 2, relation: 'accepted',
    closed: false, checkNumber: null, homeHintDismissed: false, offlineReadyAt: null, updatedAt: NOW.toISOString(), ...overrides,
  };
}

beforeEach(() => {
  safeLocalStorage.removeItem(HELPER_ACCESS_STORAGE_KEY);
  safeSessionStorage.removeItem(HELPER_ACCESS_STORAGE_KEY);
});

describe('Speicherort', () => {
  it('@HE-074 @HE-095 Index liegt im localStorage (übersteht das Schließen des Tabs), nicht im sessionStorage', () => {
    upsertHelperAccessEntry('anon-tom', entry());
    expect(safeLocalStorage.getItem(HELPER_ACCESS_STORAGE_KEY)).not.toBeNull();
    expect(safeSessionStorage.getItem(HELPER_ACCESS_STORAGE_KEY)).toBeNull();
    expect(findHelperAccessEntry('anon-tom', 't-cup')).toMatchObject({ field: 2, relation: 'accepted' });
  });

  it('meldet, wenn der echte Speicher den Wert nicht genommen hat (privates Fenster)', () => {
    const store = { ...memory(), setItemPersisted: () => false };
    expect(upsertHelperAccessEntry('anon-tom', entry(), store)).toBe(false);
  });
});

describe('Index gehört zu genau einer Gerätesitzung (§ 3.2)', () => {
  it('andere Gerätesitzung, fremde Version oder kaputter Inhalt → verwerfen und entfernen', () => {
    const cases: Array<[string, string]> = [
      [JSON.stringify({ version: 1, deviceUserId: 'anon-alt', entries: [entry()] }), 'anon-neu'],
      [JSON.stringify({ version: 2, deviceUserId: 'anon-tom', entries: [] }), 'anon-tom'],
      ['{kaputt', 'anon-tom'],
    ];
    for (const [raw, session] of cases) {
      const store = memory();
      store.setItem(HELPER_ACCESS_STORAGE_KEY, raw);
      expect(readHelperAccessIndex(session, store)).toBeNull();
      expect(store.data.has(HELPER_ACCESS_STORAGE_KEY)).toBe(false);
    }
  });

  it('@HE-028 @HE-074 Sitzung unbekannt (Offline-Start, Lesefehler) → Index bleibt samt Merkern liegen (Review #331 M-2)', () => {
    const store = memory();
    upsertHelperAccessEntry('anon-tom', entry({ homeHintDismissed: true, offlineReadyAt: '2026-11-27T20:00:00Z' }), store);
    expect(readHelperAccessIndex(null, store)).toBeNull();
    expect(hasStoredHelperAccessIndex(store)).toBe(true);
    // Sobald die Sitzung wieder lesbar ist, ist alles noch da.
    expect(findHelperAccessEntry('anon-tom', 't-cup', store)).toMatchObject({ homeHintDismissed: true, offlineReadyAt: '2026-11-27T20:00:00Z' });
  });

  it('kein Index → null, nichts geschrieben', () => {
    const store = memory();
    expect(readHelperAccessIndex('anon-tom', store)).toBeNull();
    expect(store.data.size).toBe(0);
  });

  it('Schreiben mit neuer Gerätesitzung beginnt einen neuen Index (alte Einträge weg)', () => {
    const store = memory();
    upsertHelperAccessEntry('anon-alt', entry({ tournamentId: 't-alt' }), store);
    upsertHelperAccessEntry('anon-neu', entry(), store);
    expect(readHelperAccessIndex('anon-neu', store)?.entries.map((e) => e.tournamentId)).toEqual(['t-cup']);
  });

  it('@HE-099 zwei Turniere nebeneinander; Ersetzen und Entfernen je Turnier; Leeren', () => {
    const store = memory();
    upsertHelperAccessEntry('anon-tom', entry(), store);
    upsertHelperAccessEntry('anon-tom', entry({ tournamentId: 't-zwei', title: 'Zweiter Cup' }), store);
    upsertHelperAccessEntry('anon-tom', entry({ field: 1 }), store);
    const index = readHelperAccessIndex('anon-tom', store);
    expect(index?.entries).toHaveLength(2);
    expect(findHelperAccessEntry('anon-tom', 't-cup', store)?.field).toBe(1);

    removeHelperAccessEntry('anon-tom', 't-zwei', store);
    removeHelperAccessEntry('anon-tom', 'unbekannt', store);
    expect(readHelperAccessIndex('anon-tom', store)?.entries.map((e) => e.tournamentId)).toEqual(['t-cup']);

    clearHelperAccessIndex(store);
    expect(store.data.size).toBe(0);
    removeHelperAccessEntry('anon-tom', 't-cup', store);
    expect(store.data.size).toBe(0);
  });
});

describe('entryFromServer / syncHelperAccessEntry', () => {
  it('@HE-001 Anfrage offen → Eintrag pending mit Prüfzahl', () => {
    expect(entryFromServer({ state: 'open', relation: 'pending', tournament: CUP, checkNumber: 47 }, 'CODE123456', null, NOW))
      .toEqual(entry({ field: null, relation: 'pending', checkNumber: 47 }));
  });

  it('Merker des Geräts (Startbildschirm-Hinweis, Offline bereit) bleiben beim Nachführen erhalten (@HE-097, @HE-028)', () => {
    const previous = entry({ homeHintDismissed: true, offlineReadyAt: '2026-11-27T20:00:00Z', closed: true });
    const next = entryFromServer({ relation: 'accepted', field: 2 }, null, previous, NOW);
    expect(next).toMatchObject({ homeHintDismissed: true, offlineReadyAt: '2026-11-27T20:00:00Z', title: 'Live-Cup', code: 'CODE123456', closed: true });
  });

  it('@HE-098 Z.2 Server-Form von join_code_info (state closed, ohne closed) → Eintrag closed:true', () => {
    expect(entryFromServer({ state: 'closed', relation: 'accepted', tournament: CUP, field: 2 }, 'C', entry({ closed: false }), NOW))
      .toMatchObject({ relation: 'accepted', closed: true });
  });

  it('@HE-098 Z.3 Gegenbeispiel: Code abgelaufen, Turnier läuft → closed:false, auch wenn der alte Eintrag anderes sagte', () => {
    expect(entryFromServer({ state: 'expired', relation: 'accepted', tournament: CUP, field: 2 }, 'C', entry({ closed: true }), NOW))
      .toMatchObject({ relation: 'accepted', closed: false, field: 2 });
  });

  it('Zugangsstatus mit closed gewinnt vor dem Code-Zustand', () => {
    expect(entryFromServer({ state: 'open', relation: 'accepted', tournament: CUP, closed: true }, 'C', null, NOW)).toMatchObject({ closed: true });
  });

  it('ohne eigene Beziehung (none, leader) oder ohne Turnier-Angaben → kein Eintrag', () => {
    expect(entryFromServer({ state: 'open', relation: 'none', tournament: CUP }, 'C', null)).toBeNull();
    expect(entryFromServer({ state: 'open', relation: 'leader', tournament: CUP }, 'C', null)).toBeNull();
    expect(entryFromServer({ relation: 'accepted' }, 'C', null)).toBeNull();
    expect(entryFromServer({ relation: 'accepted', tournament: CUP }, null, null)).toBeNull();
  });

  it('@HE-098 Zustand „entzogen“ wird übernommen', () => {
    const store = memory();
    upsertHelperAccessEntry('anon-tom', entry(), store);
    syncHelperAccessEntry('anon-tom', 't-cup', { relation: 'revoked' }, null, store, NOW);
    expect(findHelperAccessEntry('anon-tom', 't-cup', store)?.relation).toBe('revoked');
  });

  it('@HE-098 Zugangsstatus ohne Anfrage dieses Geräts (noRequest) oder „leitet“ → Eintrag entfernen', () => {
    for (const relation of ['none', 'leader'] as const) {
      const store = memory();
      upsertHelperAccessEntry('anon-tom', entry(), store);
      expect(syncHelperAccessEntry('anon-tom', 't-cup', { relation }, null, store, NOW)).toBeNull();
      expect(findHelperAccessEntry('anon-tom', 't-cup', store)).toBeNull();
    }
  });

  it('Antwort ohne Beziehung (z. B. Code ungültig) lässt den Eintrag stehen', () => {
    const store = memory();
    upsertHelperAccessEntry('anon-tom', entry(), store);
    syncHelperAccessEntry('anon-tom', 't-cup', { state: 'invalid' }, null, store, NOW);
    expect(findHelperAccessEntry('anon-tom', 't-cup', store)).not.toBeNull();
  });

  it('Standard-Speicher und Standard-Zeit', () => {
    expect(syncHelperAccessEntry('anon-tom', 't-cup', { state: 'open', relation: 'pending', tournament: CUP, checkNumber: 5 }, 'C'))
      .toMatchObject({ relation: 'pending' });
    expect(findHelperAccessEntry('anon-tom', 't-cup')?.checkNumber).toBe(5);
  });
});
