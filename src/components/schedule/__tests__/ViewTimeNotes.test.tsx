/**
 * B-27 / B-26: Die Hinweise an den Spielkarten kommen aus der Ansicht (Zuschauer) – oder aus dem Spielplan der Leitung, der
 * Vorrang hat: Dort muss das ⋮-Menü je Spiel (@ZP-098) bleiben und die Uhrzeit der Leitung gelten (@ZP-004).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { TournamentView } from '../../../core/view';
import { ViewTimeNotes } from '../ViewTimeNotes';
import { MatchTimeShiftContext } from '../matchTimeShiftContext';
import { MatchMenuSlot, OriginalTimeNote } from '../MatchTimeShiftSlots';
import { initRealDeI18n } from '../../../test/realDeI18n';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

const view = {
  byId: new Map([['m1', { originalKickoff: { date: '2026-11-28', time: '15:30' }, kickoffTentative: true }]]),
} as unknown as TournamentView;

function Karte() {
  return <div><OriginalTimeNote matchId="m1" /><MatchMenuSlot matchId="m1" /></div>;
}

describe('ViewTimeNotes', () => {
  it('@ZP-004 @ZM-105 ohne Spielplan der Leitung: „ursprünglich 15:30“ und „voraussichtlich“ aus der Ansicht, kein ⋮', () => {
    render(<ViewTimeNotes view={view}><Karte /></ViewTimeNotes>);
    expect(screen.getByTestId('match-original-m1')).toHaveTextContent('ursprünglich 15:30');
    expect(screen.getByTestId('match-tentative-m1')).toHaveTextContent('voraussichtlich');
    expect(screen.queryByTestId('menu-m1')).toBeNull();
  });

  it('@ZP-098 Gegenbeispiel: im Spielplan der Leitung gelten deren Uhrzeit und ihr ⋮-Menü, die Ansicht überdeckt sie nicht', () => {
    render(
      <MatchTimeShiftContext.Provider value={{ originalTimeOf: () => '10:00', renderMenu: () => <button data-testid="menu-m1">⋮</button> }}>
        <ViewTimeNotes view={view}><Karte /></ViewTimeNotes>
      </MatchTimeShiftContext.Provider>,
    );
    expect(screen.getByTestId('menu-m1')).toBeInTheDocument();
    expect(screen.getByTestId('match-original-m1')).toHaveTextContent('ursprünglich 10:00');
    expect(screen.queryByTestId('match-tentative-m1')).toBeNull();
  });
});
