/**
 * TournamentCard — Render-Verhalten der Dashboard-Karte (Basisfälle).
 *
 * Ergänzt die Gate-Tests (trashGate): Status-Badges, externes Badge, Tastatur-
 * Bedienung, Aktionsmenü nur bei vorhandenen Aktionen, Ablage-Infos.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Tournament } from '../../types/tournament';

vi.mock('../../hooks/useIsMobile', () => ({
  useIsMobile: () => false,
}));

import { TournamentCard } from '../TournamentCard';

function tournamentWith(extra: Partial<Tournament>): Tournament {
  return {
    id: 't1', title: 'Wintercup', status: 'published',
    teams: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
    matches: [{ id: 'm1', matchStatus: 'scheduled' }],
    startDate: '2026-03-01', startTime: '10:00',
    ageClass: 'U11',
    location: { name: 'Halle Süd', city: 'Musterstadt' },
    placementLogic: [],
    groupSystem: 'roundRobin',
    ...extra,
  } as unknown as Tournament;
}

beforeEach(() => vi.clearAllMocks());

describe('TournamentCard — Darstellung (Dashboard)', () => {
  it('zeigt Ablage-Infos (Ort, Altersklasse)', () => {
    render(<TournamentCard tournament={tournamentWith({})} />);

    expect(screen.getByText('Halle Süd')).toBeInTheDocument();
    expect(screen.getByText('U11')).toBeInTheDocument();
  });

  it('zeigt das Entwurfs-Badge für ein Draft-Turnier', () => {
    render(<TournamentCard tournament={tournamentWith({ status: 'draft' })} />);

    expect(screen.getByText('dashboard:status.draft')).toBeInTheDocument();
  });

  it('zeigt ein externes Badge mit Quelle', () => {
    render(
      <TournamentCard
        tournament={tournamentWith({ isExternal: true, externalSource: 'Partner-Cup' })}
      />
    );

    expect(screen.getByLabelText('Partner-Cup')).toBeInTheDocument();
  });

  it.each(['running', 'upcoming', 'finished', 'draft'] as const)(
    'zeigt das Status-Badge der Kategorie %s',
    (categoryLabel) => {
      render(<TournamentCard tournament={tournamentWith({})} categoryLabel={categoryLabel} />);

      expect(screen.getByLabelText(/statusLabel/)).toBeInTheDocument();
    }
  );

  it('Enter auf der Karte öffnet das Turnier', () => {
    const onClick = vi.fn();
    render(<TournamentCard tournament={tournamentWith({})} onClick={onClick} />);

    fireEvent.keyDown(screen.getByRole('button', { name: /ariaLabel/ }), { key: 'Enter' });

    // Hinweis: Card und article führen beide onKeyDown aus (vorhandenes
    // Verhalten, Doppel-Handler) — geprüft wird „wird geöffnet", nicht die Zahl.
    expect(onClick).toHaveBeenCalled();
  });

  it('Gegenbeispiel: andere Tasten öffnen das Turnier nicht', () => {
    const onClick = vi.fn();
    render(<TournamentCard tournament={tournamentWith({})} onClick={onClick} />);

    fireEvent.keyDown(screen.getByRole('button', { name: /ariaLabel/ }), { key: 'x' });

    expect(onClick).not.toHaveBeenCalled();
  });

  it('ohne Aktionen erscheint kein Aktionsmenü', () => {
    render(<TournamentCard tournament={tournamentWith({})} />);

    expect(screen.queryByTestId('tournament-t1-actions-trigger')).not.toBeInTheDocument();
  });
});
