/**
 * Monitore übernehmen – Meldetexte B-22b mit echtem i18n (@ME-061, @ME-062, @ME-063).
 * Der globale Passthrough-Mock aus src/test/setup.ts würde die Texte nicht prüfen.
 * @see docs/anforderungen/2026-10-03_monitor-einrichten.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MonitorsConfigTab } from '../MonitorsConfigTab';
import { MonitorEditor } from '../MonitorEditor';
import type { Tournament } from '../../../types/tournament';
import type { TournamentMonitor } from '../../../types/monitor';
import { createRealI18nWrapper } from './placementLogicTestHelpers';

vi.unmock('i18next');
vi.unmock('react-i18next');

const { mockActive } = vi.hoisted(() => ({ mockActive: { current: [] as unknown[] } }));

vi.mock('../../../hooks', async () => {
  const monitors = await import('../../../hooks/useMonitors');
  const sponsors = await import('../../../hooks/useSponsors');
  const fields = await import('../../../hooks/useFields');
  return { useMonitors: monitors.useMonitors, useSponsors: sponsors.useSponsors, useFields: fields.useFields };
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

function monitor(overrides: Partial<TournamentMonitor>): TournamentMonitor {
  return {
    id: 'mon-nord',
    name: 'Halle',
    defaultSlideDuration: 15,
    transition: 'fade',
    transitionDuration: 500,
    theme: 'dark',
    performanceMode: 'auto',
    slides: [],
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

function tournament(overrides: Partial<Tournament> & { id: string }): Tournament {
  return { title: overrides.id, teams: [], matches: [], monitors: [], sponsors: [], ...overrides } as unknown as Tournament;
}

const nord = tournament({
  id: 'nord',
  title: 'Hallencup Nord',
  monitors: [monitor({
    name: 'Halle',
    slides: [
      { id: 'sl-1', type: 'live', config: { fieldId: 'field-2' }, duration: null, order: 0 },
      { id: 'sl-2', type: 'standings', config: { groupId: 'C' }, duration: null, order: 1 },
      { id: 'sl-3', type: 'qr-code', config: { qrTarget: 'custom', customQrUrl: 'https://sv-nord.de' }, duration: null, order: 2 },
    ],
  })],
});

const sued = tournament({ id: 'sued', title: 'Hallencup Süd', numberOfFields: 1, numberOfGroups: 2 });

async function renderWithI18n(target: Tournament) {
  const Wrapper = await createRealI18nWrapper();
  const onUpdate = vi.fn().mockResolvedValue(undefined);
  render(
    <Wrapper>
      <MonitorsConfigTab tournament={target} onTournamentUpdate={onUpdate} />
    </Wrapper>
  );
  return onUpdate;
}

describe('Monitore übernehmen – B-22b Texte (echtes i18n)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActive.current = [nord, sued];
  });

  it('@ME-061 nennt die Folie und das fehlende Feld wörtlich, mit den Knöpfen', async () => {
    await renderWithI18n(sued);
    await userEvent.click(screen.getByTestId('monitors-transfer-open'));
    await userEvent.click(await screen.findByTestId('transfer-source-nord'));

    expect(screen.getByText('Folie ‚Live: Feld 2‘ – dieses Turnier hat kein Feld 2')).toBeInTheDocument();
    expect(screen.getByTestId('transfer-issue-0:0-reassign-field')).toHaveTextContent('Auf Feld 1 umstellen');
    expect(screen.getByTestId('transfer-issue-0:0-remove')).toHaveTextContent('Folie entfernen');
  });

  it('@ME-061 nennt die Tabellen-Folie der fehlenden Gruppe wörtlich, mit „Alle Tabellen zeigen“', async () => {
    await renderWithI18n(sued);
    await userEvent.click(screen.getByTestId('monitors-transfer-open'));
    await userEvent.click(await screen.findByTestId('transfer-source-nord'));

    expect(screen.getByText('Folie ‚Tabelle: Gruppe C‘ – dieses Turnier hat keine Gruppe C')).toBeInTheDocument();
    expect(screen.getByTestId('transfer-issue-0:1-all-groups')).toHaveTextContent('Alle Tabellen zeigen');
  });

  it('@ME-061 zeigt im Monitor-Editor den Warnhinweis wörtlich', async () => {
    const onUpdate = await renderWithI18n(sued);
    await userEvent.click(screen.getByTestId('monitors-transfer-open'));
    await userEvent.click(await screen.findByTestId('transfer-source-nord'));
    await userEvent.click(screen.getByTestId('transfer-confirm'));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));

    const saved = onUpdate.mock.calls[0][0] as Tournament;
    const Wrapper = await createRealI18nWrapper();
    render(
      <Wrapper>
        <MonitorEditor tournament={saved} monitorId={saved.monitors?.[0].id ?? ''} onTournamentUpdate={vi.fn()} onClose={vi.fn()} />
      </Wrapper>
    );
    expect(screen.getAllByText('Feld fehlt in diesem Turnier – bitte anpassen')[0]).toBeInTheDocument();
  });

  it('@ME-062 meldet die Umbenennung wörtlich', async () => {
    mockActive.current = [nord, tournament({ id: 'sued', title: 'Hallencup Süd', monitors: [monitor({ id: 'mon-bestand', name: 'Halle' })] })];
    const target = tournament({ id: 'sued', title: 'Hallencup Süd', monitors: [monitor({ id: 'mon-bestand', name: 'Halle' })] });
    await renderWithI18n(target);
    await userEvent.click(screen.getByTestId('monitors-transfer-open'));
    await userEvent.click(await screen.findByTestId('transfer-source-nord'));
    await userEvent.click(screen.getByTestId('transfer-confirm'));

    expect(await screen.findByText('Der übernommene Monitor heißt jetzt ‚Halle (2)‘')).toBeInTheDocument();
  });

  it('@ME-063 meldet den nicht übernommenen eigenen Link aus der Datei wörtlich', async () => {
    const onUpdate = await renderWithI18n(sued);
    await userEvent.click(screen.getByTestId('monitors-transfer-open'));
    const file = new File([JSON.stringify({
      kind: 'monitor-config', version: 1,
      monitors: [{
        name: 'Datei', defaultSlideDuration: 15, transition: 'fade', transitionDuration: 500,
        theme: 'dark', performanceMode: 'auto',
        slides: [{ type: 'qr-code', config: { qrTarget: 'custom', customQrUrl: 'https://sv-nord.de' }, duration: null }],
      }],
    })], 'monitore.json', { type: 'application/json' });
    await userEvent.upload(screen.getByTestId('transfer-file'), file);
    await userEvent.click(screen.getByTestId('transfer-confirm'));

    expect(await screen.findByText('Eigener Link aus der Datei nicht übernommen – die QR-Folie zeigt auf die Zuschauer-Seite')).toBeInTheDocument();
    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
  });
});
