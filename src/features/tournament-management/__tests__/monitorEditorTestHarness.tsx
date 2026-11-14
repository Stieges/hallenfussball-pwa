/**
 * Gemeinsamer Aufbau der Monitor-Editor-Tests mit echten Hooks und echten deutschen Texten (@ME-075, @ME-076).
 * Die Testdatei hebt die i18n-Mocks selbst auf (`vi.unmock`) und ruft `initRealDeI18n()` auf.
 */
import { vi } from 'vitest';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Tournament } from '../../../types/tournament';
import { createMockTournament } from '../../../test/factories';
import type { MonitorSlide, TournamentMonitor } from '../../../types/monitor';
import { ToastProvider } from '../../../components/ui/Toast';
import { MonitorEditor } from '../MonitorEditor';

export const monitor = (slides: MonitorSlide[] = [], overrides: Partial<TournamentMonitor> = {}): TournamentMonitor => ({
  id: 'mon-1', name: 'Haupthalle', defaultSlideDuration: 15, transition: 'fade', transitionDuration: 500, theme: 'dark',
  performanceMode: 'auto', slides, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z', ...overrides,
});

export const slide = (id: string, type: MonitorSlide['type'], config: MonitorSlide['config'] = {}): MonitorSlide => (
  { id, type, config, duration: null, order: 0 }
);

/** „Nikolaus-Fall“: ein Feld, sechs Teams, keine Gruppen */
export const nikolaus = (m: TournamentMonitor, extra: Partial<Tournament> = {}): Tournament => createMockTournament({
  id: 't1', title: 'Nikolaus-Turnier', groupSystem: 'roundRobin', numberOfFields: 1, numberOfGroups: 1, groups: [],
  teams: ['Waging', 'Fridol', 'Pettin', 'Kammer', 'Otting', 'Tittmoning'].map((name, i) => ({ id: `team-${i}`, name })),
  matches: [], sponsors: [], monitors: [m], ...extra,
});

export function oeffneEditor(tournament: Tournament, monitorId = 'mon-1') {
  const onUpdate = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  const user = userEvent.setup();
  render(
    <ToastProvider>
      <MonitorEditor tournament={tournament} monitorId={monitorId} onTournamentUpdate={onUpdate} onClose={onClose} />
    </ToastProvider>
  );
  const gespeichert = (): TournamentMonitor => {
    const aufruf = onUpdate.mock.calls.at(-1)?.[0] as Tournament;
    return aufruf.monitors!.find(m => m.id === monitorId)!;
  };
  return { user, onUpdate, onClose, gespeichert };
}
