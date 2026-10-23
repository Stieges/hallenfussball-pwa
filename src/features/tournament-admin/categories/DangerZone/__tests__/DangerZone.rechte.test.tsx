/**
 * A-11 @LZ-022 „Wer abschließen, abbrechen, wieder öffnen … darf“: Tom (Helfer) bekommt „Turnier beenden“ (abschließen)
 * und „Turnier archivieren“ nicht angeboten (manageLifecycle). Gegenbeispiel: Maria (Co-Admin) und Olli.
 * „Turnier abbrechen“ und „wieder öffnen“ gibt es heute nicht als Knopf (entsteht mit A-21a).
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

function renderZone() {
  render(<DangerZoneCategory tournamentId="hallencup-ost" tournament={tournament} onTournamentUpdate={vi.fn()} onLocalTournamentUpdate={vi.fn()} />);
}

beforeEach(() => vi.clearAllMocks());

describe('@LZ-022 Turnier abschließen – wer darf', () => {
  it('@LZ-022 Tom (Helfer): „Turnier beenden“ und „Turnier archivieren“ sind nicht angeboten', () => {
    role.current = 'collaborator';
    renderZone();
    expect(screen.queryByRole('button', { name: 'Turnier beenden' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Turnier archivieren' })).not.toBeInTheDocument();
  });

  it.each(['co-admin', 'owner'])('Gegenbeispiel %s (Maria/Olli): „Turnier beenden“ ist angeboten', (r) => {
    role.current = r;
    renderZone();
    expect(screen.getByRole('button', { name: 'Turnier beenden' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Turnier archivieren' })).toBeInTheDocument();
  });
});
