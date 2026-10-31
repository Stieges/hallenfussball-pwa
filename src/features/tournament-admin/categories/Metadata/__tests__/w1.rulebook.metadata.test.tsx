/**
 * w1 — Feld „Regelwerk“ im Admin-Center (Kategorie Meta-Daten), auch nach dem Anpfiff.
 *
 * @DR-016 Ändert Olli das Regelwerk nach dem ersten Anpfiff, ist das Feld editierbar und die
 * Änderung wird gespeichert. Der nächste Ausdruck zeigt den neuen Text.
 */
vi.mock('../../../../auth/hooks/useCan', () => ({ useCan: () => true }));
vi.mock('../../../../../hooks/useTournamentStartState', () => ({ useTournamentStartState: () => ({ state: 'unknown' }) }));
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('@DR-016 Einfügen von 81 Zeichen: nur 80 werden übernommen, Kürzungshinweis sichtbar', async () => {
    const user = userEvent.setup();
    const { onTournamentUpdate, input } = renderMetadata(runningTournament());

    await user.click(input);
    await user.paste('b'.repeat(81));

    expect(input).toHaveValue('b'.repeat(80));
    expect(screen.getByRole('status')).toHaveTextContent('admin:metadata.rulebookTruncated');

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
