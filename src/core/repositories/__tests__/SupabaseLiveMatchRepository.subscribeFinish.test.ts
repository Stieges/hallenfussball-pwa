/**
 * SupabaseLiveMatchRepository.subscribe — ein FINISHED-Match darf nicht wie eine Löschung
 * behandelt werden (Task A1, Sofortschutz, gefunden beim E2E-Nachweis
 * `tests/e2e/cloud/two-devices.cloud.spec.ts`, Test "Helfer beendet das laufende Live-Cup-Spiel").
 *
 * Root cause: `persistFinalResult` setzt `live_state: null`, sobald `LiveMatch.status ===
 * 'FINISHED'` (siehe `liveMatchMappers.ts#mapLiveMatchToSupabaseUpdate`). `isMatchActive()`
 * liest ausschließlich `match_status`/`live_state` und hält eine solche Zeile deshalb für
 * INAKTIV — der Realtime-Handler unten behandelte das bisher wie eine Löschung
 * (`onMatchChange(id, null, 'DELETE')`). `useMatchExecution.ts#handleRealtimeChange` ignoriert
 * eine solche Löschung ABSICHTLICH (Kommentar dort: "Cockpit braucht beendete Spiele weiterhin").
 * Zusammen bedeutete das: ein zweites, bereits geöffnetes Cockpit (z. B. der Owner, während ein
 * Helfer das Spiel beendet) erfuhr NIE per Realtime, dass das Spiel beendet wurde — nur ein
 * manueller Reload hätte es gezeigt. Dieser Test beweist den Fix: eine Zeile mit
 * `match_status='finished'` wird trotz `live_state=null` als ECHTES Update weitergereicht.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LiveMatch } from '../../models/LiveMatch';

const hoisted = vi.hoisted(() => {
  let postgresChangesCallback: ((payload: unknown) => void) | null = null;

  const channelApi = {
    on: vi.fn((_event: string, _filter: unknown, callback: (payload: unknown) => void) => {
      postgresChangesCallback = callback;
      return channelApi;
    }),
    subscribe: vi.fn((statusCallback?: (status: string) => void) => {
      statusCallback?.('SUBSCRIBED');
      return channelApi;
    }),
  };
  const channelMock = vi.fn(() => channelApi);

  const teamsEqRemovedMock = vi.fn().mockResolvedValue({ data: [], error: null });
  const teamsEqTournamentMock = vi.fn(() => ({ eq: teamsEqRemovedMock }));
  const teamsSelectMock = vi.fn(() => ({ eq: teamsEqTournamentMock }));

  const eventsOrderMock = vi.fn().mockResolvedValue({ data: [], error: null });
  const eventsEqDeletedMock = vi.fn(() => ({ order: eventsOrderMock }));
  const eventsEqMatchMock = vi.fn(() => ({ eq: eventsEqDeletedMock }));
  const eventsSelectMock = vi.fn(() => ({ eq: eventsEqMatchMock }));

  const fromMock = vi.fn((table: string) => {
    if (table === 'teams') { return { select: teamsSelectMock }; }
    if (table === 'match_events') { return { select: eventsSelectMock }; }
    throw new Error(`unexpected table in test mock: ${table}`);
  });

  const supabaseMock = { channel: channelMock, from: fromMock, removeChannel: vi.fn() };

  return {
    channelMock,
    channelApi,
    fromMock,
    supabaseMock,
    getCallback: () => postgresChangesCallback,
  };
});

vi.mock('../../../lib/supabase', () => ({
  supabase: hoisted.supabaseMock,
  isSupabaseConfigured: true,
}));

vi.mock('../../../lib/sentry', () => ({
  captureFeatureError: vi.fn(),
}));

import { SupabaseLiveMatchRepository } from '../SupabaseLiveMatchRepository';

const baseRow = {
  id: 'match-1',
  tournament_id: 'tour-1',
  team_a_id: 'team-a',
  team_b_id: 'team-b',
  match_number: 1,
  label: null,
  phase: 'group',
  field: 1,
  scheduled_start: '2026-01-01T10:00:00.000Z',
  version: 2,
  score_a: 2,
  score_b: 1,
  duration_minutes: 15,
  timer_start_time: null,
  timer_paused_at: null,
  timer_elapsed_seconds: null,
};

describe('SupabaseLiveMatchRepository.subscribe — FINISHED wird nicht wie DELETE behandelt (Task A1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('leitet eine UPDATE-Zeile mit match_status=finished (live_state=null) als echtes Update weiter, nicht als DELETE', async () => {
    const repo = new SupabaseLiveMatchRepository();
    const onMatchChange = vi.fn();

    repo.subscribe('tour-1', { onMatchChange });

    const callback = hoisted.getCallback();
    expect(callback).toBeTruthy();

    const oldRow = { ...baseRow, match_status: 'running', live_state: { elapsedSeconds: 300, durationSeconds: 900 } };
    const newRow = { ...baseRow, match_status: 'finished', live_state: null };

    callback?.({ eventType: 'UPDATE', new: newRow, old: oldRow });
    // Der Handler ist async (IIFE) — auf die Mikrotasks warten, bevor onMatchChange geprüft wird.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(onMatchChange).toHaveBeenCalledTimes(1);
    const [calledId, calledMatch, calledEventType] = onMatchChange.mock.calls[0] as [string, LiveMatch | null, string];
    expect(calledId).toBe('match-1');
    expect(calledEventType).toBe('UPDATE');
    expect(calledMatch).not.toBeNull();
    expect(calledMatch?.status).toBe('FINISHED');
    expect(calledMatch?.homeScore).toBe(2);
    expect(calledMatch?.awayScore).toBe(1);
  });

  it('Regression: eine wirklich inaktive Zeile (zurückgesetzt, kein live_state, nicht finished) bleibt ein DELETE-Signal', async () => {
    const repo = new SupabaseLiveMatchRepository();
    const onMatchChange = vi.fn();

    repo.subscribe('tour-1', { onMatchChange });
    const callback = hoisted.getCallback();

    const oldRow = { ...baseRow, match_status: 'running', live_state: { elapsedSeconds: 100, durationSeconds: 900 } };
    const newRow = { ...baseRow, match_status: 'scheduled', live_state: null };

    callback?.({ eventType: 'UPDATE', new: newRow, old: oldRow });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(onMatchChange).toHaveBeenCalledTimes(1);
    expect(onMatchChange).toHaveBeenCalledWith('match-1', null, 'DELETE');
  });
});
