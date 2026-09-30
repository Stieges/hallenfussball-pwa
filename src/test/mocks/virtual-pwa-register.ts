/**
 * Vitest-Stub für vite-plugin-pwa's virtuelles Modul (vitest.config.ts lädt
 * VitePWA nicht; der resolve.alias mappt hierher). Verhindert, dass künftige
 * App-Tests den SW-Setup-Pfad still in den catch laufen lassen.
 */
import { vi } from 'vitest';
import type { RegisterSWFn, RegisterSWOptions } from '../../lib/swRegistration';

export const updateSWMock = vi
  .fn<(reloadPage?: boolean) => Promise<void>>()
  .mockResolvedValue(undefined);

let lastOptions: RegisterSWOptions | undefined;

export const registerSWMock = vi.fn<(options?: RegisterSWOptions) => ReturnType<RegisterSWFn>>(
  (options) => {
    lastOptions = options;
    return updateSWMock;
  },
);

export const registerSW: RegisterSWFn = registerSWMock;

/** Test-Auslöser: meldet „neue Version verfügbar“ wie vite-plugin-pwa. */
export function __fireNeedRefresh(): void {
  lastOptions?.onNeedRefresh?.();
}

/** Test-Auslöser: meldet die abgeschlossene Registrierung wie vite-plugin-pwa. */
export function __fireRegisteredSW(
  registration: ServiceWorkerRegistration | undefined,
): void {
  lastOptions?.onRegisteredSW?.('sw.js', registration);
}
