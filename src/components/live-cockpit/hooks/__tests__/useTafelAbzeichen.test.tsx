/**
 * Bildschirm wach im Cockpit (Cockpit-Paket K10): @SL-059 während ein Spiel läuft, sperrt sich das Gerät nicht; @SL-060 ohne laufendes Spiel
 * gilt die Sperre des Geräts; @SL-122 kann das Gerät es nicht, steht das Abzeichen „Bildschirm kann sich sperren“, bis Tom es antippt.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { WakeLockStatus } from '../../../../hooks/useWakeLock';
import type { CockpitZustand } from '../../model/cockpitPhase';

const wake = vi.hoisted((): { enabled: boolean[]; status: WakeLockStatus } => ({ enabled: [], status: 'idle' }));
vi.mock('../../../../hooks/useWakeLock', () => ({
  useWakeLock: (enabled: boolean) => { wake.enabled.push(enabled); return { status: wake.status, isSupported: true, request: vi.fn(), release: vi.fn() }; },
}));
import { useTafelAbzeichen } from '../useTafelAbzeichen';

const t = (key: string): string => key;
const ton = { an: true, freigegeben: true, aktiviere: vi.fn() };
const melde = vi.fn();
const hook = (zustand: CockpitZustand, wachhalten = true, matchId = 'spiel-11', quittungMitFolgespiel = false) =>
  renderHook((p: { zustand: CockpitZustand }) => useTafelAbzeichen({ zustand: p.zustand, matchId, ton, wachhalten, t, quittungMitFolgespiel, melde }), { initialProps: { zustand } });

beforeEach(() => { wake.enabled = []; wake.status = 'idle'; });

describe('Bildschirm wach ab dem Anpfiff', () => {
  it.each(['laeuft', 'pausiert', 'halbzeitpause'] as const)('@SL-059 im Zustand %s fordert das Cockpit den Bildschirm an', (zustand) => {
    hook(zustand);
    expect(wake.enabled.at(-1)).toBe(true);
  });

  it.each(['vorAnpfiff', 'keinSpiel', 'wartetAufHerkunft'] as const)('@SL-060 ohne laufendes Spiel (%s) gilt die Sperre des Geräts', (zustand) => {
    hook(zustand);
    expect(wake.enabled.at(-1)).toBe(false);
  });

  it('@SL-152 nach dem Abpfiff nur während der 30-Sekunden-Quittung mit Folgespiel', () => {
    hook('abgepfiffen', true, 'spiel-11', true);
    expect(wake.enabled.at(-1)).toBe(true);
  });

  it('@SL-060 Gegenbeispiel: abgepfiffen ohne laufende Quittung, ausgefallen oder letztes Spiel des Felds → Sperre des Geräts', () => {
    hook('abgepfiffen', true, 'spiel-11', false);
    expect(wake.enabled.at(-1)).toBe(false);
  });

  it('@SL-058 „Bildschirm an lassen“ aus: auch im laufenden Spiel keine Anforderung', () => {
    hook('laeuft', false);
    expect(wake.enabled.at(-1)).toBe(false);
  });
});

describe('@SL-122 Abzeichen, wenn das Gerät den Bildschirm nicht anlassen kann', () => {
  it.each(['denied', 'unsupported', 'noAnswer'] as const)('Zusage %s → Abzeichen steht, bis Tom es antippt', (status) => {
    wake.status = status;
    const { result, rerender } = hook('laeuft');
    expect(result.current.wachhaltenHinweis?.label).toBe('tafel.wachhaltenSymbol');
    act(() => { result.current.wachhaltenHinweis?.onAntippen(); });
    rerender({ zustand: 'laeuft' });
    expect(result.current.wachhaltenHinweis).toBeNull();
    // Antippen zeigt den vollen Text in der Meldezeile (am Handy steht neben anderen Abzeichen nur das Schloss)
    expect(melde).toHaveBeenCalledWith(1, 'tafel.wachhaltenSymbol');
  });

  it('Gegenbeispiel: zugesagt → kein Abzeichen', () => {
    wake.status = 'granted';
    expect(hook('laeuft').result.current.wachhaltenHinweis).toBeNull();
  });

  it('Gegenbeispiel: vor dem Anpfiff kein Abzeichen, auch wenn das Gerät nicht kann', () => {
    wake.status = 'unsupported';
    expect(hook('vorAnpfiff').result.current.wachhaltenHinweis).toBeNull();
  });
});
