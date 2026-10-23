import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useClockControls, type ClockControlsParams } from '../useClockControls';

function params(overrides: Partial<ClockControlsParams> = {}): ClockControlsParams {
  return {
    match: { id: 'match-11', status: 'RUNNING' }, abschnittspause: false, sound: {},
    onStart: vi.fn(), onPause: vi.fn(), onResume: vi.fn(), onStartSection: vi.fn(), onFinish: vi.fn(), ...overrides,
  };
}

describe('useClockControls', () => {
  it('starte ruft onStart mit der Spiel-ID', () => {
    const p = params({ match: { id: 'match-11', status: 'NOT_STARTED' } });
    const { result } = renderHook(() => useClockControls(p));
    act(() => result.current.starte());
    expect(p.onStart).toHaveBeenCalledWith('match-11');
  });

  it('@SL-009 der Tipp auf Anpfiff gibt den Ton frei, bevor das Spiel angepfiffen wird (Browser-Geste)', () => {
    const reihenfolge: string[] = [];
    const p = params({
      match: { id: 'match-11', status: 'NOT_STARTED' },
      sound: { aktiviere: () => { reihenfolge.push('aktiviere'); } },
      onStart: () => { reihenfolge.push('start'); },
    });
    const { result } = renderHook(() => useClockControls(p));
    act(() => result.current.starte());
    expect(reihenfolge).toEqual(['aktiviere', 'start']);
  });

  it('Pause und Weiter sind ebenfalls ein Tipp und geben den Ton frei', () => {
    const aktiviere = vi.fn();
    const p = params({ sound: { aktiviere } });
    const { result } = renderHook(() => useClockControls(p));
    act(() => result.current.pauseOderWeiter());
    expect(aktiviere).toHaveBeenCalledTimes(1);
  });

  it('pauseOderWeiter pausiert ein laufendes und setzt ein pausiertes Spiel fort', () => {
    const p = params();
    const { result, rerender } = renderHook((q: ClockControlsParams) => useClockControls(q), { initialProps: p });
    act(() => result.current.pauseOderWeiter());
    expect(p.onPause).toHaveBeenCalledWith('match-11');
    const q = { ...p, match: { id: 'match-11', status: 'PAUSED' as const } };
    rerender(q);
    act(() => result.current.pauseOderWeiter());
    expect(p.onResume).toHaveBeenCalledWith('match-11');
    expect(p.onStartSection).not.toHaveBeenCalled();
  });

  // C-COCKPIT-HALBZEIT-START: „▶ Start“ in der Halbzeitpause meldete „Spiel fortgesetzt“, die Tafel blieb auf Halbzeit.
  it('@SL-006 in der Halbzeitpause ist „Weiter“ der Wiederanpfiff (SECTION_START), nicht ein Fortsetzen', () => {
    const p = params({ match: { id: 'match-11', status: 'PAUSED' }, abschnittspause: true });
    const { result } = renderHook(() => useClockControls(p));
    act(() => result.current.pauseOderWeiter());
    expect(p.onStartSection).toHaveBeenCalledTimes(1);
    expect(p.onStartSection).toHaveBeenCalledWith('match-11');
    expect(p.onResume).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: eine Pause mitten im Abschnitt setzt fort und pfeift nicht wieder an', () => {
    const p = params({ match: { id: 'match-11', status: 'PAUSED' }, abschnittspause: false });
    const { result } = renderHook(() => useClockControls(p));
    act(() => result.current.pauseOderWeiter());
    expect(p.onResume).toHaveBeenCalledTimes(1);
    expect(p.onStartSection).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: ein beendetes Spiel wird weder pausiert noch fortgesetzt noch wieder angepfiffen', () => {
    const p = params({ match: { id: 'match-11', status: 'FINISHED' }, abschnittspause: true });
    const { result } = renderHook(() => useClockControls(p));
    act(() => result.current.pauseOderWeiter());
    expect(p.onPause).not.toHaveBeenCalled();
    expect(p.onResume).not.toHaveBeenCalled();
    expect(p.onStartSection).not.toHaveBeenCalled();
  });

  it('@FU-070 pfeifeAb ruft onFinish genau einmal und meldet die ID des gesendeten Endes weiter', async () => {
    const onFinished = vi.fn();
    const p = params({ onFinish: vi.fn().mockResolvedValue('ende-1'), onFinished });
    const { result } = renderHook(() => useClockControls(p));
    await act(async () => { result.current.pfeifeAb(); await Promise.resolve(); });
    expect(p.onFinish).toHaveBeenCalledTimes(1);
    expect(p.onFinish).toHaveBeenCalledWith('match-11');
    expect(onFinished).toHaveBeenCalledWith('ende-1');
  });

  it('B-08c Gegenbeispiel: ein abgelehntes Ende (null) oder eines ohne ID meldet keine ID weiter, es gibt keinen Pfiff', async () => {
    const onFinished = vi.fn();
    const abgelehnt = params({ onFinish: vi.fn().mockResolvedValue(null), onFinished });
    const eins = renderHook(() => useClockControls(abgelehnt));
    await act(async () => { eins.result.current.pfeifeAb(); await Promise.resolve(); });
    const ohneId = params({ onFinish: vi.fn(), onFinished });
    const zwei = renderHook(() => useClockControls(ohneId));
    await act(async () => { zwei.result.current.pfeifeAb(); await Promise.resolve(); });
    expect(onFinished).toHaveBeenNthCalledWith(1, null);
    expect(onFinished).toHaveBeenNthCalledWith(2, null);
  });

  it('B-08b Gegenbeispiel: dieser Hook beendet nie von selbst (das macht useAutoSectionEnd)', () => {
    const p = params();
    const { rerender } = renderHook((q: ClockControlsParams) => useClockControls(q), { initialProps: p });
    rerender({ ...p, match: { id: 'match-11', status: 'RUNNING' } });
    expect(p.onFinish).not.toHaveBeenCalled();
  });
});
