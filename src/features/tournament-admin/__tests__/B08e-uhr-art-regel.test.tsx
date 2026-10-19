/**
 * B-08e: Uhr-Art als Turnierregel (Admin Center, Kategorie Match Cockpit).
 *
 * @SL-002: Ein neues Turnier hat die Uhr-Art „durchlaufend, letzte Minute angehalten“; wählbar sind außerdem
 *          „immer durchlaufend“ und „immer angehalten“.
 * @W2A-035: Die Turnierleitung legt ein Turnier an, ändert nichts an der Uhr, speichert die Regeln: die Uhr-Art
 *          gilt; sie kann stattdessen die beiden anderen wählen.
 * @W2A-030 (Erweiterung): die Uhr-Art ändert nur die Turnierleitung; Helfer sehen sie gesperrt.
 * @W2A-040: Länge der angehaltenen Schlussphase 1 bis 5 Minuten, vorbelegt 1; größer als ein Abschnitt oder außerhalb
 *          1–5 nennt die App den gültigen Bereich und übernimmt den Wert nicht.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { MatchCockpitCategory } from '../categories/MatchCockpit';
import { DEFAULT_MATCH_COCKPIT_SETTINGS, type Tournament } from '../../../types/tournament';
import type { TournamentRole } from '../../auth/types/auth.types';

vi.unmock('i18next');
vi.unmock('react-i18next');

let currentRole: TournamentRole = 'owner';
vi.mock('../../auth/hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: true, user: { id: 'user-1' } }),
}));
vi.mock('../../auth/hooks/useTournamentMembers', () => ({
  useTournamentMembers: () => ({
    myMembership: {
      id: 'membership-1', userId: 'user-1', tournamentId: 'tournament-1',
      role: currentRole, teamIds: [], createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    },
    members: [], coAdmins: [], isLoading: false, error: null,
  }),
}));
vi.mock('../../../hooks/useMatchSound', () => ({
  useMatchSound: () => ({
    play: vi.fn(), stop: vi.fn(), testPlay: vi.fn(), activate: vi.fn(),
    isPlaying: false, isLoading: false, isReady: true, isActivated: true, error: null,
  }),
}));

beforeEach(async () => {
  vi.clearAllMocks();
  await initRealDeI18n();
});

/** Ein neues Turnier: Uhr-Art auf der Vorgabe, ohne gespeicherte Änderung. */
function neuesTurnier(): Tournament {
  return {
    id: 'tournament-1', title: 'Test-Turnier', numberOfFields: 1, teams: [], matches: [],
    matchCockpitSettings: { ...DEFAULT_MATCH_COCKPIT_SETTINGS },
  } as unknown as Tournament;
}

const LETZTE_MINUTE = 'durchlaufend-letzte-minute-angehalten';

describe('B-08e @SL-002 / @W2A-035 – Uhr-Art als Turnierregel', () => {
  it('@SL-002: ein neues Turnier zeigt „durchlaufend, letzte Minute angehalten“ und bietet die beiden anderen an', () => {
    currentRole = 'owner';
    render(<MatchCockpitCategory tournamentId="tournament-1" tournament={neuesTurnier()} onTournamentUpdate={vi.fn()} />);

    const feld = screen.getByTestId('settings-clock-mode');
    expect(feld).toHaveValue(LETZTE_MINUTE);
    expect(within(feld).getByRole('option', { name: 'durchlaufend, letzte Minute angehalten' })).toBeInTheDocument();
    expect(within(feld).getByRole('option', { name: 'immer durchlaufend' })).toBeInTheDocument();
    expect(within(feld).getByRole('option', { name: 'immer angehalten' })).toBeInTheDocument();
  });

  it('@W2A-035: die Turnierleitung wählt „immer angehalten“, die Regel wird gespeichert', () => {
    currentRole = 'owner';
    const onTournamentUpdate = vi.fn();
    render(<MatchCockpitCategory tournamentId="tournament-1" tournament={neuesTurnier()} onTournamentUpdate={onTournamentUpdate} />);

    fireEvent.change(screen.getByTestId('settings-clock-mode'), { target: { value: 'immer-angehalten' } });

    expect(onTournamentUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        matchCockpitSettings: expect.objectContaining({ clockMode: 'immer-angehalten' }),
      }),
    );
  });

  it('@W2A-035 Gegenbeispiel: „immer durchlaufend“ wird ebenfalls gespeichert (nicht nur die Vorgabe)', () => {
    currentRole = 'co-admin';
    const onTournamentUpdate = vi.fn();
    render(<MatchCockpitCategory tournamentId="tournament-1" tournament={neuesTurnier()} onTournamentUpdate={onTournamentUpdate} />);

    fireEvent.change(screen.getByTestId('settings-clock-mode'), { target: { value: 'immer-durchlaufend' } });

    expect(onTournamentUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        matchCockpitSettings: expect.objectContaining({ clockMode: 'immer-durchlaufend' }),
      }),
    );
  });

  it('@W2A-030 Erweiterung: Helfer (collaborator) sieht die Uhr-Art gesperrt, eine Änderung wird nicht gespeichert', () => {
    currentRole = 'collaborator';
    const onTournamentUpdate = vi.fn();
    render(<MatchCockpitCategory tournamentId="tournament-1" tournament={neuesTurnier()} onTournamentUpdate={onTournamentUpdate} />);

    const feld = screen.getByTestId('settings-clock-mode');
    expect(feld).toBeDisabled();
    fireEvent.change(feld, { target: { value: 'immer-angehalten' } });
    expect(onTournamentUpdate).not.toHaveBeenCalled();
  });
});

