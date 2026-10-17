/** MonitorEditor: der Regler „Bildrand“ steht in den Einstellungen und meldet die Prozent an updateMonitor (@ME-067, @ME-020). */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MonitorEditor } from '../MonitorEditor';
import type { Tournament } from '../../../types/tournament';

const hoisted = vi.hoisted(() => ({
  monitor: {
    id: 'monitor-1', name: 'Haupthalle', defaultSlideDuration: 15, transition: 'fade', transitionDuration: 500, theme: 'dark',
    performanceMode: 'auto', slides: [], createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
    overscanPercent: undefined as number | undefined,
  },
  updateMonitor: vi.fn(),
}));

vi.mock('../../../hooks', () => ({
  useMonitors: () => ({
    getMonitorById: () => hoisted.monitor, updateMonitor: hoisted.updateMonitor, addSlide: vi.fn(), updateSlide: vi.fn(),
    removeSlide: vi.fn(), reorderSlides: vi.fn(), getDisplayUrl: () => '',
  }),
  useSponsors: () => ({ sponsors: [] }),
  useFields: () => ({ fields: [], getFieldDisplayName: (id: string) => id }),
}));

const turnier = { id: 't1', name: 'Hallencup Ost', teams: [], matches: [], groups: [], isPublic: false, monitors: [hoisted.monitor] } as unknown as Tournament;
const rendere = () => render(<MonitorEditor tournament={turnier} monitorId="monitor-1" onTournamentUpdate={vi.fn()} onClose={vi.fn()} />);

describe('MonitorEditor – Bildrand (@ME-067, @ME-020)', () => {
  beforeEach(() => { vi.clearAllMocks(); hoisted.monitor.overscanPercent = undefined; });

  it('@ME-067 ohne gespeicherten Rand steht der Regler auf 5 %', () => {
    rendere();
    expect(screen.getByTestId<HTMLInputElement>('monitor-overscan-input').value).toBe('5');
  });

  it('@ME-020 eine Änderung auf 8 % wird als overscanPercent gespeichert, nicht als Bildpunkte', () => {
    rendere();
    fireEvent.change(screen.getByTestId('monitor-overscan-input'), { target: { value: '8' } });
    expect(hoisted.updateMonitor).toHaveBeenCalledWith('monitor-1', { overscanPercent: 8 });
  });

  it('@ME-067 Gegenbeispiel: ein gespeicherter Rand 0 % bleibt 0 im Regler', () => {
    hoisted.monitor.overscanPercent = 0;
    rendere();
    expect(screen.getByTestId<HTMLInputElement>('monitor-overscan-input').value).toBe('0');
  });
});
