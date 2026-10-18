/**
 * useFoulThresholdWarning (C3b-2 F3a, M7; Cockpit 2.3: @SL-034, @SL-098): Warnung als Effekt auf den
 * Wert aus useFoulCounts – bei jedem weiteren Foul ab der Grenze 5 (auch wenn es ein Karten-/
 * Zeitstrafen-Eintrag ist), mit der Nummer des Fouls, Heim/Auswaerts getrennt.
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
    expect(warn).toHaveBeenCalledWith('FC Alpha', 5);

    rerender({ counts: { home: 5, away: 5 } });
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenLastCalledWith('SV Beta', 5);
  });

  it('@SL-098 auch über der Grenze meldet jedes weitere Foul, mit seiner Nummer', () => {
    const warn = vi.fn();
    const { rerender } = renderHook(
      ({ counts }: { counts: { home: number; away: number } }) =>
        useFoulThresholdWarning(counts, names, warn),
      { initialProps: { counts: { home: 4, away: 0 } } },
    );
    rerender({ counts: { home: 5, away: 0 } });
    rerender({ counts: { home: 6, away: 0 } });
    rerender({ counts: { home: 7, away: 0 } });
    expect(warn.mock.calls).toEqual([['FC Alpha', 5], ['FC Alpha', 6], ['FC Alpha', 7]]);
  });

  it('@SL-098 Gegenbeispiel: dieselbe Zahl beim Neuzeichnen meldet nichts, ein zurückgenommenes Foul auch nicht', () => {
    const warn = vi.fn();
    const { rerender } = renderHook(
      ({ counts }: { counts: { home: number; away: number } }) =>
        useFoulThresholdWarning(counts, names, warn),
      { initialProps: { counts: { home: 5, away: 0 } } },
    );
    rerender({ counts: { home: 5, away: 0 } });
    rerender({ counts: { home: 4, away: 0 } });
    expect(warn).not.toHaveBeenCalled();
    rerender({ counts: { home: 5, away: 0 } });
    expect(warn).toHaveBeenCalledWith('FC Alpha', 5);
  });

  it('@SL-034 Gegenbeispiel: ein Spiel, das schon mit 5 Fouls geöffnet wird, meldet nichts (nur ein neues Foul meldet)', () => {
    const warn = vi.fn();
    renderHook(() => useFoulThresholdWarning({ home: 5, away: 6 }, names, warn));
    expect(warn).not.toHaveBeenCalled();
  });

  it('@SL-098 Gegenbeispiel: Wechsel auf ein anderes Spiel mit 5 Fouls meldet nichts, erst ein neues Foul dort meldet', () => {
    const warn = vi.fn();
    const { rerender } = renderHook(
      ({ counts, matchId }: { counts: { home: number; away: number }; matchId: string }) =>
        useFoulThresholdWarning(counts, names, warn, matchId),
      { initialProps: { counts: { home: 2, away: 0 }, matchId: 'spiel-8' } },
    );
    rerender({ counts: { home: 5, away: 0 }, matchId: 'spiel-9' });
    expect(warn).not.toHaveBeenCalled();
    rerender({ counts: { home: 6, away: 0 }, matchId: 'spiel-9' });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('FC Alpha', 6);
  });
});
