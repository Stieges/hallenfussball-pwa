/**
 * R3-3 Teams (Name, Logo, hinzufügen/entfernen/zurückziehen) und Kader (`TeamsTab.tsx`) nach dem Abschluss
 * (@LZ-036 „bietet die App das nicht an“, @LZ-037 „den Turniernamen/… ändern: erst nach dem Wiederöffnen“).
 * Echte Kette useCan -> hasPermission, nur die Rolle ist gemockt; der Abschluss kommt über das Verzeichnis der
 * abgeschlossenen Turniere (so setzt es `useLifecycleLock`). Gegenbeispiel: dasselbe Turnier offen.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Tournament } from '../../../types/tournament';

vi.unmock('i18next');
vi.unmock('react-i18next');

vi.mock('../../auth/hooks/useMyTournamentRole', () => ({
  useMyTournamentRole: () => ({ role: 'owner', isLoading: false }),
}));

import { initRealDeI18n } from '../../../test/realDeI18n';
import { setTournamentClosed, resetClosedTournaments } from '../../../core/services/closedTournaments';
import { TeamsTab } from '../TeamsTab';

await initRealDeI18n();

const tournament = {
  id: 'hallencup-ost', title: 'Hallencup Ost', status: 'published',
  teams: [{ id: 'sg', name: 'SG Mitte' }, { id: 'vfb', name: 'VfB Ufer' }],
  matches: [],
} as unknown as Tournament;

beforeEach(() => { vi.clearAllMocks(); resetClosedTournaments(); });
afterEach(() => { resetClosedTournaments(); });

describe('@LZ-036 Teams und Kader nach dem Abschluss', () => {
  it('abgeschlossen: Team lesbar, Umbenennen/Logo/Löschen/Hinzufügen nicht angeboten, Hinweis „abgeschlossen“ statt „Turnierleitung“', async () => {
    setTournamentClosed('hallencup-ost', true);
    const user = userEvent.setup();
    render(<TeamsTab tournament={tournament} onTournamentUpdate={vi.fn()} />);
    expect(screen.getByTestId('tournament-closed-hint')).toHaveTextContent('Das Turnier ist abgeschlossen');
    expect(screen.queryByTestId('lead-only-hint')).not.toBeInTheDocument();
    // Review #394 m-3: der Kasten im Tab ist keine zweite Live-Region (oben auf der Seite steht schon eine)
    expect(screen.getByTestId('tournament-closed-hint')).not.toHaveAttribute('role');
    expect(screen.getByText('SG Mitte')).toBeInTheDocument();
    await user.click(screen.getByTestId('team-expand-toggle-sg'));
    expect(screen.queryByTestId('team-edit-button-sg')).not.toBeInTheDocument();
    for (const name of ['Logo hochladen', /Löschen/, /Team hinzufügen/, /Zurückziehen/]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });

  it('Gegenbeispiel: dasselbe Turnier offen – Olli benennt „SG Mitte“ um, kein Hinweis', async () => {
    const user = userEvent.setup();
    const onTournamentUpdate = vi.fn();
    render(<TeamsTab tournament={tournament} onTournamentUpdate={onTournamentUpdate} />);
    expect(screen.queryByTestId('tournament-closed-hint')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('team-expand-toggle-sg'));
    await user.click(screen.getByTestId('team-edit-button-sg'));
    await user.type(screen.getByTestId('team-rename-input-sg'), '{selectall}SG Mitte 2');
    await user.click(screen.getByTestId('team-rename-save-sg'));
    expect(onTournamentUpdate).toHaveBeenCalledTimes(1);
  });

  it('der Abschluss während der Ansicht schließt die Bearbeitung sofort (Realtime-Stand)', async () => {
    const user = userEvent.setup();
    render(<TeamsTab tournament={tournament} onTournamentUpdate={vi.fn()} />);
    await user.click(screen.getByTestId('team-expand-toggle-sg'));
    expect(screen.getByTestId('team-edit-button-sg')).toBeInTheDocument();
    act(() => setTournamentClosed('hallencup-ost', true));
    expect(screen.queryByTestId('team-edit-button-sg')).not.toBeInTheDocument();
  });
});
