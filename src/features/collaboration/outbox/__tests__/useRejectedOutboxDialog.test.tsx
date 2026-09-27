/**
 * useRejectedOutboxDialog (C3a-2a Fixrunde 3, P8/E4): eigener Test fuer den aus `LiveCockpit.tsx`/
 * `AdminHeader.tsx` ausgelagerten Hook -- "Verstanden" ruft dismiss auf, ein dismiss-Fehler zeigt
 * einen Toast (statt einer unbehandelten Ablehnung) ueber die injizierte `showError`-Funktion.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const mockDismiss = vi.fn();
vi.mock('../../../match-engine/useEngineOutboxSummary', () => ({
  useEngineOutboxSummary: () => ({
    pendingCount: 3,
    rejectedCount: 1,
    reviewCount: 0,
    entries: [
      {
        event: { id: 'e1', type: 'GOAL', actor: 'helper', at: 0, section: 1, clockMs: 0, payload: {} },
        code: 'MATCH_FULL',
        rejectedAt: 0,
        matchId: 'm1',
      },
    ],
    dismiss: mockDismiss,
  }),
}));

import { useRejectedOutboxDialog } from '../useRejectedOutboxDialog';

describe('useRejectedOutboxDialog (C3a-2a Fixrunde 3, P8)', () => {
  it('reicht rejectedCount/reviewCount/pendingCount/entries aus useEngineOutboxSummary durch, Dialog startet geschlossen', () => {
    const showError = vi.fn();
    const { result } = renderHook(() => useRejectedOutboxDialog('tour-1', showError));

    expect(result.current.rejectedCount).toBe(1);
    expect(result.current.reviewCount).toBe(0);
    expect(result.current.pendingCount).toBe(3);
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.isOpen).toBe(false);
  });

  it('show()/close() oeffnen bzw. schliessen den Dialog', () => {
    const showError = vi.fn();
    const { result } = renderHook(() => useRejectedOutboxDialog('tour-1', showError));

    act(() => result.current.show());
    expect(result.current.isOpen).toBe(true);

    act(() => result.current.close());
    expect(result.current.isOpen).toBe(false);
  });

  it('handleDismiss ruft dismiss auf', async () => {
    mockDismiss.mockResolvedValueOnce(undefined);
    const showError = vi.fn();
    const { result } = renderHook(() => useRejectedOutboxDialog('tour-1', showError));

    act(() => result.current.handleDismiss(['e1']));

    await waitFor(() => expect(mockDismiss).toHaveBeenCalledWith(['e1']));
    expect(showError).not.toHaveBeenCalled();
  });

  it('ein Fehler bei dismiss() ruft die injizierte showError auf statt eine unbehandelte Ablehnung zu erzeugen', async () => {
    mockDismiss.mockRejectedValueOnce(new Error('IDB kaputt'));
    const showError = vi.fn();
    const { result } = renderHook(() => useRejectedOutboxDialog('tour-1', showError));

    act(() => result.current.handleDismiss(['e1']));

    await waitFor(() => expect(showError).toHaveBeenCalledWith('Verstanden fehlgeschlagen — bitte erneut versuchen'));
  });
});
