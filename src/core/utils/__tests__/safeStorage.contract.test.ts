/**
 * Vertragstest SafeStorage (A-07c Vorab, @FU-006): ein fehlgeschlagenes setItem (Quota) landet
 * im RAM-Fallback, getItem liefert aber weiterhin den alten Wert aus dem echten Speicher.
 * Die Umgebung ist node (kein window), deshalb wird ein Fake-window mit Fake-Speicher gestellt
 * und das Modul frisch geladen, damit die Konstruktion den Fake sieht.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class QuotaStorage {
  private readonly data = new Map<string, string>();
  quotaExceeded = false;

  get length(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  setItem(key: string, value: string): void {
    if (this.quotaExceeded) {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    }
    this.data.set(key, String(value));
  }
}

async function loadSafeLocalStorage(storage: QuotaStorage) {
  vi.resetModules();
  vi.stubGlobal('window', { localStorage: storage, sessionStorage: storage });
  const mod = await import('../safeStorage');
  return mod.safeLocalStorage;
}

describe('SafeStorage Vertrag: setItem wirft (Quota)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // Ist-Verhalten, Grundlage des Read-back in adoptLegacyKey. setItem selbst meldet den Fehler
  // nicht; Persistenz-Fehler meldet setItemPersisted (A-07i, Befund @FU-004 / C-QUEUE-SPEICHER-VOLL).
  it('Ist-Verhalten: getItem liefert nach fehlgeschlagenem setItem weiterhin den alten Wert aus dem echten Speicher', async () => {
    const storage = new QuotaStorage();
    storage.setItem('k', 'alt');
    const safe = await loadSafeLocalStorage(storage);

    storage.quotaExceeded = true;
    safe.setItem('k', 'neu');

    expect(safe.getItem('k')).toBe('alt');
    expect(storage.getItem('k')).toBe('alt');
  });

  it('setItemPersisted liefert false bei Quota und laesst den alten Wert im echten Speicher', async () => {
    const storage = new QuotaStorage();
    storage.setItem('k', 'alt');
    const safe = await loadSafeLocalStorage(storage);

    storage.quotaExceeded = true;

    expect(safe.setItemPersisted('k', 'neu')).toBe(false);
    expect(storage.getItem('k')).toBe('alt');
  });

  it('setItemPersisted liefert true bei normalem Speicher und schreibt den Wert', async () => {
    const storage = new QuotaStorage();
    const safe = await loadSafeLocalStorage(storage);

    expect(safe.setItemPersisted('k', 'neu')).toBe(true);
    expect(storage.getItem('k')).toBe('neu');
  });
});
