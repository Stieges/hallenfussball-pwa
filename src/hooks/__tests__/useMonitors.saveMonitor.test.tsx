/**
 * useMonitors.saveMonitor: Speichern des ganzen Monitors aus dem Editor (@ME-071, @ME-072).
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMonitors } from '../useMonitors';
import type { Tournament } from '../../types/tournament';
import type { MonitorSlide, TournamentMonitor } from '../../types/monitor';

const slide = (id: string, order: number): MonitorSlide => ({ id, type: 'live', config: {}, duration: null, order });

const monitor = (overrides: Partial<TournamentMonitor> = {}): TournamentMonitor => ({
  id: 'mon-1', name: 'Haupthalle', defaultSlideDuration: 15, transition: 'none', transitionDuration: 0, theme: 'dark',
  performanceMode: 'auto', slides: [], createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z', ...overrides,
});

const turnier = (m: TournamentMonitor[]): Tournament => ({ id: 't1', name: 'Hallencup', monitors: m }) as unknown as Tournament;

function einrichten(m: TournamentMonitor[], mitTurnier = true) {
  const speichern = vi.fn().mockResolvedValue(undefined);
  const { result } = renderHook(() => useMonitors(mitTurnier ? turnier(m) : null, speichern));
  const gespeichert = () => (speichern.mock.calls.at(-1)?.[0] as Tournament).monitors ?? [];
  return { result, speichern, gespeichert };
}

describe('saveMonitor (@ME-071, @ME-072)', () => {
  it('@ME-072 der Name „  Halle  “ wird als „Halle“ gespeichert', async () => {
    const { result, gespeichert } = einrichten([monitor()]);
    await act(async () => { await result.current.saveMonitor(monitor({ name: '  Halle  ' })); });
    expect(gespeichert()[0].name).toBe('Halle');
  });

  it('@ME-071 das Farbschema „light“ wird gespeichert', async () => {
    const { result, gespeichert } = einrichten([monitor()]);
    await act(async () => { await result.current.saveMonitor(monitor({ theme: 'light' })); });
    expect(gespeichert()[0].theme).toBe('light');
  });

  it('@ME-071 alles in EINEM Speichervorgang; Reihenfolge wird 0..n, andere Monitore bleiben', async () => {
    const anderer = monitor({ id: 'mon-2', name: 'Eingang' });
    const { result, speichern, gespeichert } = einrichten([monitor(), anderer]);
    await act(async () => {
      await result.current.saveMonitor(monitor({ slides: [slide('a', 5), slide('b', 9)], defaultSlideDuration: 30 }));
    });
    expect(speichern).toHaveBeenCalledTimes(1);
    expect(gespeichert()[0].slides.map(s => s.order)).toEqual([0, 1]);
    expect(gespeichert()[0].defaultSlideDuration).toBe(30);
    expect(gespeichert()[1]).toEqual(anderer);
  });

  it('@ME-071 Gegenbeispiel: unbekannte ID wirft und speichert nichts', async () => {
    const { result, speichern } = einrichten([monitor()]);
    await expect(result.current.saveMonitor(monitor({ id: 'mon-x' }))).rejects.toThrow();
    expect(speichern).not.toHaveBeenCalled();
  });

  it('@ME-071 Gegenbeispiel: ohne Turnier wirft es', async () => {
    const { result, speichern } = einrichten([monitor()], false);
    await expect(result.current.saveMonitor(monitor())).rejects.toThrow();
    expect(speichern).not.toHaveBeenCalled();
  });
});
