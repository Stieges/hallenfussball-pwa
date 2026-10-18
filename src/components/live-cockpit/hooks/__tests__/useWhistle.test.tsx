/**
 * useWhistle (B-08c): einzige Quelle für Abpfiff-Ton und Vibration, genau einmal je gesendetem Ende-Ereignis
 * dieses Geräts. Testwerte aus @SL-009 (genau einmal Ton), @SL-062 (Ton und Vibration), @SL-063 (Ton aus),
 * @SL-005 (Ton beim Abschnittsende), @FU-070 (zweites Auslösen, kein zweiter Ton), @SL-125 (Vibration bleibt).
 */
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWhistle, type WhistleOptions } from '../useWhistle';

const vibrate = vi.fn();
beforeEach(() => {
  vibrate.mockReset();
  Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true, writable: true });
});
afterEach(() => {
  Reflect.deleteProperty(navigator, 'vibrate');
});

function optionen(overrides: Partial<WhistleOptions> = {}): WhistleOptions {
  return { soundEnabled: true, hapticEnabled: true, play: vi.fn(), ...overrides };
}

describe('useWhistle', () => {
  it('@SL-062 Abpfiff: Ton einmal und Vibration einmal', () => {
    const o = optionen();
    const { result } = renderHook(() => useWhistle(o));
    result.current.pfeife('end-1', 'spiel');
    expect(o.play).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it('@SL-005 Abschnittsende: Ton einmal, Gegenbeispiel: keine Vibration', () => {
    const o = optionen();
    const { result } = renderHook(() => useWhistle(o));
    result.current.pfeife('end-1', 'abschnitt');
    expect(o.play).toHaveBeenCalledTimes(1);
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('@FU-070 @SL-009 dasselbe Ende ein zweites Mal gemeldet: kein zweiter Ton, keine zweite Vibration', () => {
    const o = optionen();
    const { result, rerender } = renderHook(() => useWhistle(o));
    result.current.pfeife('end-1', 'spiel');
    rerender();
    result.current.pfeife('end-1', 'spiel');
    expect(o.play).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it('Gegenbeispiel: zwei verschiedene Enden (Abschnitt, dann Spiel) pfeifen je einmal', () => {
    const o = optionen();
    const { result } = renderHook(() => useWhistle(o));
    result.current.pfeife('end-1', 'abschnitt');
    result.current.pfeife('end-2', 'spiel');
    expect(o.play).toHaveBeenCalledTimes(2);
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it('Gegenbeispiel: ohne gesendetes Ereignis (abgelehnt, nichts gespeichert) bleibt es still', () => {
    const o = optionen();
    const { result } = renderHook(() => useWhistle(o));
    result.current.pfeife(null, 'spiel');
    expect(o.play).not.toHaveBeenCalled();
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('@SL-063 @SL-125 Ton aus: kein Ton, die Vibration bleibt', () => {
    const o = optionen({ soundEnabled: false });
    const { result } = renderHook(() => useWhistle(o));
    result.current.pfeife('end-1', 'spiel');
    expect(o.play).not.toHaveBeenCalled();
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it('Vibration aus oder nicht möglich: kein Aufruf, kein Wurf', () => {
    const aus = optionen({ hapticEnabled: false });
    const { result } = renderHook(() => useWhistle(aus));
    result.current.pfeife('end-1', 'spiel');
    expect(vibrate).not.toHaveBeenCalled();
    Reflect.deleteProperty(navigator, 'vibrate');
    const ohne = optionen();
    const { result: r2 } = renderHook(() => useWhistle(ohne));
    expect(() => { r2.current.pfeife('end-2', 'spiel'); }).not.toThrow();
    expect(ohne.play).toHaveBeenCalledTimes(1);
  });

  it('Neuladen: ein neuer Hook (neue Seite) pfeift nur für Ereignisse, die er selbst meldet', () => {
    const o = optionen();
    const erste = renderHook(() => useWhistle(o));
    erste.result.current.pfeife('end-1', 'spiel');
    erste.unmount();
    const nachNeuladen = renderHook(() => useWhistle(o));
    expect(o.play).toHaveBeenCalledTimes(1);
    expect(nachNeuladen.result.current.pfeife).toBeTypeOf('function');
  });
});
