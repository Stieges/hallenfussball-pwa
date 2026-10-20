/**
 * useVerbinden (@SL-168, A-06h): „Verbinden“ meldet erneut an UND überträgt sofort die wartenden Einträge – beides, aus einer Quelle.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useVerbinden } from '../useVerbinden';

const reconnect = vi.fn().mockResolvedValue(undefined);
const resyncNow = vi.fn().mockResolvedValue(undefined);
vi.mock('../../auth/hooks/useAuth', () => ({ useAuth: () => ({ reconnect }) }));
vi.mock('../useResyncNow', () => ({ useResyncNow: () => resyncNow }));

describe('useVerbinden', () => {
  it('@SL-168 ruft reconnect und resyncNow je einmal auf', () => {
    const { result } = renderHook(() => useVerbinden());
    result.current();
    expect(reconnect).toHaveBeenCalledTimes(1);
    expect(resyncNow).toHaveBeenCalledTimes(1);
  });

  it('@SL-168 Gegenbeispiel: ohne Aufruf passiert nichts', () => {
    reconnect.mockClear(); resyncNow.mockClear();
    renderHook(() => useVerbinden());
    expect(reconnect).not.toHaveBeenCalled();
    expect(resyncNow).not.toHaveBeenCalled();
  });
});
