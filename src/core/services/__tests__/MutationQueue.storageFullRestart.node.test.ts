/**
 * BP-1 – Befunde C-QUEUE-SPEICHER-VOLL und C-QUEUE-SPEICHER-VOLL-REST, Szenarien @FU-121 und @FU-122.
 *
 * @FU-121: Der Speicher von Toms Gerät ist voll („Gerätespeicher voll“). Toms Ergebnis für Spiel 5 ist beim Server
 * angekommen, Olli hat Spiel 5 danach korrigiert. Nach einem Neustart sendet Toms Gerät das alte Ergebnis nicht noch einmal
 * (Spiel 5 bleibt bei Ollis Korrektur) und zeigt keinen wartenden Eintrag für Spiel 5.
 * Negationsfall (Controller F1): kann das Gerät nicht einmal den gekürzten Stand ablegen, entfernt es den alten Stand –
 * Ungesendetes lebt dann bis zum Neustart nur im Arbeitsspeicher, sichtbar als „Gerätespeicher voll“.
 * @FU-122: Was beim Neustart noch nicht übertragen war, geht danach genau einmal raus; Gesendetes nicht noch einmal.
 *
 * Echter `safeLocalStorage`, nur das Storage-Objekt im (gestubbten) window ist eine Attrappe:
 * - `FullStorage`: jedes Schreiben wirft (Speicher voll, auch für kürzere Werte – so verhält sich kein Kontingent mit
 *   Gutschrift, aber ein Gerät, dessen übriger Speicher anderweitig belegt ist);
 * - `CapacityStorage`: Kontingent in Zeichen, das Überschreiben eines Schlüssels rechnet den alten Wert gut (wie Chrome).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MatchUpdate } from '../../models/types';

const sentry = vi.hoisted(() => ({ captureFeatureError: vi.fn() }));
vi.mock('../../../lib/sentry', () => ({ captureFeatureError: sentry.captureFeatureError }));
vi.mock('../../../lib/supabase', () => ({ isSupabaseConfigured: false, supabase: null }));
vi.mock('../../match/client/guestEngineEntries', () => ({ hasGuestEngineEntries: vi.fn(async () => false) }));

class MapStorage {
  protected readonly data = new Map<string, string>();
  get length(): number { return this.data.size; }
  clear(): void { this.data.clear(); }
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  key(index: number): string | null { return [...this.data.keys()][index] ?? null; }
  removeItem(key: string): void { this.data.delete(key); }
  setItem(key: string, value: string): void { this.data.set(key, String(value)); }
  raw(key: string): string | null { return this.data.get(key) ?? null; }
  used(): number { return [...this.data.entries()].reduce((sum, [k, v]) => sum + k.length + v.length, 0); }
}

/** Speicher voll: jedes Schreiben wirft, Lesen und Entfernen gehen. */
class FullStorage extends MapStorage {
  full = false;
  override setItem(key: string, value: string): void {
    if (this.full) { throw new DOMException('The quota has been exceeded.', 'QuotaExceededError'); }
    super.setItem(key, value);
  }
}

/** Kontingent in Zeichen; Überschreiben rechnet den alten Wert gut. */
class CapacityStorage extends MapStorage {
  capacity = Number.POSITIVE_INFINITY;
  override setItem(key: string, value: string): void {
    const old = this.data.get(key);
    const next = this.used() - (old === undefined ? 0 : key.length + old.length) + key.length + value.length;
    if (next > this.capacity) { throw new DOMException('The quota has been exceeded.', 'QuotaExceededError'); }
    super.setItem(key, value);
  }
}

const QUEUE_KEY = 'mutation_queue_v1';

function setOnline(value: boolean): void {
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: value }, configurable: true, writable: true });
}

async function loadQueueModule(storage: MapStorage) {
  vi.resetModules();
  vi.stubGlobal('window', Object.assign(new EventTarget(), { localStorage: storage, sessionStorage: storage }));
  const { MutationQueue } = await import('../MutationQueue');
  return MutationQueue;
}

const netError = () => Object.assign(new Error('TypeError: Failed to fetch'), { name: 'TypeError' });

/** Repo-Attrappe: zählt Sendungen je Spiel; `offen` = Spiele, deren Senden (noch) am Netz scheitert. */
function makeRepo(offen: ReadonlySet<string>) {
  const gesendet: string[] = [];
  const updateMatch = vi.fn(async (_t: string, update: MatchUpdate) => {
    if (offen.has(update.id)) { throw netError(); }
    gesendet.push(update.id);
  });
  return { repo: { updateMatch }, gesendet };
}

const localRepo = { get: vi.fn(async () => null) };

async function flush(): Promise<void> {
  for (let i = 0; i < 20; i++) { await new Promise<void>((resolve) => setTimeout(resolve, 0)); }
}

const ergebnis = (spiel: string, extra = ''): { tournamentId: string; update: MatchUpdate } =>
  ({ tournamentId: 'live-cup', update: { id: spiel, ...(extra ? { note: extra } : {}) } });

