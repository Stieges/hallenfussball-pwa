/**
 * Turnierkarte: Altersklasse steht NICHT auf der Karte (@OB-079, löst @W2B-022/-024/-026 für die Karte ab: die Altersklasse steht in
 * der Übersicht des Turniers). Siehe TournamentCard.ob079.test.tsx für das ganze Szenario.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Tournament } from '../../types/tournament';

vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => false }));

import { TournamentCard } from '../TournamentCard';

function karte(ageClass: string) {
  const tournament = {
    id: 't1', title: 'Wintercup', status: 'published', teams: [], matches: [],
    startDate: '2026-03-01', startTime: '10:00', ageClass,
    location: { name: 'Halle Süd', city: 'Musterstadt' }, placementLogic: [], groupSystem: 'roundRobin',
  } as unknown as Tournament;
  return render(<TournamentCard tournament={tournament} />);
}

describe('Turnierkarte zeigt keine Altersklasse (@OB-079)', () => {
  it.each(['', '   ', 'U11', 'E2-Jugend', 'AH'])('Altersklasse „%s“: weder Zeile noch Bezeichnung noch Wert auf der Karte', (wert) => {
    karte(wert);
    expect(screen.queryByTestId('tournament-card-age-class')).toBeNull();
    expect(screen.queryByText('card.labels.ageClass')).toBeNull();
    if (wert.trim() !== '') {
      // nicht nur als eigener Text, auch nicht mitten in einer anderen Zeile (z. B. „08:30 U11“)
      expect(screen.getByTestId('tournament-card-t1')).not.toHaveTextContent(wert);
    }
  });
});
