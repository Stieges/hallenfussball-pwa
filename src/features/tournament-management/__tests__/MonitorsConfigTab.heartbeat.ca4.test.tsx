/**
 * CA-4 (Paket Co-Admin, Befund C-HEARTBEAT-NUR-EIGENTUEMER, NEU-CA5): Wer den Verbindungsstatus der Monitore sieht.
 * Olli (Eigentümer) und Maria (Co-Admin, manageScreens) sehen dasselbe; Tom (Helfer) bietet die App den
 * Monitor-Editor nicht an, und für ihn wird weder abgefragt noch abonniert (der Server liefert ihm den Status ohnehin
 * nicht, CA-2 Policy heartbeats_select_v2). Die Texte „verbunden/zuletzt gesehen um hh:mm“ (@ME-026/-027) bleiben B-48c.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';
import type { TournamentMonitor } from '../../../types/monitor';
import type { HeartbeatStatus, MonitorHeartbeat } from '../../../hooks/useMonitorHeartbeats';

vi.unmock('i18next');
vi.unmock('react-i18next');

const role = vi.hoisted(() => ({ current: 'collaborator' }));
const status = vi.hoisted((): { current: HeartbeatStatus } => ({ current: 'online' }));
const heartbeatsHook = vi.hoisted(() => vi.fn());
vi.mock('../../auth/hooks/useMyTournamentRole', () => ({
  useMyTournamentRole: () => ({ role: role.current, isLoading: false }),
}));
vi.mock('../../../hooks/useMonitorHeartbeats', () => ({ useMonitorHeartbeats: heartbeatsHook }));

import { initRealDeI18n } from '../../../test/realDeI18n';
import { MonitorsConfigTab } from '../MonitorsConfigTab';

await initRealDeI18n();

const halle: TournamentMonitor = {
  id: 'halle', name: 'Hallenmonitor Halle', defaultSlideDuration: 15, transition: 'fade', transitionDuration: 500,
  theme: 'dark', performanceMode: 'auto', slides: [], createdAt: '2026-11-14T08:00:00Z', updatedAt: '2026-11-14T08:00:00Z',
};
const tournament = { id: 'hallencup-nord', title: 'Hallencup Nord', teams: [], matches: [], monitors: [halle] } as unknown as Tournament;

beforeEach(() => {
  vi.clearAllMocks();
  // Wie der Server: nur wer die Kennung bekommt (also manageScreens hat), erhält Zeilen.
  heartbeatsHook.mockImplementation((id: string | undefined): Map<string, MonitorHeartbeat> =>
    id === undefined
      ? new Map()
      : new Map([['halle', { monitorId: 'halle', lastSeen: new Date(), status: status.current, slideIndex: null, cacheStatus: null }]]));
});

describe('NEU-CA5 Verbindungsstatus der Monitore', () => {
  it.each([
    ['owner', 'Olli (Eigentümer)'],
    ['co-admin', 'Maria (Co-Admin)'],
  ])('%s – %s: sieht den Status „Online“ beim „Hallenmonitor Halle“, der Hook läuft für das Turnier', (r) => {
    role.current = r;
    status.current = 'online';
    render(<MonitorsConfigTab tournament={tournament} onTournamentUpdate={vi.fn()} />);

    expect(screen.getByText('Online')).toBeInTheDocument();
    expect(heartbeatsHook).toHaveBeenLastCalledWith('hallencup-nord');
  });

  it.each<[HeartbeatStatus, string]>([['stale', 'Instabil'], ['offline', 'Offline']])('Maria sieht auch „%s“ als „%s“', (s, label) => {
    role.current = 'co-admin';
    status.current = s;
    render(<MonitorsConfigTab tournament={tournament} onTournamentUpdate={vi.fn()} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('Tom (Helfer an Feld 1): kein Status, keine Abfrage und kein Abo (Hook ohne Kennung), Editor nicht angeboten', () => {
    role.current = 'collaborator';
    render(<MonitorsConfigTab tournament={tournament} onTournamentUpdate={vi.fn()} />);

    expect(heartbeatsHook).toHaveBeenCalled();
    for (const call of heartbeatsHook.mock.calls) {
      expect(call[0]).toBeUndefined();
    }
    expect(screen.queryByText('Online')).not.toBeInTheDocument();
    expect(screen.queryByText('Offline')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Monitor "Hallenmonitor Halle" bearbeiten' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Neuer Monitor/ })).not.toBeInTheDocument();
  });

  it.each(['trainer', 'viewer'])('Gegenbeispiel %s: ebenfalls kein Status', (r) => {
    role.current = r;
    render(<MonitorsConfigTab tournament={tournament} onTournamentUpdate={vi.fn()} />);
    expect(screen.queryByText('Online')).not.toBeInTheDocument();
    expect(heartbeatsHook.mock.calls.every((c) => c[0] === undefined)).toBe(true);
  });
});
