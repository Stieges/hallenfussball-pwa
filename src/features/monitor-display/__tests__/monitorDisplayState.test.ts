/** B-16b1 – Zustandsregeln des Monitors (rein). Regeln aus MonitorDisplayPage.loadData. */
import { describe, it, expect } from 'vitest';
import type { Tournament } from '../../../types/tournament';
import type { TournamentMonitor } from '../../../types/monitor';
import type { DisplayDelta } from '../monitorDataSource';
import {
  applyDelta,
  applyFetchError,
  initialDisplayState,
  type MonitorDisplayState,
} from '../monitorDisplayState';

const tournament = { id: 'tour-1', title: 'Turnier', teams: [], matches: [] } as unknown as Tournament;
const monitor = { id: 'mon-1', name: 'Haupthalle' } as unknown as TournamentMonitor;
const ctx = { tournamentId: 'tour-1', monitorId: 'mon-1', now: 4242 };

const withData = (origin: 'cloud' | 'local'): MonitorDisplayState => ({
  ...initialDisplayState,
  tournament,
  monitor,
  origin,
  loading: false,
  hasData: true,
  lastFetch: 1000,
});

const snapshot = (origin: 'cloud' | 'local', lookupFailed: boolean, mon: TournamentMonitor | null = monitor): DisplayDelta => ({
  kind: 'snapshot',
  version: null,
  tournament,
  monitor: mon,
  origin,
  lookupFailed,
});

const CONNECTION = 'Turnier konnte nicht geladen werden: Verbindung zum Server fehlgeschlagen. Der nächste Versuch läuft automatisch.';
const NOT_FOUND = 'Turnier nicht gefunden: tour-1. Läuft dieser Bildschirm auf einem anderen Gerät als der Organisator-Laptop, muss das Turnier in den Sichtbarkeits-Einstellungen auf "Mit Link teilbar" stehen.';

describe('applyDelta – Lade-Regeln', () => {
  it('(1) missing + Daten + lookupFailed → gleiche Referenz', () => {
    const state = withData('local');
    expect(applyDelta(state, { kind: 'missing', lookupFailed: true }, ctx)).toBe(state);
  });

  it('(2) missing + lookupFailed ohne Daten → Verbindungs-Text', () => {
    const next = applyDelta(initialDisplayState, { kind: 'missing', lookupFailed: true }, ctx);
    expect(next.error).toBe(CONNECTION);
    expect(next.loading).toBe(false);
    expect(next.hasData).toBe(false);
  });

  it('(3) missing ohne lookupFailed → „Turnier nicht gefunden“, auch mit Daten (bestätigt weg)', () => {
    const next = applyDelta(withData('cloud'), { kind: 'missing', lookupFailed: false }, ctx);
    expect(next.error).toBe(NOT_FOUND);
    expect(next.loading).toBe(false);
    const fresh = applyDelta(initialDisplayState, { kind: 'missing', lookupFailed: false }, ctx);
    expect(fresh.error).toBe(NOT_FOUND);
  });

  it('(4) F-324: lokaler Snapshot + lookupFailed + Daten + Stand cloud → gleiche Referenz', () => {
    const state = withData('cloud');
    expect(applyDelta(state, snapshot('local', true), ctx)).toBe(state);
  });

  it('(4) Gegenprobe N1: dasselbe mit Stand local → übernimmt', () => {
    const next = applyDelta(withData('local'), snapshot('local', true), ctx);
    expect(next).not.toBe(withData('local'));
    expect(next.origin).toBe('local');
    expect(next.lastFetch).toBe(4242);
  });

  it('(5) monitor null → „Monitor nicht gefunden“, auch mit Daten', () => {
    const next = applyDelta(withData('cloud'), snapshot('cloud', false, null), ctx);
    expect(next.error).toBe('Monitor nicht gefunden: mon-1');
    expect(next.loading).toBe(false);
  });

  it('(6) Erfolg → Daten, error null, lastFetch = now', () => {
    const next = applyDelta({ ...initialDisplayState, error: 'alt' }, snapshot('cloud', false), ctx);
    expect(next.tournament).toBe(tournament);
    expect(next.monitor).toBe(monitor);
    expect(next.origin).toBe('cloud');
    expect(next.error).toBeNull();
    expect(next.lastFetch).toBe(4242);
    expect(next.loading).toBe(false);
    expect(next.hasData).toBe(true);
  });

  it('unchanged → gleiche Referenz', () => {
    const state = withData('cloud');
    expect(applyDelta(state, { kind: 'unchanged' }, ctx)).toBe(state);
  });
});

describe('applyFetchError', () => {
  it('(7) ohne Daten → Fehler, loading false', () => {
    const next = applyFetchError(initialDisplayState, new Error('Netz weg'));
    expect(next.error).toBe('Netz weg');
    expect(next.loading).toBe(false);
  });

  it('(7) mit Daten → gleiche Referenz', () => {
    const state = withData('cloud');
    expect(applyFetchError(state, new Error('Netz weg'))).toBe(state);
  });

  it('Nicht-Error-Wert → Standardtext', () => {
    expect(applyFetchError(initialDisplayState, 'kaputt').error).toBe('Fehler beim Laden');
  });
});
