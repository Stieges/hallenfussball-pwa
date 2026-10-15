/**
 * w1 — Feld „Regelwerk“ im Admin-Center (Kategorie Meta-Daten), auch nach dem Anpfiff.
 *
 * @DR-016 Ändert Olli das Regelwerk nach dem ersten Anpfiff, ist das Feld editierbar und die
 * Änderung wird gespeichert. Der nächste Ausdruck zeigt den neuen Text.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Tournament } from '../../../../../types/tournament';
import { MetadataCategory } from '../index';

function runningTournament(rulebook?: string): Tournament {
  return {
    id: 't1',
    title: 'Hallencup Nord',
    status: 'published',
    rulebook,
    teams: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
    matches: [{ id: 'm1', round: 1, field: 1, teamA: 'a', teamB: 'b', matchStatus: 'running' }],
    startDate: '2026-03-01',
    startTime: '10:00',
    location: { name: 'Halle' },
  } as unknown as Tournament;
}

function renderMetadata(tournament: Tournament) {
  const onTournamentUpdate = vi.fn();
  render(
    <MetadataCategory tournamentId="t1" tournament={tournament} onTournamentUpdate={onTournamentUpdate} />
  );
  return { onTournamentUpdate, input: screen.getByTestId('metadata-rulebook') };
}

beforeEach(() => vi.clearAllMocks());

describe('Admin-Center Meta-Daten — Regelwerk bei laufendem Turnier', () => {
  it('@DR-016 das Feld ist bei laufendem Spiel editierbar und die Änderung wird gespeichert', () => {
    const { onTournamentUpdate, input } = renderMetadata(runningTournament('BFV alt'));

    expect(input).toBeEnabled();
    fireEvent.change(input, { target: { value: 'BFV-Richtlinien für Futsal' } });
    fireEvent.click(screen.getByRole('button', { name: 'admin:metadata.saveChanges' }));

    expect(onTournamentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ rulebook: 'BFV-Richtlinien für Futsal' })
    );
  });

  it('@DR-016 mehr als 80 Zeichen: nur 80 werden übernommen', () => {
    const { onTournamentUpdate, input } = renderMetadata(runningTournament());

    expect(input).toHaveAttribute('maxlength', '80');
    fireEvent.change(input, { target: { value: 'b'.repeat(81) } });
    fireEvent.click(screen.getByRole('button', { name: 'admin:metadata.saveChanges' }));

    expect(onTournamentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ rulebook: 'b'.repeat(80) })
    );
  });

  it('Gegenbeispiel: leeres Feld speichert undefined, nicht ""', () => {
    const { onTournamentUpdate, input } = renderMetadata(runningTournament('BFV alt'));

    fireEvent.change(input, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'admin:metadata.saveChanges' }));

    expect(onTournamentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ rulebook: undefined })
    );
  });
});
