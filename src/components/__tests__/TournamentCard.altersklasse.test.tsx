/**
 * Turnierkarte: Altersklasse (Record Wizard-Regelprofile @W2B-022, @W2B-024, @W2B-026).
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

describe('Turnierkarte zeigt die Altersklasse nur, wenn sie angegeben ist', () => {
  it('@W2B-022 leer: weder Bezeichnung noch Wert', () => {
    karte('');
    expect(screen.queryByTestId('tournament-card-age-class')).toBeNull();
    expect(screen.queryByText('card.labels.ageClass')).toBeNull();
  });

  it('@W2B-022 nur Leerzeichen zählt als leer', () => {
    karte('   ');
    expect(screen.queryByTestId('tournament-card-age-class')).toBeNull();
  });

  it.each(['U11', 'E2-Jugend', 'AH'])('@W2B-024 @W2B-026 „%s“ steht genau so da', (wert) => {
    karte(wert);
    expect(screen.getByTestId('tournament-card-age-class')).toHaveTextContent(wert);
  });
});
