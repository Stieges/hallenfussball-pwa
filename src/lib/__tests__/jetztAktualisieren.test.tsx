/**
 * @OB-087 Zeile „Jetzt aktualisieren“ (Spielplan, veraltete App): was der Tipp am echten Neulade-Weg (`setupSwAutoReload`, Tor, Eilpfad) bewirkt –
 * die drei Fälle: (1) die neue Fassung liegt schon bereit → sofort neu laden; (2) sie wird erst gesucht → laden, sobald sie da ist, bis dahin nichts
 * Sichtbares am Service Worker; (3) das Tor blockt (Gerät ist bereiter Hallen-Lautsprecher) → nichts anstoßen, Rückmeldung `blockiert`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetSwForTests, attachReloadGate, setupSwAutoReload, type RegisterSWOptions } from '../swRegistration';
import { aktualisiereJetzt } from '../jetztAktualisieren';

function harness(registration: ServiceWorkerRegistration) {
  let needRefresh: (() => void) | undefined;
  const updateSW = vi.fn().mockResolvedValue(undefined);
  const registerSW = vi.fn((opts?: RegisterSWOptions) => {
    needRefresh = opts?.onNeedRefresh;
    opts?.onRegisteredSW?.('sw.js', registration);
    return updateSW;
  });
  setupSwAutoReload({
    registerSW, showToast: vi.fn(), updatingMessage: () => 'Updating…', isIdle: async () => false,
    hasOpenModalDialog: () => false, showUpdateNotice: vi.fn(), reload: vi.fn(),
  });
  return { updateSW, neueFassungGefunden: () => { needRefresh?.(); } };
}

describe('@OB-087 „Jetzt aktualisieren“ am Neulade-Weg', () => {
  beforeEach(() => { __resetSwForTests(); vi.useFakeTimers(); });
  afterEach(() => { __resetSwForTests(); vi.useRealTimers(); });

  it('Fall 1: liegt die neue Fassung schon bereit, lädt der Tipp sofort neu (einmal)', async () => {
    const update = vi.fn(async () => undefined);
    const h = harness({ update } as unknown as ServiceWorkerRegistration);
    h.neueFassungGefunden();
    expect(aktualisiereJetzt()).toBe('laedt');
    await vi.advanceTimersByTimeAsync(0);
    expect(h.updateSW).toHaveBeenCalledWith(true);
    aktualisiereJetzt();
    await vi.advanceTimersByTimeAsync(0);
    expect(h.updateSW).toHaveBeenCalledTimes(1);
  });

  it('Fall 2: ist noch keine neue Fassung da, wird gesucht; es lädt erst, wenn sie gefunden ist – nicht vorher', async () => {
    const update = vi.fn(async () => undefined);
    const h = harness({ update } as unknown as ServiceWorkerRegistration);
    expect(aktualisiereJetzt()).toBe('laedt');
    await vi.advanceTimersByTimeAsync(0);
    expect(update).toHaveBeenCalledTimes(1); // Suche angestoßen
    expect(h.updateSW).not.toHaveBeenCalled(); // noch nichts geladen
    h.neueFassungGefunden(); // innerhalb des Eilfensters gefunden
    await vi.advanceTimersByTimeAsync(0);
    expect(h.updateSW).toHaveBeenCalledWith(true);
  });

  it('Fall 3: blockt das Tor (bereiter Hallen-Lautsprecher), wird nichts angestoßen: keine Suche, kein Neuladen', async () => {
    const update = vi.fn(async () => undefined);
    const h = harness({ update } as unknown as ServiceWorkerRegistration);
    h.neueFassungGefunden();
    attachReloadGate({ allowsReload: () => false, blocksUrgent: true });
    expect(aktualisiereJetzt()).toBe('blockiert');
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(update).not.toHaveBeenCalled();
    expect(h.updateSW).not.toHaveBeenCalled();
  });

  it('Gegenbeispiele: ein Halter, der nur den normalen Weg anhält (Monitor, ohne blocksUrgent), oder ein bereitwilliger Lautsprecher blockt den Tipp nicht', async () => {
    const h = harness({ update: vi.fn(async () => undefined) } as unknown as ServiceWorkerRegistration);
    h.neueFassungGefunden();
    const ab1 = attachReloadGate({ allowsReload: () => false });
    expect(aktualisiereJetzt()).toBe('laedt');
    ab1();
    attachReloadGate({ allowsReload: () => true, blocksUrgent: true });
    expect(aktualisiereJetzt()).toBe('laedt');
  });
});
