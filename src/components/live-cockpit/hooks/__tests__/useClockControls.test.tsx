import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useClockControls, type ClockControlsParams } from '../useClockControls';

function params(overrides: Partial<ClockControlsParams> = {}): ClockControlsParams {
  return {
    match: { id: 'match-11', status: 'RUNNING' }, kannSteuern: true, autoFinishEnabled: true,
    zeitAbgelaufen: false, sound: { enabled: true, play: vi.fn() }, hapticEnabled: false,
    onStart: vi.fn(), onPause: vi.fn(), onResume: vi.fn(), onFinish: vi.fn(), ...overrides,
  };
}

describe('useClockControls', () => {
  it('starte ruft onStart mit der Spiel-ID', () => {
    const p = params({ match: { id: 'match-11', status: 'NOT_STARTED' } });
    const { result } = renderHook(() => useClockControls(p));
    act(() => result.current.starte());
    expect(p.onStart).toHaveBeenCalledWith('match-11');
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
  });

  it('Gegenbeispiel: ein beendetes Spiel wird weder pausiert noch fortgesetzt', () => {
    const p = params({ match: { id: 'match-11', status: 'FINISHED' } });
    const { result } = renderHook(() => useClockControls(p));
    act(() => result.current.pauseOderWeiter());
    expect(p.onPause).not.toHaveBeenCalled();
    expect(p.onResume).not.toHaveBeenCalled();
  });

  it('pfeifeAb spielt den Ton einmal und ruft onFinish einmal', () => {
    const p = params();
    const { result } = renderHook(() => useClockControls(p));
    act(() => result.current.pfeifeAb());
    expect(p.sound.play).toHaveBeenCalledTimes(1);
    expect(p.onFinish).toHaveBeenCalledTimes(1);
  });

  it('Gegenbeispiel: bei ausgeschaltetem Ton pfeift pfeifeAb nicht, beendet aber das Spiel', () => {
    const p = params({ sound: { enabled: false, play: vi.fn() } });
    const { result } = renderHook(() => useClockControls(p));
    act(() => result.current.pfeifeAb());
    expect(p.sound.play).not.toHaveBeenCalled();
    expect(p.onFinish).toHaveBeenCalledTimes(1);
  });

  it('bei abgelaufener Zeit pfeift das steuernde Gerät automatisch ab', () => {
    const p = params({ zeitAbgelaufen: true });
    renderHook(() => useClockControls(p));
    expect(p.onFinish).toHaveBeenCalledWith('match-11');
  });

  it('der automatische Abpfiff feuert je Spiel nur einmal, auch wenn neu gerendert wird', () => {
    const p = params({ zeitAbgelaufen: true });
    const { rerender } = renderHook((q: ClockControlsParams) => useClockControls(q), { initialProps: p });
    rerender({ ...p, sound: { enabled: true, play: p.sound.play }, match: { id: 'match-11', status: 'RUNNING' } });
    expect(p.onFinish).toHaveBeenCalledTimes(1);
  });

  it('Gegenbeispiel (R4/H3): ein Gerät ohne Steuer pfeift nie automatisch ab', () => {
    const p = params({ zeitAbgelaufen: true, kannSteuern: false });
    renderHook(() => useClockControls(p));
    expect(p.onFinish).not.toHaveBeenCalled();
  });

  // C-VERLAENGERUNG-ENDET-SOFORT (#244), zerlegte Fassung: Auto-Ende nur bei wirklich abgelaufener Zeit.
  it('@TM-052 @SL-145: läuft die Verlängerung noch (Zeit nicht abgelaufen), pfeift das Gerät nicht ab; nach Ablauf genau einmal', () => {
    const p = params({ zeitAbgelaufen: false });
    const { rerender } = renderHook((q: ClockControlsParams) => useClockControls(q), { initialProps: p });
    expect(p.onFinish).not.toHaveBeenCalled();
    rerender({ ...p, zeitAbgelaufen: true });
    expect(p.onFinish).toHaveBeenCalledTimes(1);
    expect(p.onFinish).toHaveBeenCalledWith('match-11');
  });

  it('Gegenbeispiel: ein pausiertes oder beendetes Spiel pfeift trotz abgelaufener Zeit nicht ab', () => {
    const pausiert = params({ zeitAbgelaufen: true, match: { id: 'match-11', status: 'PAUSED' } });
    renderHook(() => useClockControls(pausiert));
    const beendet = params({ zeitAbgelaufen: true, match: { id: 'match-11', status: 'FINISHED' } });
    renderHook(() => useClockControls(beendet));
    expect(pausiert.onFinish).not.toHaveBeenCalled();
    expect(beendet.onFinish).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: ist das automatische Beenden ausgeschaltet, pfeift niemand ab', () => {
    const p = params({ zeitAbgelaufen: true, autoFinishEnabled: false });
    renderHook(() => useClockControls(p));
    expect(p.onFinish).not.toHaveBeenCalled();
  });

  it('@DR-019: nach dem Abpfiff und einem erneuten Lauf desselben Spiels (Verlängerung) endet auch der zweite Abschnitt automatisch', () => {
    const p = params({ zeitAbgelaufen: true });
    const { rerender } = renderHook((q: ClockControlsParams) => useClockControls(q), { initialProps: p });
    expect(p.onFinish).toHaveBeenCalledTimes(1);
    // Regelzeit ist beendet, das Spiel steht, dann beginnt die Verlängerung (gleiche Spiel-ID, Zeit läuft wieder).
    rerender({ ...p, zeitAbgelaufen: false, match: { id: 'match-11', status: 'FINISHED' } });
    rerender({ ...p, zeitAbgelaufen: false, match: { id: 'match-11', status: 'RUNNING' } });
    expect(p.onFinish).toHaveBeenCalledTimes(1);
    rerender({ ...p, zeitAbgelaufen: true, match: { id: 'match-11', status: 'RUNNING' } });
    expect(p.onFinish).toHaveBeenCalledTimes(2);
  });
});
