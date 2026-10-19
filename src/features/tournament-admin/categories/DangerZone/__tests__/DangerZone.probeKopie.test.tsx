/**
 * @W5-027 – Nach der Generalprobe wird die Kopie gelöscht, das Original bleibt.
 * Gegen @LZ-003/@LZ-090 (angepfiffenes Turnier nicht löschbar): siehe Befund im Task-Bericht KP.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Tournament } from '../../../../../types/tournament';
import { buildCopiedTournament } from '../../../../../core/models/tournamentCopy';
import { hallencupOstGespielt } from '../../../../../core/models/__fixtures__/hallencupOstGespielt';

vi.mock('../../../../auth/hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: false }) }));
vi.mock('../../../../auth/hooks/useTournamentMembers', () => ({
  useTournamentMembers: () => ({ myMembership: null, isLoading: false }),
}));

import { DangerZoneCategory } from '../index';

function frischeKopie(): Tournament {
  return buildCopiedTournament(hallencupOstGespielt(), {
    newId: crypto.randomUUID(), title: 'Hallencup Ost (Kopie)', now: '2026-11-20T10:00:00.000Z', makeId: () => crypto.randomUUID(),
  });
}

function renderDangerZone(tournament: Tournament) {
  render(<DangerZoneCategory tournamentId={tournament.id} tournament={tournament} onTournamentUpdate={vi.fn()} onLocalTournamentUpdate={vi.fn()} />);
}

describe('@W5-027 Kopie löschen', () => {
  it('@W5-027 eine frische Kopie des gespielten Hallencup Ost lässt sich löschen', () => {
    renderDangerZone(frischeKopie());
    expect(screen.getByRole('button', { name: /Turnier löschen/i })).toBeInTheDocument();
  });

  // Befund: Szenario verlangt Löschen NACH der Generalprobe, @LZ-003/@LZ-090 sperren angepfiffene Turniere (Client und Server).
  it.fails('@W5-027 die gespielte Kopie (Generalprobe beendet) lässt sich löschen', () => {
    const kopie = frischeKopie();
    kopie.matches = kopie.matches.map((spiel) => ({ ...spiel, matchStatus: 'finished' as const }));
    renderDangerZone(kopie);
    expect(screen.getByRole('button', { name: /Turnier löschen/i })).toBeInTheDocument();
  });
});
