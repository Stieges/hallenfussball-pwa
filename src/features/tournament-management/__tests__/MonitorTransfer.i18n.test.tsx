/**
 * Monitore übernehmen – Meldetexte mit echtem i18n (B-22, Fixrunde F3/F5).
 * Der globale Passthrough-Mock aus src/test/setup.ts würde die Texte nicht prüfen (siehe TabellenTab.placementLogic).
 * @see docs/anforderungen/2026-10-03_monitor-einrichten.md (@ME-041, @ME-042)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MonitorsConfigTab } from '../MonitorsConfigTab';
import type { Tournament } from '../../../types/tournament';
import type { TournamentMonitor } from '../../../types/monitor';
import { createRealI18nWrapper } from './placementLogicTestHelpers';

vi.unmock('i18next');
vi.unmock('react-i18next');

const { mockActive } = vi.hoisted(() => ({ mockActive: { current: [] as unknown[] } }));

vi.mock('../../../hooks', async () => {
  const mod = await import('../../../hooks/useMonitors');
  return { useMonitors: mod.useMonitors };
});

vi.mock('../../../hooks/useTournaments', () => ({
  useTournaments: () => ({ activeTournaments: mockActive.current, loading: false }),
}));

vi.mock('../../auth/hooks/useMyTournamentRole', () => ({
  useMyTournamentRole: () => ({ role: 'owner' }),
}));

vi.mock('../../../hooks/useMonitorHeartbeats', () => ({
  useMonitorHeartbeats: () => new Map(),
}));

function sponsorMonitor(): TournamentMonitor {
  return {
    id: 'mon-nord',
    name: 'Hallenmonitor Halle',
    defaultSlideDuration: 15,
    transition: 'fade',
    transitionDuration: 500,
    theme: 'dark',
    performanceMode: 'auto',
    slides: [
      { id: 'sl-1', type: 'sponsor', config: { sponsorId: 'sp-nord' }, duration: null, order: 0 },
      { id: 'sl-2', type: 'standings', config: {}, duration: null, order: 1 },
    ],
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };
}

const nord = {
  id: 'nord',
  title: 'Hallencup Nord',
  monitors: [sponsorMonitor()],
  sponsors: [{ id: 'sp-nord', name: 'Bäckerei Krume' }],
} as unknown as Tournament;

const sued = { id: 'sued', title: 'Hallencup Süd', monitors: [], sponsors: [] } as unknown as Tournament;

function jsonFile(body: unknown): File {
  return new File([JSON.stringify(body)], 'monitore.json', { type: 'application/json' });
}

async function renderWithI18n(target: Tournament, onUpdate = vi.fn().mockResolvedValue(undefined)) {
  const Wrapper = await createRealI18nWrapper();
  render(
    <Wrapper>
      <MonitorsConfigTab tournament={target} onTournamentUpdate={onUpdate} />
    </Wrapper>
  );
  return onUpdate;
}

describe('Monitore übernehmen – Texte (echtes i18n)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActive.current = [nord, sued];
  });

  it('@ME-041 zeigt den Hinweis zum fehlenden Sponsor wörtlich', async () => {
    const onUpdate = await renderWithI18n(sued);
    await userEvent.click(screen.getByTestId('monitors-transfer-open'));
    await userEvent.click(await screen.findByTestId('transfer-source-nord'));
    await userEvent.click(screen.getByTestId('transfer-confirm'));

    expect(await screen.findByText('Sponsor „Bäckerei Krume“ fehlt in diesem Turnier – Folie nicht übernommen')).toBeInTheDocument();
    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
  });

  it('@ME-042 zeigt die Meldung wörtlich und ändert nichts', async () => {
    const onUpdate = await renderWithI18n(sued);
    await userEvent.click(screen.getByTestId('monitors-transfer-open'));
    await userEvent.upload(screen.getByTestId('transfer-file'), jsonFile({ hallo: 'welt' }));

    expect(await screen.findByText('Diese Datei enthält keine Monitor-Einstellungen')).toBeInTheDocument();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('zählt Monitore und Folien getrennt im Plural (1 Monitor mit 4 Folien)', async () => {
    await renderWithI18n(sued);
    await userEvent.click(screen.getByTestId('monitors-transfer-open'));
    await userEvent.click(screen.getByTestId('transfer-template'));

    expect(screen.getByTestId('transfer-summary')).toHaveTextContent('1 Monitor mit 4 Folien');
  });

  it('nennt die Größenbegrenzung aus der Konstante (256 KB)', async () => {
    const onUpdate = await renderWithI18n(sued);
    await userEvent.click(screen.getByTestId('monitors-transfer-open'));
    const big = new File(['x'.repeat(256 * 1024 + 1)], 'gross.json', { type: 'application/json' });
    await userEvent.upload(screen.getByTestId('transfer-file'), big);

    expect(await screen.findByTestId('transfer-file-error')).toHaveTextContent('maximal 256 KB');
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('speichert die Vorlage unter dem übersetzten Namen „Hallen-Standard“', async () => {
    const onUpdate = await renderWithI18n(sued);
    await userEvent.click(screen.getByTestId('monitors-transfer-open'));
    await userEvent.click(screen.getByTestId('transfer-template'));
    await userEvent.click(screen.getByTestId('transfer-confirm'));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    const saved = onUpdate.mock.calls[0][0] as Tournament;
    expect(saved.monitors?.[0].name).toBe('Hallen-Standard');
    expect(saved.monitors?.[0].slides[2].type).toBe('all-standings');
  });
});
