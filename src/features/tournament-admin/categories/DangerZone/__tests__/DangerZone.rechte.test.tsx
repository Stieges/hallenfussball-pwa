/**
 * R3-1 (C-FINISH-PROMISE): die alten Knöpfe „Turnier beenden“ und „Turnier archivieren“ sind für niemanden mehr da. Sie
 * setzten nur einen Haken, der nichts sperrte und dem Endstand nichts versprach. Der Abschluss kommt mit R3-4 (@LZ-022:
 * nur mit Recht manageLifecycle). Hier bleibt die Gegenprobe: weder Helfer noch Co-Admin noch Eigentümer sehen die alten Knöpfe.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Tournament } from '../../../../../types/tournament';

const role = vi.hoisted(() => ({ current: 'collaborator' }));
vi.mock('../../../../auth/hooks/useMyTournamentRole', () => ({
  useMyTournamentRole: () => ({ role: role.current, isLoading: false }),
}));

import { DangerZoneCategory } from '../index';

const tournament = {
  id: 'hallencup-ost', title: 'Hallencup Ost', status: 'published',
  teams: [{ id: 'sg', name: 'SG Mitte' }, { id: 'vfb', name: 'VfB Ufer' }],
  matches: [{ id: 'm13', matchStatus: 'finished', scoreA: 1, scoreB: 0 }],
  startDate: '2026-11-14', startTime: '09:00',
} as unknown as Tournament;

beforeEach(() => vi.clearAllMocks());

describe('C-FINISH-PROMISE alte Abschluss-Knöpfe weg', () => {
  it.each(['collaborator', 'co-admin', 'owner'])('%s: kein „Turnier beenden“, kein „Turnier archivieren“', (r) => {
    role.current = r;
    render(<DangerZoneCategory tournamentId="hallencup-ost" tournament={tournament} onTournamentUpdate={vi.fn()} onLocalTournamentUpdate={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Turnier beenden/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Turnier archivieren/i })).not.toBeInTheDocument();
  });

  it('Gegenbeispiel: „Spielplan zurücksetzen“ bleibt für die Turnierleitung', () => {
    role.current = 'owner';
    render(<DangerZoneCategory tournamentId="hallencup-ost" tournament={tournament} onTournamentUpdate={vi.fn()} onLocalTournamentUpdate={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Spielplan zurücksetzen' })).toBeInTheDocument();
  });
});
