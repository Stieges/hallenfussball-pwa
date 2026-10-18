/**
 * UR (brief-UR.md § 4/§ 6/§ 10): Lesepfad der Urheber-Namen `match_event_author_names`.
 * Werte aus dem Gherkin (`plattform/2026-09-24_fundament-gemeinsamer-stand.md`): @FU-080 „Ergebnis eingetragen von Olli“,
 * @FU-082 „… von Olli geändert (jetzt 2:2)“; Namen-Regel (Zwilling Z1) mit denselben Fällen wie
 * `scripts/event-author-names-check.sh` (Olli Eigentümer, Maria label „Maria“ / Profil „maria.k“, Kim ohne label,
 * Lea nur Leerzeichen).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const sentry = vi.hoisted(() => ({ capture: vi.fn() }));
vi.mock('../../../lib/sentry', () => ({ captureFeatureError: sentry.capture }));

import { CLOUD_READ_TIMEOUT_MS } from '../cloudAdoption';
import { authorNameRule, readEventAuthorNames, resetEventAuthorNamesReporting } from '../eventAuthorNamesRpc';

type RpcResult = { data: unknown; error: { code?: string; message: string } | null };

function clientWith(result: Promise<RpcResult> | (() => Promise<RpcResult>)) {
  const rpc = vi.fn(() => (typeof result === 'function' ? result() : result));
  return { client: { rpc } as never, rpc };
}

const ROW_OLLI = { event_id: 'e-olli', author_name: 'Olli', author_role: 'owner' };
const ROW_MARIA = { event_id: 'e-maria', author_name: 'Maria', author_role: 'co-admin' };
const ROW_GELOESCHT = { event_id: 'e-udo', author_name: null, author_role: null };

describe('UR Zwilling Z1: authorNameRule (gleiche Fälle wie der Container-Beweis)', () => {
  it('@FU-080 Eigentümer Olli → Profilname „Olli“', () => {
    expect(authorNameRule({ isOwner: true, displayName: 'Olli' })).toBe('Olli');
  });
  it('Eigentümer: ein label zählt nicht, nur der Profilname', () => {
    expect(authorNameRule({ isOwner: true, label: 'Chef', displayName: 'Olli' })).toBe('Olli');
  });
  it('@FU-082 Mitglied Maria: label „Maria“ vor Profilname „maria.k“', () => {
    expect(authorNameRule({ isOwner: false, label: 'Maria', displayName: 'maria.k' })).toBe('Maria');
  });
  it('Gegenbeispiel: Mitglied ohne label (Kim) → Profilname „Kim“', () => {
    expect(authorNameRule({ isOwner: false, label: null, displayName: 'Kim' })).toBe('Kim');
  });
  it('Gegenbeispiel: label nur Leerzeichen → Profilname', () => {
    expect(authorNameRule({ isOwner: false, label: '  ', displayName: 'Kim' })).toBe('Kim');
  });
  it('Gegenbeispiel: label und Profilname nur Leerzeichen (Lea) → null', () => {
    expect(authorNameRule({ isOwner: false, label: '  ', displayName: '   ' })).toBeNull();
    expect(authorNameRule({ isOwner: true, displayName: '  ' })).toBeNull();
  });
  it('Namen werden getrimmt', () => {
    expect(authorNameRule({ isOwner: false, label: ' Tom ', displayName: 'tom.h' })).toBe('Tom');
  });
});

describe('UR readEventAuthorNames (Lesefunktion match_event_author_names)', () => {
  beforeEach(() => {
    sentry.capture.mockReset();
    resetEventAuthorNamesReporting();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('@FU-080/@FU-082 Antwort des Servers → Map Eintrag → { Name, Rolle }; Aufruf nur über .rpc mit der Spiel-ID', async () => {
    const { client, rpc } = clientWith(Promise.resolve({ data: [ROW_OLLI, ROW_MARIA, ROW_GELOESCHT], error: null }));
    const map = await readEventAuthorNames(client, 'spiel-7');

    expect(rpc).toHaveBeenCalledWith('match_event_author_names', { p_match_id: 'spiel-7' });
    expect(map.get('e-olli')).toEqual({ name: 'Olli', role: 'owner' });
    expect(map.get('e-maria')).toEqual({ name: 'Maria', role: 'co-admin' });
    expect(map.get('e-udo')).toEqual({ name: null, role: null });
    expect(sentry.capture).not.toHaveBeenCalled();
  });

  it('@FU-065 keine Berechtigung (0 Zeilen) → leere Map, keine Meldung', async () => {
    const { client } = clientWith(Promise.resolve({ data: [], error: null }));
    expect((await readEventAuthorNames(client, 'spiel-9')).size).toBe(0);
    expect(sentry.capture).not.toHaveBeenCalled();
  });

  it('ohne Supabase (Gast) → leere Map, kein Aufruf', async () => {
    expect((await readEventAuthorNames(null, 'spiel-9')).size).toBe(0);
  });

  it('Netzfehler (Abruf wirft) → leere Map, keine Meldung', async () => {
    const { client } = clientWith(() => Promise.reject(new TypeError('Failed to fetch')));
    expect((await readEventAuthorNames(client, 'spiel-9')).size).toBe(0);
    expect(sentry.capture).not.toHaveBeenCalled();
  });

  it('Netzfehler als Antwort ohne Fehlercode → leere Map, keine Meldung', async () => {
    const { client } = clientWith(Promise.resolve({ data: null, error: { code: '', message: 'TypeError: Failed to fetch' } }));
    expect((await readEventAuthorNames(client, 'spiel-9')).size).toBe(0);
    expect(sentry.capture).not.toHaveBeenCalled();
  });

  it('kein EXECUTE (42501, z. B. ohne Anmeldung) → leere Map, keine Meldung', async () => {
    const { client } = clientWith(Promise.resolve({ data: null, error: { code: '42501', message: 'permission denied' } }));
    expect((await readEventAuthorNames(client, 'spiel-9')).size).toBe(0);
    expect(sentry.capture).not.toHaveBeenCalled();
  });

  it('Zeitlimit → leere Map, keine Meldung', async () => {
    vi.useFakeTimers();
    const { client } = clientWith(new Promise<RpcResult>(() => undefined));
    const pending = readEventAuthorNames(client, 'spiel-9');
    await vi.advanceTimersByTimeAsync(CLOUD_READ_TIMEOUT_MS + 1);
    expect((await pending).size).toBe(0);
    expect(sentry.capture).not.toHaveBeenCalled();
  });

  it('Funktion fehlt vor F2b (PGRST202) → leere Map + genau EINE Meldung je Sitzung', async () => {
    const { client } = clientWith(() => Promise.resolve({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } }));
    expect((await readEventAuthorNames(client, 'spiel-9')).size).toBe(0);
    expect((await readEventAuthorNames(client, 'spiel-7')).size).toBe(0);
    expect(sentry.capture).toHaveBeenCalledTimes(1);
  });

  it('unerwartete Antwortform → leere Map + Meldung', async () => {
    const { client } = clientWith(Promise.resolve({ data: [{ id: 'x' }], error: null }));
    expect((await readEventAuthorNames(client, 'spiel-9')).size).toBe(0);
    expect(sentry.capture).toHaveBeenCalledTimes(1);
  });
});
