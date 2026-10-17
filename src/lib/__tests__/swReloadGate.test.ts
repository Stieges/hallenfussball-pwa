/**
 * B-19b (@ZM-124, @ZM-128, @ME-012, @ME-032): Neulade-Tor der SW-Schicht. Ein gesetztes Tor ersetzt die
 * Leerlauf-Prüfung und den Hinweis (kein Toast, kein Knopf). Ohne Tor bleibt alles wie heute. Eine unlesbare
 * Antwort lädt sofort neu; ohne neue Version passiert nichts (keine Schleife).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetSwForTests,
  attachReloadGate,
  notifyReloadGate,
  requestUrgentReload,
  setupSwAutoReload,
  type RegisterSWOptions,
} from '../swRegistration';
import { hasOpenModalDialog } from '../swIdle';

function harness(isIdle: () => Promise<boolean>, registration?: ServiceWorkerRegistration) {
  let needRefresh: (() => void) | undefined;
  const updateSW = vi.fn().mockResolvedValue(undefined);
  const registerSW = vi.fn((opts?: RegisterSWOptions) => {
    needRefresh = opts?.onNeedRefresh;
    opts?.onRegisteredSW?.('sw.js', registration);
    return updateSW;
  });
  const showToast = vi.fn();
  const showUpdateNotice = vi.fn();
  const reload = vi.fn();
  setupSwAutoReload({
    registerSW,
    showToast,
    updatingMessage: () => 'Updating…',
    isIdle,
    hasOpenModalDialog: () => hasOpenModalDialog(document),
    showUpdateNotice,
    reload,
  });
  return {
    updateSW,
    showToast,
    showUpdateNotice,
    reload,
    needRefresh: () => { needRefresh?.(); },
  };
}

describe('Neulade-Tor der SW-Schicht (B-19b, @ZM-124, @ME-012, @ME-032)', () => {
  beforeEach(() => {
    __resetSwForTests();
    vi.useFakeTimers();
  });

  afterEach(() => {
    __resetSwForTests();
    vi.useRealTimers();
  });

  it('@ME-012: Tor sagt nein → kein Neuladen, auch wenn der Leerlauf-Check ja sagt; kein Toast, kein Hinweis', async () => {
    const h = harness(async () => true);
    attachReloadGate({ allowsReload: () => false });
    h.needRefresh();
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(h.updateSW).not.toHaveBeenCalled();
    expect(h.showToast).not.toHaveBeenCalled();
    expect(h.showUpdateNotice).not.toHaveBeenCalled();
  });

  it('@ZM-124: Tor sagt ja → Neuladen über updateSW(true), ohne Toast und ohne Hinweis', async () => {
    const h = harness(async () => false);
    attachReloadGate({ allowsReload: () => true });
    h.needRefresh();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(h.updateSW).toHaveBeenCalledWith(true);
    expect(h.updateSW).toHaveBeenCalledTimes(1);
    expect(h.showToast).not.toHaveBeenCalled();
    expect(h.showUpdateNotice).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: Tor wirft → zählt als nein, kein Neuladen', async () => {
    const h = harness(async () => true);
    attachReloadGate({ allowsReload: () => { throw new Error('Spielstand unlesbar'); } });
    h.needRefresh();
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(h.updateSW).not.toHaveBeenCalled();
  });

  it('@ZM-124: Tor wird erst gesetzt, nachdem die neue Version schon wartet → lädt, sobald das Tor ja sagt', async () => {
    const h = harness(async () => false);
    h.needRefresh();
    expect(h.showUpdateNotice).toHaveBeenCalledTimes(1);
    let erlaubt = false;
    attachReloadGate({ allowsReload: () => erlaubt });
    await vi.advanceTimersByTimeAsync(5_000);
    expect(h.updateSW).not.toHaveBeenCalled();
    erlaubt = true;
    notifyReloadGate();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(h.updateSW).toHaveBeenCalledWith(true);
  });

  it('ohne Tor bleibt der Leerlauf-Pfad wie heute: Toast und Neuladen bei Leerlauf', async () => {
    const h = harness(async () => true);
    h.needRefresh();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(h.showToast).toHaveBeenCalledWith('Updating…');
    expect(h.updateSW).toHaveBeenCalledWith(true);
  });

  it('@ME-032: unlesbare Antwort → sofort neu laden, sobald die neue Version da ist, auch bei laufendem Spiel', async () => {
    // Die Registrierung ist beim Setup bekannt (onRegisteredSW); die neue Version findet die Prüfung.
    const update = vi.fn(async () => { h.needRefresh(); });
    const h = harness(async () => false, { update } as unknown as ServiceWorkerRegistration);
    attachReloadGate({ allowsReload: () => false });
    requestUrgentReload();
    await vi.advanceTimersByTimeAsync(0);
    expect(update).toHaveBeenCalledTimes(1);
    expect(h.updateSW).toHaveBeenCalledWith(true);
    expect(h.showToast).not.toHaveBeenCalled();
  });

  it('@ME-032 Gegenbeispiel: unlesbar, aber keine neue Version → kein Neuladen (keine Schleife)', async () => {
    const h = harness(async () => true, { update: vi.fn(async () => undefined) } as unknown as ServiceWorkerRegistration);
    requestUrgentReload();
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(h.updateSW).not.toHaveBeenCalled();
    expect(h.reload).not.toHaveBeenCalled();
  });

  it('@ME-032: die Eile gilt nur kurz; eine später gefundene Version folgt wieder dem Tor', async () => {
    const h = harness(async () => false, { update: vi.fn(async () => undefined) } as unknown as ServiceWorkerRegistration);
    requestUrgentReload();
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    attachReloadGate({ allowsReload: () => false });
    h.needRefresh();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(h.updateSW).not.toHaveBeenCalled();
  });
});
