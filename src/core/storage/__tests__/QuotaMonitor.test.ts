import { describe, it, expect, afterEach, vi } from 'vitest';
import { getQuotaStatus, logQuotaStatus } from '../QuotaMonitor';

/**
 * @FU-004 – Speicher-Teil: Warnstufen des Speicherverbrauchs.
 * Die Browser-Schätzung (navigator.storage.estimate) wird je Test vorgegeben.
 */

function stubEstimate(impl: () => Promise<unknown>): void {
  vi.stubGlobal('navigator', { storage: { estimate: vi.fn(impl) } });
}

describe('QuotaMonitor – Warnstufen (@FU-004)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('liefert null, wenn die Storage-API nicht verfügbar ist', async () => {
    stubEstimate(() => Promise.reject(new Error('not supported')));

    await expect(getQuotaStatus()).resolves.toBeNull();
  });

  it('liefert null, wenn die Schätzung keine Zahlen enthält', async () => {
    stubEstimate(() => Promise.resolve({ usage: undefined, quota: undefined }));

    await expect(getQuotaStatus()).resolves.toBeNull();
  });

  it('unter 80 % weder Warnung noch Kritisch', async () => {
    stubEstimate(() => Promise.resolve({ usage: 50, quota: 100 }));

    await expect(getQuotaStatus()).resolves.toEqual({
      usage: 50,
      quota: 100,
      percentage: 50,
      isWarning: false,
      isCritical: false,
    });
  });

  it('ab 80 % Warnung, aber noch nicht kritisch', async () => {
    stubEstimate(() => Promise.resolve({ usage: 85, quota: 100 }));

    const status = await getQuotaStatus();

    expect(status?.isWarning).toBe(true);
    expect(status?.isCritical).toBe(false);
  });

  it('ab 95 % kritisch', async () => {
    stubEstimate(() => Promise.resolve({ usage: 96, quota: 100 }));

    const status = await getQuotaStatus();

    expect(status?.isWarning).toBe(true);
    expect(status?.isCritical).toBe(true);
  });

  it('Quota 0 ergibt 0 % statt Division durch null', async () => {
    stubEstimate(() => Promise.resolve({ usage: 0, quota: 0 }));

    const status = await getQuotaStatus();

    expect(status?.percentage).toBe(0);
    expect(status?.isWarning).toBe(false);
  });

  it('logQuotaStatus meldet „API not supported“, wenn keine Schätzung vorliegt', async () => {
    stubEstimate(() => Promise.reject(new Error('not supported')));
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await logQuotaStatus();

    expect(logSpy).toHaveBeenCalledWith('📊 Storage Quota: API not supported');
  });

  it('logQuotaStatus formatiert Verbrauch und Prozent', async () => {
    stubEstimate(() => Promise.resolve({ usage: 512 * 1024, quota: 1024 * 1024 }));
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await logQuotaStatus();

    expect(logSpy).toHaveBeenCalledWith('🟢 Storage: 512.0 KB / 1.0 MB (50.0%)');
  });
});
