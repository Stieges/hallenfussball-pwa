/**
 * CA-5 (Plan-Review Auflage 11) – Quellen für „Monitore übernehmen“, seit die Startseiten-Liste Mitgliedschaften enthält.
 *
 * Regel (Auflage 11, @ME-043 „nur wer beide Turniere verwaltet“, @HE-085 „kann es wie Olli leiten“): Quelle sind
 * Turniere, in denen das Konto das Recht `manageScreens` hat – eigene und solche als Co-Admin. Ein Turnier, in dem es
 * nur Helfer, Trainer oder Zuschauer ist, nie. Kein Test schließt Mitglieds-Turniere als Ganzes aus.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';
import type { TournamentMonitor } from '../../../types/monitor';

const active = vi.hoisted(() => ({ current: [] as unknown[] }));
vi.mock('../../../hooks/useTournaments', () => ({
  useTournaments: () => ({ activeTournaments: active.current, loading: false }),
}));

import { MonitorTransferSheet } from '../MonitorTransferSheet';

const MONITOR = {
  id: 'mon-1', name: 'Hallenmonitor', defaultSlideDuration: 15, transition: 'fade', transitionDuration: 500,
  theme: 'dark', performanceMode: 'auto', overscanPercent: 7.5,
  slides: [{ id: 'sl-1', type: 'standings', config: {}, duration: null, order: 0 }],
  createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
} as TournamentMonitor;

function cup(id: string, myRole?: Tournament['myRole']): Tournament {
  return { id, title: id, teams: [], matches: [], monitors: [MONITOR], sponsors: [], ...(myRole === undefined ? {} : { myRole }) } as unknown as Tournament;
}

const ZIEL = cup('ziel', 'owner');

async function offered(): Promise<string[]> {
  render(<MonitorTransferSheet tournament={ZIEL} onClose={() => undefined} onApply={async () => undefined} />);
  await waitFor(() => expect(screen.getByTestId('monitor-transfer-sheet')).toBeInTheDocument());
  return screen.queryAllByTestId(/^transfer-source-/).map((el) => el.getAttribute('data-testid') ?? '');
}

describe('CA-5 Monitore übernehmen: Quelle = Turniere mit dem Recht manageScreens', () => {
  it('Co-Admin-Turnier wird als Quelle angeboten, eigenes und ohne Rolle (Gast) ebenso', async () => {
    active.current = [ZIEL, cup('nikolaus', 'co-admin'), cup('eigen', 'owner'), cup('gast')];
    expect((await offered()).sort()).toEqual(['transfer-source-eigen', 'transfer-source-gast', 'transfer-source-nikolaus']);
  });

  it.each(['collaborator', 'trainer', 'viewer'] as const)('Gegenbeispiel %s: das Turnier wird nicht als Quelle angeboten', async (role) => {
    active.current = [ZIEL, cup('eigen', 'owner'), cup('fremd', role)];
    expect(await offered()).toEqual(['transfer-source-eigen']);
  });
});
