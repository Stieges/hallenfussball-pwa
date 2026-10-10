/**
 * @OB-035 — Die Test-Route `/test-live` existiert nur im Entwicklungs-Build.
 *
 * Szenario @OB-035 (2026-10-02_oberflaeche.md), Beispielzeile 3: der Aufruf der
 * Testseite „/test-live" in der veröffentlichten App zeigt „Seite nicht gefunden".
 * App.tsx rendert genau dann „Seite nicht gefunden", wenn `matchRoute` keinen
 * Treffer liefert — die DEV-Sperre gehört deshalb in die Registry (routeRegistry.ts),
 * nicht in App.tsx (gehört bis zur Integration der anderen Spur).
 *
 * Pflichttest: Prod-Build → keine Route. Gegenbeispiel: Dev-Build → Route vorhanden.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';

describe('@OB-035 /test-live nur im Entwicklungs-Build', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('@OB-035 Prod-Build: /test-live ist nicht registriert („Seite nicht gefunden“)', async () => {
    vi.stubEnv('DEV', false);
    vi.resetModules();
    const { matchRoute } = await import('../routeRegistry');
    expect(matchRoute('/test-live')).toBeNull();
  });

  it('@OB-035 Gegenbeispiel Dev-Build: /test-live ist registriert', async () => {
    vi.stubEnv('DEV', true);
    vi.resetModules();
    const { matchRoute } = await import('../routeRegistry');
    expect(matchRoute('/test-live')).toEqual({ name: 'localTest', params: {} });
  });
});
