/**
 * GA4 A-13b-C Punkt 5: `useRealtimeTournament` reicht Änderungen an Abschlüssen, Folgen-Hinweisen und Klärungen an `onUpdate`
 * weiter – damit lädt `useTournamentManager` neu (@TM-116: ein anderes Gerät hat die Gruppe abgeschlossen oder wieder geöffnet).
 */
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock('../../core/realtime', () => ({
  realtimeService: { subscribeTournament: hoisted.subscribe, unsubscribeTournament: hoisted.unsubscribe, pause: vi.fn(), resume: vi.fn() },
}));
vi.mock('../../lib/supabase', () => ({ isSupabaseConfigured: true }));
vi.mock('../realtimeChannelStatus', () => ({
  trackRealtimeChannelStatus: () => ({ onStatusChange: vi.fn(), stop: vi.fn() }),
  tournamentChannelStatusKey: (id: string) => `tournament:${id}`,
}));

import { useRealtimeTournament } from '../useRealtimeTournament';

describe('useRealtimeTournament: Gruppenabschluss (A-13b-C Punkt 5)', () => {
  it('@TM-116 eine Änderung an group_completions, bracket_notices oder clarifications löst onUpdate aus', () => {
    const onUpdate = vi.fn();
    renderHook(() => useRealtimeTournament('t1', { onUpdate }));
    const options = hoisted.subscribe.mock.calls[0][0] as { onBracketChange: (payload: unknown) => void };
    expect(options.onBracketChange).toEqual(expect.any(Function));
    for (const table of ['group_completions', 'bracket_notices', 'clarifications']) {
      options.onBracketChange({ eventType: 'UPDATE', table });
    }
    expect(onUpdate).toHaveBeenCalledTimes(3);
  });

  it('der eigene Rückruf onBracketChange bekommt die Änderung ebenfalls', () => {
    const onBracketChange = vi.fn();
    renderHook(() => useRealtimeTournament('t1', { onBracketChange }));
    (hoisted.subscribe.mock.calls.at(-1)?.[0] as { onBracketChange: (payload: unknown) => void }).onBracketChange({ table: 'clarifications' });
    expect(onBracketChange).toHaveBeenCalledWith({ table: 'clarifications' });
  });
});
