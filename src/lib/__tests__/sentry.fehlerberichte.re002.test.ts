/**
 * @RE-002 Fehlerberichte laufen ohne Einwilligung, ohne IP-Adresse, ohne Sitzungsaufzeichnung und lassen sich abschalten.
 * Szenario: docs/anforderungen/2026-10-03_recht-impressum-datenschutz.md – „Fehlerberichte laufen ohne Einwilligung, ohne IP-Adresse
 * und lassen sich abschalten“. Geprüft wird, was `Sentry.init` bekommt und was `beforeSend` durchlässt.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ErrorEvent, EventHint } from '@sentry/react';

const { init, close, replayIntegration } = vi.hoisted(() => ({ init: vi.fn(), close: vi.fn(async () => true), replayIntegration: vi.fn(() => ({ name: 'Replay' })) }));
vi.mock('@sentry/react', () => ({ init, close, replayIntegration }));

interface InitOptionen {
  sendDefaultPii?: boolean;
  integrations?: unknown[];
  replaysSessionSampleRate?: number;
  replaysOnErrorSampleRate?: number;
  beforeSend: (event: ErrorEvent, hint: EventHint) => ErrorEvent | null;
}

function speicher(vorher: Record<string, string> = {}): Storage {
  const daten = new Map<string, string>(Object.entries(vorher));
  return {
    get length() { return daten.size; }, clear: () => daten.clear(), getItem: (k) => daten.get(k) ?? null,
    key: (i) => [...daten.keys()][i] ?? null, removeItem: (k) => { daten.delete(k); }, setItem: (k, v) => { daten.set(k, String(v)); },
  };
}

async function starte(vorher: Record<string, string> = {}) {
  vi.resetModules();
  init.mockClear();
  close.mockClear();
  vi.stubGlobal('localStorage', speicher(vorher));
  vi.stubEnv('PROD', true);
  vi.stubEnv('DEV', false);
  vi.stubEnv('VITE_SENTRY_DSN', 'https://key@o0.ingest.de.example/1');
  const modul = await import('../sentry');
  modul.initSentry();
  return modul;
}

const ereignis = (zusatz: Partial<ErrorEvent> = {}): ErrorEvent => ({ type: undefined, message: 'Fehler', ...zusatz });

beforeEach(() => { vi.stubGlobal('__BUILD_HASH__', 'testhash'); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('@RE-002 Fehlerberichte ohne Einwilligung', () => {
  it('frischer Besuch ohne jede Zustimmung: Sentry startet', async () => {
    await starte();
    expect(init).toHaveBeenCalledTimes(1);
  });

  it('keine Sitzungsaufzeichnung: keine Replay-Integration, keine Replay-Abtastung', async () => {
    await starte();
    const optionen = init.mock.calls[0][0] as InitOptionen;
    expect(replayIntegration).not.toHaveBeenCalled();
    expect(optionen.integrations ?? []).toEqual([]);
    expect(optionen.replaysSessionSampleRate).toBeUndefined();
    expect(optionen.replaysOnErrorSampleRate).toBeUndefined();
  });

  it('keine Standard-Personendaten (sendDefaultPii aus)', async () => {
    await starte();
    expect((init.mock.calls[0][0] as InitOptionen).sendDefaultPii).toBe(false);
  });

  it('der Bericht enthält keine IP-Adresse, keine E-Mail, keinen Namen; nur die zufällige Kennung bleibt', async () => {
    await starte();
    const { beforeSend } = init.mock.calls[0][0] as InitOptionen;
    const bericht = beforeSend(ereignis({ user: { id: 'u-1', ip_address: '203.0.113.7', email: 'a@b.de', username: 'Petra' } }), {});
    expect(bericht?.user).toEqual({ id: 'u-1' });
    expect(JSON.stringify(bericht)).not.toContain('203.0.113.7');
  });

  it('Gegenbeispiel: ohne Nutzerkennung entfällt das ganze Nutzerobjekt (auch eine IP allein)', async () => {
    await starte();
    const { beforeSend } = init.mock.calls[0][0] as InitOptionen;
    const bericht = beforeSend(ereignis({ user: { ip_address: '{{auto}}' } }), {});
    expect(bericht?.user).toBeUndefined();
  });
});

describe('@RE-002 Fehlerberichte abschalten', () => {
  it('aus gespeichert (Gerät hat abgeschaltet, Seite neu geladen): Sentry startet nicht, es wird nichts gesendet', async () => {
    await starte({ 'app:errorReports': 'off' });
    expect(init).not.toHaveBeenCalled();
  });

  it('Schalter ausschalten: der laufende Client wird geschlossen und startet nicht wieder', async () => {
    const modul = await starte();
    expect(init).toHaveBeenCalledTimes(1);
    localStorage.setItem('app:errorReports', 'off');
    await modul.applyErrorReportingPreference();
    expect(close).toHaveBeenCalledTimes(1);
    expect(init).toHaveBeenCalledTimes(1);
  });

  it('Ereignis, das nach dem Ausschalten noch ankommt, wird verworfen', async () => {
    await starte();
    const { beforeSend } = init.mock.calls[0][0] as InitOptionen;
    localStorage.setItem('app:errorReports', 'off');
    expect(beforeSend(ereignis(), {})).toBeNull();
  });

  it('Schalter wieder einschalten: Sentry startet erneut (Gegenbeispiel)', async () => {
    const modul = await starte({ 'app:errorReports': 'off' });
    expect(init).not.toHaveBeenCalled();
    localStorage.removeItem('app:errorReports');
    await modul.applyErrorReportingPreference();
    expect(init).toHaveBeenCalledTimes(1);
  });
});
