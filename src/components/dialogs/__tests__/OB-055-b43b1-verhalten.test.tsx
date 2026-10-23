/**
 * @OB-055 (B-43b1-F) — Verhalten der umgestellten Dialoge bleibt wie vor der Umstellung:
 * Esc schließt den Monitor-Editor genau einmal, nach „Weiter“ liegt der Fokus auf „Zurück“.
 * (B-06: die Fälle der Nach-Spiel-Meldung entfallen mit dem gelöschten PostMatchModal.)
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MonitorEditor } from '../../../features/tournament-management/MonitorEditor';
import { TransferOwnershipDialog } from '../../../features/auth/components/TransferOwnershipDialog';
import type { Tournament } from '../../../types/tournament';
import type { TournamentMembership, User } from '../../../features/auth/types/auth.types';

const hoisted = vi.hoisted(() => ({
  monitor: {
    id: 'monitor-1', name: 'Haupthalle', defaultSlideDuration: 15, transition: 'fade', transitionDuration: 500,
    theme: 'dark', performanceMode: 'auto', slides: [] as unknown[],
    createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
  },
}));

vi.mock('../../../hooks', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useMonitors: () => ({
    getMonitorById: () => hoisted.monitor, updateMonitor: vi.fn(), addSlide: vi.fn(), updateSlide: vi.fn(),
    removeSlide: vi.fn(), reorderSlides: vi.fn(), getDisplayUrl: () => '',
  }),
  useSponsors: () => ({ sponsors: [] }),
  useFields: () => ({ fields: [], getFieldDisplayName: (id: string) => id }),
}));

const tournament = {
  id: 't1', name: 'Wintercup', teams: [], matches: [], groups: [], numberOfGroups: 2,
  groupSystem: 'groups', isPublic: false, monitors: [hoisted.monitor],
} as unknown as Tournament;

describe('@OB-055 B-43b1-F Verhalten', () => {
  it('Monitor-Editor: Esc ruft onClose genau einmal auf', () => {
    const onClose = vi.fn();
    render(<MonitorEditor tournament={tournament} monitorId="monitor-1" onTournamentUpdate={vi.fn()} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Eigentum übertragen: nach „Weiter“ liegt der Fokus auf „Zurück“, nicht auf „Übertragen“', async () => {
    const u = userEvent.setup();
    const m: TournamentMembership = {
      id: 'm1', userId: 'u1', tournamentId: 't1', role: 'co-admin', teamIds: [],
      createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
    };
    const user = { id: 'u1', email: 'a@example.org', name: 'Anna', globalRole: 'user' } as unknown as User;
    render(<TransferOwnershipDialog tournamentName="Cup" coAdmins={[{ membership: m, user }]} onClose={vi.fn()} onTransfer={vi.fn()} />);
    await u.click(screen.getByText('Anna'));
    await u.click(screen.getByRole('button', { name: 'Weiter' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Zurück' }));
  });
});
