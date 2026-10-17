/**
 * useMonitors: Bildrand in Prozent (@ME-067 Vorbelegung 5 %, @ME-020 Speichern aus dem Editor).
 * Gegenbeispiel: Rand 0 % ist ein gültiger Wert und fällt nicht auf die Vorbelegung zurück.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMonitors } from '../useMonitors';
import type { Tournament } from '../../types/tournament';
import type { TournamentMonitor } from '../../types/monitor';

const monitor = (overrides: Partial<TournamentMonitor> = {}): TournamentMonitor => ({
  id: 'mon-1', name: 'Haupthalle', defaultSlideDuration: 15, transition: 'none', transitionDuration: 0, theme: 'dark',
  performanceMode: 'auto', slides: [], createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z', ...overrides,
});

const turnier = (m: TournamentMonitor[]): Tournament => ({ id: 't1', name: 'Hallencup', monitors: m }) as unknown as Tournament;

function einrichten(m: TournamentMonitor[]) {
  const speichern = vi.fn().mockResolvedValue(undefined);
  const { result } = renderHook(() => useMonitors(turnier(m), speichern));
  const gespeichert = () => (speichern.mock.calls.at(-1)?.[0] as Tournament).monitors ?? [];
  return { result, gespeichert };
}

describe('Bildrand je Monitor (@ME-067, @ME-020)', () => {
  it('@ME-067 ein neuer Monitor hat den Bildrand 5 %', async () => {
    const { result, gespeichert } = einrichten([]);
    await act(async () => { await result.current.createMonitor('Eingang'); });
    expect(gespeichert()[0].overscanPercent).toBe(5);
  });

  it('@ME-020 der im Editor eingestellte Rand 8 % wird mit dem Turnier gespeichert', async () => {
    const { result, gespeichert } = einrichten([monitor()]);
    await act(async () => { await result.current.updateMonitor('mon-1', { overscanPercent: 8 }); });
    expect(gespeichert()[0].overscanPercent).toBe(8);
  });

  it('@ME-067 Gegenbeispiel: Rand 0 % wird als 0 gespeichert, nicht als Vorbelegung', async () => {
    const { result, gespeichert } = einrichten([monitor({ overscanPercent: 8 })]);
    await act(async () => { await result.current.updateMonitor('mon-1', { overscanPercent: 0 }); });
    expect(gespeichert()[0].overscanPercent).toBe(0);
  });

  it('@ME-020 Gegenbeispiel: eine andere Einstellung lässt den gespeicherten Rand unverändert', async () => {
    const { result, gespeichert } = einrichten([monitor({ overscanPercent: 7.5 })]);
    await act(async () => { await result.current.updateMonitor('mon-1', { name: 'Eingang' }); });
    expect(gespeichert()[0]).toMatchObject({ name: 'Eingang', overscanPercent: 7.5 });
  });
});
