/**
 * useFoulThresholdWarning (C3b-2 F3a, M7): 5-Fouls-Warnung als Effekt auf den Wert aus
 * useFoulCounts – einmal je Team beim Uebergang auf >= 5 (auch wenn die 5. ein Karten-/
 * Zeitstrafen-Eintrag ist), bei 6/7 nicht erneut, Heim/Auswaerts getrennt.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFoulThresholdWarning } from '../useFoulThresholdWarning';

const names = { home: 'FC Alpha', away: 'SV Beta' };

describe('useFoulThresholdWarning (M7)', () => {
  it('4. Strafe → keine Warnung (Gegenbeispiel)', () => {
    const warn = vi.fn();
    renderHook(() => useFoulThresholdWarning({ home: 4, away: 4 }, names, warn));
    expect(warn).not.toHaveBeenCalled();
  });

  it('5. Strafe → Warnung, Heim und Auswärts getrennt je einmal', () => {
    const warn = vi.fn();
    const { rerender } = renderHook(
      ({ counts }: { counts: { home: number; away: number } }) =>
        useFoulThresholdWarning(counts, names, warn),
      { initialProps: { counts: { home: 4, away: 3 } } },
    );
    rerender({ counts: { home: 5, away: 3 } });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('FC Alpha');

    rerender({ counts: { home: 5, away: 5 } });
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenLastCalledWith('SV Beta');
  });

  it('bei 6 und 7 nicht erneut', () => {
    const warn = vi.fn();
    const { rerender } = renderHook(
      ({ counts }: { counts: { home: number; away: number } }) =>
        useFoulThresholdWarning(counts, names, warn),
      { initialProps: { counts: { home: 4, away: 0 } } },
    );
    rerender({ counts: { home: 5, away: 0 } });
    rerender({ counts: { home: 6, away: 0 } });
    rerender({ counts: { home: 7, away: 0 } });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('FC Alpha');
  });
});