describe('BP-1 C-QUEUE-SPEICHER-VOLL / C-QUEUE-SPEICHER-VOLL-REST: kein alter Stand nach dem Neustart (@FU-121, @FU-122)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    sentry.captureFeatureError.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('@FU-121 Speicher voll, Ergebnis Spiel 5 angekommen: nach dem Neustart wird es nicht noch einmal gesendet', async () => {
    const storage = new FullStorage();
    const MutationQueue = await loadQueueModule(storage);
    setOnline(false);
    const vorher = makeRepo(new Set(['m6']));
    const first = new MutationQueue(vorher.repo as never, localRepo as never);
    first.enqueue('UPDATE_MATCH', ergebnis('m5'));
    first.enqueue('UPDATE_MATCH', ergebnis('m6'));
    storage.full = true;

    setOnline(true);
    await first.process();
    await flush();
    expect(vorher.gesendet).toEqual(['m5']);
    first.dispose();

    // Neustart (Speicher wieder frei): Spiel 5 geht nicht noch einmal raus, es wartet kein Eintrag für Spiel 5
    storage.full = false;
    const nachher = makeRepo(new Set());
    const second = new MutationQueue(nachher.repo as never, localRepo as never);
    await flush();
    expect(nachher.gesendet).not.toContain('m5');
    expect(second.getFailedCount()).toBe(0);
    second.dispose();
  });

  it('@FU-122 Gegenbeispiel: Ungesendetes (Spiel 6) geht nach dem Neustart genau einmal raus, Spiel 5 nicht noch einmal', async () => {
    const storage = new CapacityStorage();
    const MutationQueue = await loadQueueModule(storage);
    setOnline(false);
    const vorher = makeRepo(new Set(['m6', 'm7']));
    const first = new MutationQueue(vorher.repo as never, localRepo as never);
    first.enqueue('UPDATE_MATCH', ergebnis('m5'));
    first.enqueue('UPDATE_MATCH', ergebnis('m6'));
    storage.capacity = storage.used(); // jetzt ist der Speicher voll
    // ein langer Eintrag passt nicht mehr: der abgelegte Stand bleibt [m5, m6]
    first.enqueue('UPDATE_MATCH', ergebnis('m7', 'x'.repeat(400)));
    expect(first.getLastFailure()).toBe('storage');

    setOnline(true);
    await first.process();
    await flush();
    expect(vorher.gesendet).toEqual(['m5']);
    first.dispose();

    // Neustart mit Netz: m6 genau einmal, m5 nie wieder
    const nachher = makeRepo(new Set());
    const second = new MutationQueue(nachher.repo as never, localRepo as never);
    await flush();
    expect(nachher.gesendet.filter((s) => s === 'm6')).toEqual(['m6']);
    expect(nachher.gesendet).not.toContain('m5');
    second.dispose();
  });

  it('@FU-122 Review A2: ein wartender Eintrag, der durch Zusammenfassen gewachsen ist, bleibt nach dem Neustart in seiner abgelegten Form erhalten', async () => {
    const storage = new CapacityStorage();
    const MutationQueue = await loadQueueModule(storage);
    setOnline(false);
    const angaben: Array<Record<string, unknown>> = [];
    const repo = {
      updateMatch: vi.fn(async () => undefined),
      updateTournamentMetadata: vi.fn(async (_id: string, metadata: Record<string, unknown>) => {
        if (!(globalThis.navigator as { onLine: boolean }).onLine || sitzung === 1) { throw netError(); }
        angaben.push(metadata);
      }),
    };
    let sitzung = 1;
    const first = new MutationQueue(repo as never, localRepo as never);
    first.enqueue('UPDATE_MATCH', ergebnis('m5'));
    first.enqueue('UPDATE_TOURNAMENT_METADATA', { tournamentId: 'live-cup', metadata: { title: 'Live-Cup Ost' } });
    storage.capacity = storage.used(); // Speicher voll: abgelegt sind [m5, Name]
    // Zusammenfassen: dieselbe wartende Änderung wächst um einen langen Ort und passt nicht mehr
    first.enqueue('UPDATE_TOURNAMENT_METADATA', { tournamentId: 'live-cup', metadata: { location: { name: 'H'.repeat(600) } } });

    setOnline(true);
    await first.process(); // m5 geht raus, die Turnierangaben scheitern am Netz
    await flush();
    expect(repo.updateMatch).toHaveBeenCalledTimes(1);
    first.dispose();

    // Neustart: der vorher dauerhaft abgelegte, noch wartende Eintrag ist da (alte Form), m5 nicht noch einmal
    sitzung = 2;
    const second = new MutationQueue(repo as never, localRepo as never);
    await flush();
    expect(repo.updateMatch).toHaveBeenCalledTimes(1);
    expect(angaben).toEqual([{ title: 'Live-Cup Ost' }]);
    second.dispose();
  });

  it('@FU-122 Gegenbeispiel ohne vollen Speicher: alles bleibt wie bisher (nichts entfernt, keine Störung)', async () => {
    const storage = new CapacityStorage();
    const MutationQueue = await loadQueueModule(storage);
    setOnline(false);
    const vorher = makeRepo(new Set(['m6']));
    const first = new MutationQueue(vorher.repo as never, localRepo as never);
    first.enqueue('UPDATE_MATCH', ergebnis('m5'));
    first.enqueue('UPDATE_MATCH', ergebnis('m6'));

    setOnline(true);
    await first.process();
    await flush();
    expect(first.getLastFailure()).toBe('transient');
    expect(JSON.parse(storage.raw(QUEUE_KEY) ?? '[]')).toHaveLength(1);
    expect(sentry.captureFeatureError).not.toHaveBeenCalled();
    first.dispose();
  });
});
