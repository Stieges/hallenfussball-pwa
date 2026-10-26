/**
 * R3-5 Fixrunde 1 (Review #397 M-2, m-3): Torschützenliste. Erwartung aus @ET-041 („sieht die Torschützenliste“): nie ein leerer
 * Kasten – auch nicht, wenn kein Tor eine Rückennummer hat; Leertext je nach Stand (vorläufig / gespeichert).
 */
import { describe, expect, it, vi } from 'vitest';
vi.unmock('i18next');
vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../test/realDeI18n';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ScorerRow } from '../../../core/standings/finalStandings';
import type { TeamId } from '../../../core/models/schemas/MatchSlotSchema';
await initRealDeI18n();
const { ScorerList } = await import('../components/ScorerList');

const team = 'team-a' as TeamId;
const noNumber: ScorerRow = { kind: 'noNumber', rank: null, teamId: team, teamName: 'DJK Kammer', goals: 2 };
const ownGoals: ScorerRow = { kind: 'ownGoals', rank: null, teamId: team, teamName: 'DJK Otting', goals: 1 };
const player = (rank: number, number: number): ScorerRow => ({ kind: 'player', rank, teamId: team, teamName: 'DJK Kammer', number, goals: 5 - rank });

describe('@ET-041 Torschützenliste ohne Spielerzeile (M-2)', () => {
  it('nur Tore „ohne Nummer“ und Eigentore: die Sammelzeilen stehen gleich da, keine Taste, kein leerer Kasten', () => {
    render(<ScorerList scorers={[noNumber, ownGoals]} provisional={false} />);
    const rows = screen.getAllByTestId('final-scorer-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('ohne Nummer – DJK Kammer');
    expect(rows[1]).toHaveTextContent('Eigentore für DJK Otting');
    expect(screen.queryByTestId('final-scorers-toggle')).toBeNull();
    expect(document.querySelectorAll('ol')).toHaveLength(1);
  });

  it('Gegenbeispiel: mit Spielerzeilen bleiben Sammelzeilen hinter der Taste', () => {
    render(<ScorerList scorers={[player(1, 9), noNumber]} provisional={false} />);
    expect(screen.getAllByTestId('final-scorer-row')).toHaveLength(1);
    fireEvent.click(screen.getByTestId('final-scorers-toggle'));
    expect(screen.getAllByTestId('final-scorer-row')).toHaveLength(2);
  });
});

describe('Leertext je Stand (m-3)', () => {
  it('vorläufig: „Noch keine Tore.“, gespeichert: „Im Turnier ist kein Tor gefallen.“', () => {
    const { unmount } = render(<ScorerList scorers={[]} provisional />);
    expect(screen.getByTestId('final-scorers-empty')).toHaveTextContent('Noch keine Tore.');
    unmount();
    render(<ScorerList scorers={[]} provisional={false} />);
    expect(screen.getByTestId('final-scorers-empty')).toHaveTextContent('Im Turnier ist kein Tor gefallen.');
    expect(document.querySelectorAll('ol')).toHaveLength(0);
  });
});
