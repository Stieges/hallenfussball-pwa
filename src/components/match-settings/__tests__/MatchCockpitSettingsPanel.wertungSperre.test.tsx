/**
 * R2 PR 3 – Einstellung „Wertung bei Nichtantritt“ in den Turnier-Einstellungen (Admin Center, Kategorie „Match Cockpit“), mit der
 * echten Kategorie. Aus dem Gherkin (Record `2026-09-27_wizard-regelinhalte`):
 * - @W2A-025: Gegeben die Turnierleitung stellt die Nichtantritt-Wertung auf 3:0 / Wenn ein Nichtantritt markiert wird / Dann lautet
 *   die Wertung 3:0.
 * - @W2A-078: Ist schon ein Spiel als Nichtantritt gewertet, ist das Feld gesperrt und die App nennt den Grund; nach der Rücknahme der
 *   Wertung lässt sich die Einstellung wieder ändern.
 * Ersetzt das frühere `it.fails` (A-25c Auflage M2; Feld fehlte, Befund C-WERTUNG-EINSTELLUNG-OHNE-SPERRE). Der Name der Datei bleibt,
 * das Feld steht neben dem Panel (`ForfeitScoreField`), nicht im 600-Zeilen-Panel.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MatchCockpitCategory } from '../../../features/tournament-admin/categories/MatchCockpit';
import { DEFAULT_MATCH_COCKPIT_SETTINGS, type Match, type Tournament } from '../../../types/tournament';
import type { TournamentRole } from '../../../features/auth/types/auth.types';
import { forfeitEntrySpec } from '../../../core/match/resultEntryShootout';
import { forfeitResultFor } from '../../../core/models/forfeit';
import deCockpit from '../../../i18n/locales/de/cockpit.json';
import enCockpit from '../../../i18n/locales/en/cockpit.json';

vi.mock('../../../features/auth/hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: true, user: { id: 'user-1' } }),
}));
let currentRole: TournamentRole = 'owner';
vi.mock('../../../features/auth/hooks/useTournamentMembers', () => ({
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

const SPIEL = { id: 'm-7', teamA: 'team-c', teamB: 'team-d' };

/** Turnier mit Wertung 2:0; mit `gewertet` ist Spiel 7 als Nichtantritt von Team D gewertet. */
function turnier(gewertet: boolean): Tournament {
  const match = {
    id: SPIEL.id, round: 1, field: 1,
    slotA: { kind: 'team', teamId: SPIEL.teamA }, slotB: { kind: 'team', teamId: SPIEL.teamB },
    ...(gewertet ? { matchStatus: 'finished', scoreA: 2, scoreB: 0, decidedBy: 'forfeit', forfeitAbsent: 'B' } : { matchStatus: 'scheduled' }),
  } as unknown as Match;
  return {
    id: 'tournament-1', title: 'Test-Turnier', numberOfFields: 1, teams: [], matches: [match],
    forfeitScore: { winner: 2, loser: 0 },
    matchCockpitSettings: { ...DEFAULT_MATCH_COCKPIT_SETTINGS },
  } as unknown as Tournament;
}

function zeige(t: Tournament) {
  const onTournamentUpdate = vi.fn<(t: Tournament) => void>();
  render(<MatchCockpitCategory tournamentId="tournament-1" tournament={t} onTournamentUpdate={onTournamentUpdate} />);
  return { onTournamentUpdate, feld: screen.getByTestId('settings-forfeit-score') };
}

function stelleEin(feld: HTMLElement, wert: string): void {
  fireEvent.change(feld, { target: { value: wert } });
  fireEvent.blur(feld);
}

