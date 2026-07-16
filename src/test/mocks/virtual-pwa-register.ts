/**
 * Vitest-Stub für vite-plugin-pwa's virtuelles Modul (vitest.config.ts lädt
 * VitePWA nicht; der resolve.alias mappt hierher). Verhindert, dass künftige
 * App-Tests den SW-Setup-Pfad still in den catch laufen lassen.
 */
import type { RegisterSWFn } from '../../lib/swRegistration';

export const registerSW: RegisterSWFn = () => () => Promise.resolve();
