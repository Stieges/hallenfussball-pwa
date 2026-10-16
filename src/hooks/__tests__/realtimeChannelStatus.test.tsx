/**
 * A-06k (@FU-025): `trackRealtimeChannelStatus` schreibt den Kanal-Zustand eines Turniers in den
 * gemeinsamen Store, solange der Abonnent aktiv ist. Nach `stop()` (Cleanup) hinterlaesst ein spaeter
 * Rueckruf des alten Kanals keinen Zustand mehr, und der Zustand ist geloescht.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { trackRealtimeChannelStatus, useRealtimeChannelStatus } from '../realtimeChannelStatus';

const TOURNAMENT = 'tour-tracker';

describe('trackRealtimeChannelStatus (A-06k, @FU-025)', () => {
  afterEach(() => {
    trackRealtimeChannelStatus(TOURNAMENT).stop();
  });

  it('schreibt den gemeldeten Zustand in den Store, solange aktiv', () => {
    const tracker = trackRealtimeChannelStatus(TOURNAMENT);
    const view = renderHook(() => useRealtimeChannelStatus(TOURNAMENT));

    act(() => tracker.onStatusChange('CHANNEL_ERROR'));
    expect(view.result.current).toBe('CHANNEL_ERROR');
  });

  it('stop() loescht den Zustand', () => {
    const tracker = trackRealtimeChannelStatus(TOURNAMENT);
    const view = renderHook(() => useRealtimeChannelStatus(TOURNAMENT));

    act(() => tracker.onStatusChange('CLOSED'));
    act(() => tracker.stop());
    expect(view.result.current).toBeUndefined();
  });

  it('ein spaeter Rueckruf nach stop() aendert nichts (klebendes CLOSED tritt nicht auf)', () => {
    const tracker = trackRealtimeChannelStatus(TOURNAMENT);
    const view = renderHook(() => useRealtimeChannelStatus(TOURNAMENT));

    act(() => tracker.stop());
    act(() => tracker.onStatusChange('CLOSED'));
    expect(view.result.current).toBeUndefined();
  });
});