describe('@W2A-025 Wertung bei Nichtantritt einstellbar (Turnier-Einstellungen)', () => {
  beforeEach(() => { vi.clearAllMocks(); currentRole = 'owner'; });

  it('@W2A-025 vorbelegt 2:0; die Turnierleitung stellt 3:0 ein → gespeichert wird 3:0', () => {
    const { feld, onTournamentUpdate } = zeige(turnier(false));
    expect(feld).toHaveValue(2);
    expect(feld).toBeEnabled();
    stelleEin(feld, '3');
    expect(onTournamentUpdate).toHaveBeenCalledTimes(1);
    expect(onTournamentUpdate.mock.calls[0][0].forfeitScore).toEqual({ winner: 3, loser: 0 });
  });

  it('@W2A-025 Ende zu Ende: mit der eingestellten 3:0 lautet die Wertung eines markierten Nichtantritts 3:0', () => {
    const { feld, onTournamentUpdate } = zeige(turnier(false));
    stelleEin(feld, '3');
    const gespeichert = onTournamentUpdate.mock.calls[0][0];
    const tore = forfeitResultFor(gespeichert, 'B'); // Team D (Gast) tritt nicht an
    expect(tore).toEqual({ a: 3, b: 0 });
    const eintrag = forfeitEntrySpec({ teamAId: SPIEL.teamA, teamBId: SPIEL.teamB }, 'B', tore);
    expect(eintrag.payload).toEqual({ scores: { [SPIEL.teamA]: 3, [SPIEL.teamB]: 0 }, forfeit: { absent: 'B' } });
  });

  it('Gegenbeispiel: ein ungültiger Wert (0) wird am Feld abgelehnt und nicht gespeichert', () => {
    const { feld, onTournamentUpdate } = zeige(turnier(false));
    stelleEin(feld, '0');
    expect(onTournamentUpdate).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('settings.forfeitScoreRangeError');
    expect(feld).toHaveValue(2);
  });

  it('Gegenbeispiel @W2A-030: ein Helfer sieht das Feld gesperrt, nichts wird gespeichert', () => {
    currentRole = 'collaborator';
    const { feld, onTournamentUpdate } = zeige(turnier(false));
    expect(feld).toBeDisabled();
    stelleEin(feld, '3');
    expect(onTournamentUpdate).not.toHaveBeenCalled();
  });
});

describe('@W2A-078 gesperrt, sobald ein Spiel als Nichtantritt gewertet ist', () => {
  beforeEach(() => { vi.clearAllMocks(); currentRole = 'owner'; });

  it('@W2A-078 ein Spiel ist gewertet: Feld gesperrt, Grund steht am Feld, 3:0 wird nicht gespeichert', () => {
    const { feld, onTournamentUpdate } = zeige(turnier(true));
    expect(feld).toBeDisabled();
    expect(screen.getByTestId('settings-forfeit-score-locked')).toHaveTextContent('settings.forfeitScoreLocked');
    expect(feld).toHaveAttribute('aria-describedby');
    stelleEin(feld, '3');
    expect(onTournamentUpdate).not.toHaveBeenCalled();
  });

  it('@W2A-078 nach der Rücknahme der Wertung (Spiel wieder offen) ist das Feld wieder frei, ohne Sperr-Hinweis', () => {
    const { feld } = zeige(turnier(false));
    expect(feld).toBeEnabled();
    expect(screen.queryByTestId('settings-forfeit-score-locked')).toBeNull();
  });
});

describe('@W2A-078 Texte am Feld nennen den Grund, DE und EN gleich', () => {
  type Texte = { settings: Record<string, string> };
  const de = (deCockpit as unknown as Texte).settings;
  const en = (enCockpit as unknown as Texte).settings;

  it('der Sperr-Hinweis nennt den Grund und den Ausweg (Rücknahme), in beiden Sprachen', () => {
    expect(de.forfeitScoreLocked).toContain('schon ein Spiel als Nichtantritt gewertet');
    expect(de.forfeitScoreLocked).toContain('zurück');
    expect(en.forfeitScoreLocked).toContain('already recorded as a forfeit');
    expect(en.forfeitScoreLocked).toContain('Withdraw');
  });

  it('alle Texte des Feldes gibt es in DE und EN, mit denselben Platzhaltern', () => {
    for (const key of ['forfeitScore', 'forfeitScoreDesc', 'forfeitScoreRangeError', 'forfeitScoreLocked']) {
      expect(de[key], key).toBeTruthy();
      expect(en[key], key).toBeTruthy();
      const platzhalter = (t: string) => (t.match(/{{\w+}}/g) ?? []).sort();
      expect(platzhalter(en[key]), key).toEqual(platzhalter(de[key]));
    }
  });
});