// Spiel mit zwei Abschnitten zu je 6 Minuten (12 Minuten gesamt): der gültige Bereich reicht bis 5.
function turnierMit(einstellungen: Partial<Tournament['matchCockpitSettings']>, dauerMinuten = 12, abschnitte = 2): Tournament {
  return {
    ...neuesTurnier(),
    groupPhaseGameDuration: dauerMinuten,
    gamePeriods: abschnitte,
    matchCockpitSettings: { ...DEFAULT_MATCH_COCKPIT_SETTINGS, ...einstellungen },
  };
}

function zeige(tournament: Tournament, rolle: TournamentRole = 'owner') {
  currentRole = rolle;
  const onTournamentUpdate = vi.fn();
  render(<MatchCockpitCategory tournamentId="tournament-1" tournament={tournament} onTournamentUpdate={onTournamentUpdate} />);
  return onTournamentUpdate;
}

const laenge = (): HTMLElement => screen.getByTestId('settings-final-phase-minutes');
const tippe = (wert: string): void => { fireEvent.change(laenge(), { target: { value: wert } }); };

describe('B-08e @W2A-040 – Länge der angehaltenen Schlussphase', () => {
  it('Vorgabe: bei „durchlaufend, letzte Minute angehalten“ ist das Feld da und steht auf 1', () => {
    zeige(turnierMit({}));
    expect(laenge()).toHaveValue(1);
  });

  it('Gegenbeispiel: bei „immer durchlaufend“ und „immer angehalten“ gibt es keine Schlussphase, das Feld fehlt', () => {
    zeige(turnierMit({ clockMode: 'immer-durchlaufend' }));
    expect(screen.queryByTestId('settings-final-phase-minutes')).not.toBeInTheDocument();
  });

  it('Gegenbeispiel: auch „immer angehalten“ zeigt das Feld nicht', () => {
    zeige(turnierMit({ clockMode: 'immer-angehalten' }));
    expect(screen.queryByTestId('settings-final-phase-minutes')).not.toBeInTheDocument();
  });

  it.each([['1', 1], ['5', 5], ['3', 3]])('Grenze: %s Minuten werden angenommen und gespeichert', (eingabe, erwartet) => {
    const onTournamentUpdate = zeige(turnierMit({ finalPhaseMinutes: 2 }));
    tippe(eingabe);
    expect(onTournamentUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ matchCockpitSettings: expect.objectContaining({ finalPhaseMinutes: erwartet }) }),
    );
  });

  it.each([['0'], ['6'], [''], ['2.5']])('Grenze: „%s“ wird nicht übernommen, die App nennt den Bereich 1 bis 5 Minuten', (eingabe) => {
    const onTournamentUpdate = zeige(turnierMit({ finalPhaseMinutes: 2 }));
    tippe(eingabe);
    expect(onTournamentUpdate).not.toHaveBeenCalled();
    expect(screen.getByTestId('settings-final-phase-range')).toHaveTextContent('1 bis 5 Minuten');
  });

  it('Gegenbeispiel: ein gültiger Wert zeigt keinen Hinweis', () => {
    zeige(turnierMit({ finalPhaseMinutes: 2 }));
    tippe('4');
    expect(screen.queryByTestId('settings-final-phase-range')).not.toBeInTheDocument();
  });

  it('länger als ein Abschnitt: bei Abschnitten zu 2 Minuten ist 3 ungültig, der Hinweis nennt 1 bis 2 Minuten', () => {
    const onTournamentUpdate = zeige(turnierMit({ finalPhaseMinutes: 1 }, 4, 2));
    tippe('3');
    expect(onTournamentUpdate).not.toHaveBeenCalled();
    expect(screen.getByTestId('settings-final-phase-range')).toHaveTextContent('1 bis 2 Minuten');
    tippe('2');
    expect(onTournamentUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ matchCockpitSettings: expect.objectContaining({ finalPhaseMinutes: 2 }) }),
    );
  });

  it('Randfall: ein Abschnitt unter einer Minute erlaubt keine Schlussphase, die App sagt das und übernimmt nichts', () => {
    const onTournamentUpdate = zeige(turnierMit({}, 1, 2)); // 2 x 30 Sekunden
    tippe('2');
    expect(onTournamentUpdate).not.toHaveBeenCalled();
    expect(screen.getByTestId('settings-final-phase-range')).toHaveTextContent('kürzer als eine Minute');
  });

  it('Verlassen des Feldes mit ungültiger Eingabe zeigt wieder den gespeicherten Wert, der Hinweis verschwindet', () => {
    zeige(turnierMit({ finalPhaseMinutes: 2 }));
    tippe('9');
    fireEvent.blur(laenge());
    expect(laenge()).toHaveValue(2);
    expect(screen.queryByTestId('settings-final-phase-range')).not.toBeInTheDocument();
  });

  it('@W2A-030 Erweiterung: Helfer sieht die Länge gesperrt, eine Änderung wird nicht gespeichert', () => {
    const onTournamentUpdate = zeige(turnierMit({}), 'collaborator');
    expect(laenge()).toBeDisabled();
    tippe('3');
    expect(onTournamentUpdate).not.toHaveBeenCalled();
  });

  it('Wechsel der Uhr-Art auf „immer angehalten“ lässt die gespeicherte Länge unverändert', () => {
    const onTournamentUpdate = zeige(turnierMit({ finalPhaseMinutes: 3 }));
    fireEvent.change(screen.getByTestId('settings-clock-mode'), { target: { value: 'immer-angehalten' } });
    expect(onTournamentUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ matchCockpitSettings: expect.objectContaining({ clockMode: 'immer-angehalten', finalPhaseMinutes: 3 }) }),
    );
  });
});
