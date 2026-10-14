/**
 * Monitore übernehmen – echter Bedienweg: Dialog → Service → Speichern (B-22)
 *
 * Pflichttest: Übernahme „Hallencup Nord“ → „Süd“ (@ME-039)
 * Gegenbeispiele: fehlender Sponsor (@ME-041), Datei ohne Monitor-Einstellungen (@ME-042),
 * Helfer ohne Recht (@ME-043), Übernehmen ändert keinen Bildschirm (@ME-045), Vorlage (@ME-058)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MonitorsConfigTab } from '../MonitorsConfigTab';
import type { Tournament } from '../../../types/tournament';
import type { TournamentMonitor } from '../../../types/monitor';
import { MONITOR_CONFIG_MAX_BYTES } from '../../../core/services/monitorConfigTransfer';

const { mockActive, mockRole } = vi.hoisted(() => {
  const role: { current: string | null } = { current: 'owner' };
  return { mockActive: { current: [] as unknown[] }, mockRole: role };
});

vi.mock('../../../hooks', async () => {
  const mod = await import('../../../hooks/useMonitors');
  return { useMonitors: mod.useMonitors };
});

vi.mock('../../../hooks/useTournaments', () => ({
  useTournaments: () => ({ activeTournaments: mockActive.current, loading: false }),
}));

vi.mock('../../auth/hooks/useMyTournamentRole', () => ({
  useMyTournamentRole: () => ({ role: mockRole.current }),
}));

vi.mock('../../../hooks/useMonitorHeartbeats', () => ({
  useMonitorHeartbeats: () => new Map(),
}));

function monitor(overrides: Partial<TournamentMonitor> = {}): TournamentMonitor {
  return {
    id: 'mon-nord',
    name: 'Hallenmonitor Halle',
    defaultSlideDuration: 15,
    transition: 'fade',
    transitionDuration: 500,
    theme: 'dark',
    performanceMode: 'auto',
    overscanPx: 64,
    slides: [
      { id: 'sl-1', type: 'live', config: { fieldId: 'field-1' }, duration: null, order: 0 },
      { id: 'sl-2', type: 'standings', config: {}, duration: null, order: 1 },
      { id: 'sl-3', type: 'sponsor', config: { sponsorId: 'sp-nord' }, duration: 20, order: 2 },
    ],
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

function tournament(overrides: Partial<Tournament> & { id: string }): Tournament {
  return {
    title: overrides.id,
    teams: [],
    matches: [],
    monitors: [],
    sponsors: [],
    ...overrides,
  } as unknown as Tournament;
}

const nord = tournament({
  id: 'nord',
  title: 'Hallencup Nord',
  teams: [{ id: 't1', name: 'Nord Team' }],
  monitors: [monitor()],
  sponsors: [{ id: 'sp-nord', name: 'Bäckerei Krume' }] as unknown as Tournament['sponsors'],
});

const sued = tournament({
  id: 'sued',
  title: 'Hallencup Süd',
  sponsors: [{ id: 'sp-sued', name: 'Bäckerei Krume' }] as unknown as Tournament['sponsors'],
});

function renderTab(target: Tournament, onUpdate = vi.fn().mockResolvedValue(undefined)) {
  render(<MonitorsConfigTab tournament={target} onTournamentUpdate={onUpdate} />);
  return onUpdate;
}

async function openSheet() {
  await userEvent.click(screen.getByTestId('monitors-transfer-open'));
  return screen.findByTestId('monitor-transfer-sheet');
}

function savedMonitors(onUpdate: ReturnType<typeof vi.fn>): TournamentMonitor[] {
  const call = onUpdate.mock.calls[0]?.[0] as Tournament | undefined;
  return call?.monitors ?? [];
}

function jsonFile(body: unknown, name = 'monitore.json'): File {
  return new File([typeof body === 'string' ? body : JSON.stringify(body)], name, { type: 'application/json' });
}

describe('Monitore übernehmen (B-22)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActive.current = [nord, sued];
    mockRole.current = 'owner';
    Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:monitor'), configurable: true, writable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true, writable: true });
  });

  it('@ME-039 übernimmt Monitore aus „Hallencup Nord“ in „Hallencup Süd“ und speichert sie', async () => {
    const onUpdate = renderTab(sued);
    await openSheet();

    expect(screen.getByTestId('transfer-confirm')).toBeDisabled();
    await userEvent.click(screen.getByTestId('transfer-source-nord'));
    expect(screen.getByTestId('transfer-summary')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('transfer-confirm'));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    const [created] = savedMonitors(onUpdate);
    expect(created.name).toBe('Hallenmonitor Halle');
    expect(created.id).not.toBe('mon-nord');
    expect(created.overscanPx).toBe(64);
    expect(created.slides.map(s => s.type)).toEqual(['live', 'standings', 'sponsor']);
    expect(created.slides[2].duration).toBe(20);
    expect(created.slides[2].config.sponsorId).toBe('sp-sued');
    expect(created.slides[2].config).not.toHaveProperty('sponsorName');

    // Teams und Spiele kommen nicht aus dem Quellturnier
    const saved = onUpdate.mock.calls[0][0] as Tournament;
    expect(JSON.stringify(saved)).not.toContain('Nord Team');
    expect(await screen.findByTestId('transfer-done')).toBeInTheDocument();
  });

  it('@ME-041 überspringt eine Sponsor-Folie ohne Sponsor im Zielturnier und meldet es', async () => {
    const onUpdate = renderTab(tournament({ id: 'ohne', title: 'Ohne Sponsor' }));
    await openSheet();
    await userEvent.click(screen.getByTestId('transfer-source-nord'));
    await userEvent.click(screen.getByTestId('transfer-confirm'));

    expect(await screen.findByTestId('transfer-skipped-sponsor')).toBeInTheDocument();
    const [created] = savedMonitors(onUpdate);
    expect(created.slides.map(s => s.type)).toEqual(['live', 'standings']);
  });

  it('@ME-042 zeigt bei einer Datei ohne Monitor-Einstellungen eine Meldung und ändert nichts', async () => {
    const onUpdate = renderTab(sued);
    await openSheet();
    await userEvent.upload(screen.getByTestId('transfer-file'), jsonFile({ hallo: 'welt' }));

    expect(await screen.findByTestId('transfer-file-error')).toHaveTextContent('monitors.transfer.errors.notMonitorConfig');
    expect(screen.getByTestId('transfer-confirm')).toBeDisabled();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('lehnt eine zu große Datei ab, bevor sie übernommen wird', async () => {
    const onUpdate = renderTab(sued);
    await openSheet();
    const big = jsonFile('x'.repeat(MONITOR_CONFIG_MAX_BYTES + 1), 'gross.json');
    await userEvent.upload(screen.getByTestId('transfer-file'), big);

    expect(await screen.findByTestId('transfer-file-error')).toHaveTextContent('monitors.transfer.errors.tooLarge');
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('meldet eine unbekannte Version klar und ändert nichts', async () => {
    const onUpdate = renderTab(sued);
    await openSheet();
    await userEvent.upload(
      screen.getByTestId('transfer-file'),
      jsonFile({ kind: 'monitor-config', version: 2, monitors: [] })
    );

    expect(await screen.findByTestId('transfer-file-error')).toHaveTextContent('monitors.transfer.errors.unsupportedVersion');
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('meldet eine kaputte Datei (ungültige Werte) und ändert nichts', async () => {
    const onUpdate = renderTab(sued);
    await openSheet();
    const broken = {
      kind: 'monitor-config',
      version: 1,
      monitors: [{
        name: 'Kaputt', defaultSlideDuration: 0, transition: 'fade', transitionDuration: 500,
        theme: 'dark', performanceMode: 'auto', slides: [],
      }],
    };
    await userEvent.upload(screen.getByTestId('transfer-file'), jsonFile(broken));

    expect(await screen.findByTestId('transfer-file-error')).toHaveTextContent('monitors.transfer.errors.invalid');
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('übernimmt eine gültige Datei mit Monitor-Einstellungen', async () => {
    const onUpdate = renderTab(sued);
    await openSheet();
    const exported = {
      kind: 'monitor-config',
      version: 1,
      monitors: [{
        name: 'Datei-Monitor', defaultSlideDuration: 10, transition: 'none', transitionDuration: 0,
        theme: 'light', performanceMode: 'low', overscanPx: 10,
        slides: [{ type: 'qr-code', config: {}, duration: null }],
      }],
    };
    await userEvent.upload(screen.getByTestId('transfer-file'), jsonFile(exported));
    expect(await screen.findByTestId('transfer-file-name')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('transfer-confirm'));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    const [created] = savedMonitors(onUpdate);
    expect(created.name).toBe('Datei-Monitor');
    expect(created.performanceMode).toBe('low');
    expect(created.slides.map(s => s.type)).toEqual(['qr-code']);
  });

  it('@ME-058 legt einen Monitor aus der Vorlage „Hallen-Standard“ an', async () => {
    const onUpdate = renderTab(sued);
    await openSheet();
    await userEvent.click(screen.getByTestId('transfer-template'));
    await userEvent.click(screen.getByTestId('transfer-confirm'));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    const [created] = savedMonitors(onUpdate);
    expect(created.slides.map(s => s.type)).toEqual(['live', 'next-matches', 'all-standings', 'qr-code']);
    expect(created.name).toBe('tournament:monitors.transfer.templateMonitorName');
    expect(created.slides[0].config.fieldId).toBe('field-1');
  });

  it('@ME-045 lässt bestehende Monitore des Zielturniers unverändert', async () => {
    const existing = monitor({ id: 'mon-bestand', name: 'Eingang' });
    const target = tournament({ id: 'sued', title: 'Hallencup Süd', monitors: [existing] });
    const onUpdate = renderTab(target);
    await openSheet();
    await userEvent.click(screen.getByTestId('transfer-template'));
    await userEvent.click(screen.getByTestId('transfer-confirm'));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    const monitors = savedMonitors(onUpdate);
    expect(monitors).toHaveLength(2);
    expect(monitors[0]).toEqual(existing);
    expect(monitors[1].id).not.toBe('mon-bestand');
  });

  it.each<[string, string | null, boolean]>([
    ['Eigentümer', 'owner', true],
    ['Co-Admin', 'co-admin', true],
    ['Helfer (trainer)', 'trainer', false],
    ['Mitwirkender', 'collaborator', false],
    ['Betrachter', 'viewer', false],
    ['ohne Rolle', null, false],
  ])('@ME-043 %s: Übernehmen und Exportieren sichtbar = %s', (_label, role, visible) => {
    mockRole.current = role;
    renderTab(nord, vi.fn());
    if (visible) {
      expect(screen.getByTestId('monitors-transfer-open')).toBeInTheDocument();
      expect(screen.getByTestId('monitors-transfer-export')).toBeInTheDocument();
    } else {
      expect(screen.queryByTestId('monitors-transfer-open')).not.toBeInTheDocument();
      expect(screen.queryByTestId('monitors-transfer-export')).not.toBeInTheDocument();
    }
  });

  it('@ME-040 exportiert die Monitor-Einstellungen als Datei ohne IDs und Teams', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    renderTab(nord, vi.fn());
    await userEvent.click(screen.getByTestId('monitors-transfer-export'));
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
    const text = await blob.text();
    expect(text).toContain('"kind": "monitor-config"');
    expect(text).not.toMatch(/mon-nord|sp-nord|Nord Team/);
    click.mockRestore();
  });

  it('@ME-044 nach dem Übernehmen ist die Quelle unverändert und wird nicht gespeichert', async () => {
    const snapshot = JSON.stringify(nord);
    const onUpdate = renderTab(sued);
    await openSheet();
    await userEvent.click(screen.getByTestId('transfer-source-nord'));
    await userEvent.click(screen.getByTestId('transfer-confirm'));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    expect((onUpdate.mock.calls[0][0] as Tournament).id).toBe('sued');
    expect(JSON.stringify(nord)).toBe(snapshot);

    // Änderung am Ziel-Monitor (z. B. Tabellen-Folie entfernen) berührt die Quelle nicht
    const [created] = savedMonitors(onUpdate);
    created.slides.splice(1, 1);
    expect(nord.monitors?.[0].slides).toHaveLength(3);
  });

  it('@ME-045 Quelle bleibt unverändert, neue Monitore sind noch keinem Bildschirm zugeordnet', async () => {
    const snapshot = JSON.stringify(nord);
    const onUpdate = renderTab(sued);
    await openSheet();
    await userEvent.click(screen.getByTestId('transfer-source-nord'));
    await userEvent.click(screen.getByTestId('transfer-confirm'));

    await screen.findByTestId('transfer-done');
    expect(screen.getByText(/monitors\.transfer\.noScreenChange/)).toBeInTheDocument();
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(nord)).toBe(snapshot);
  });

  it('@ME-046 (Teil 1) läuft das Spiel im alten Turnier weiter, bleibt dessen Monitor unberührt', async () => {
    const running = tournament({
      id: 'nord',
      title: 'Hallencup Nord',
      monitors: [monitor({ id: 'mon-nord' })],
      sponsors: [{ id: 'sp-nord', name: 'Bäckerei Krume' }] as unknown as Tournament['sponsors'],
    });
    mockActive.current = [running, sued];
    const onUpdate = renderTab(sued);
    await openSheet();
    await userEvent.click(screen.getByTestId('transfer-source-nord'));
    await userEvent.click(screen.getByTestId('transfer-confirm'));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    expect(running.monitors?.[0].id).toBe('mon-nord');
    expect(running.monitors?.[0].slides[0].id).toBe('sl-1');
    expect(onUpdate.mock.calls.map(c => (c[0] as Tournament).id)).toEqual(['sued']);
  });
});
