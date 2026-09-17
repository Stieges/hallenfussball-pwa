/** LiveCockpit — Tiebreaker-Bedienung (L1). Vorher: Handler in LiveCockpit.tsx:71–80 mit Unterstrich verworfen, Banner nie gerendert. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LiveCockpit } from '../LiveCockpit';
import type { LiveCockpitProps } from '../types';

vi.mock('../../../hooks/useMatchSound', () => ({
  useMatchSound: () => ({ play: vi.fn(), stop: vi.fn(), testPlay: vi.fn(), activate: vi.fn(), isPlaying: false, isLoading: false, isReady: true, isActivated: true, error: null }),
}));

function makeMatch(overrides: Record<string, unknown> = {}) {
  return {
    id: 'match-1', number: 7, phaseLabel: 'Finale', fieldId: 'field-1',
    scheduledKickoff: new Date().toISOString(), durationSeconds: 600,
    homeTeam: { id: 'team-a', name: 'FC Alpha' }, awayTeam: { id: 'team-b', name: 'SV Beta' },
    homeScore: 2, awayScore: 2, status: 'PAUSED', elapsedSeconds: 600, events: [],
    tournamentPhase: 'finalRound', tiebreakerMode: 'overtime-then-shootout',
    overtimeDurationSeconds: 300, awaitingTiebreakerChoice: true, playPhase: 'regular',
    ...overrides,
  };
}
function baseProps(match: unknown, handlers: Partial<LiveCockpitProps> = {}): LiveCockpitProps {
  return {
    fieldName: 'Feld 1', tournamentName: 'Test-Turnier', tournamentId: 'tour-1',
    currentMatch: match as never, upcomingMatches: [],
    onStart: vi.fn(), onPause: vi.fn(), onResume: vi.fn(), onFinish: vi.fn(), onGoal: vi.fn(),
    onUndoLastEvent: vi.fn(), onManualEditResult: vi.fn(), onAdjustTime: vi.fn(),
    onLoadNextMatch: vi.fn(), onReopenLastMatch: vi.fn(), ...handlers,
  };
}
const allTb = () => ({ onStartOvertime: vi.fn(), onStartGoldenGoal: vi.fn(), onStartPenaltyShootout: vi.fn(), onForceFinish: vi.fn() });

describe('LiveCockpit — Tiebreaker (L1)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('L1: zeigt das Tiebreaker-Banner, wenn awaitingTiebreakerChoice gesetzt ist', () => {
    render(<LiveCockpit {...baseProps(makeMatch(), allTb())} />);
    expect(screen.getByTestId('tiebreaker-banner')).toBeInTheDocument();
    expect(screen.getByText(/Unentschieden im Finalspiel/i)).toBeInTheDocument();
  });
  it('L1: ruft onStartOvertime mit der matchId', async () => {
    const h = allTb(); const user = userEvent.setup();
    render(<LiveCockpit {...baseProps(makeMatch(), h)} />);
    await user.click(screen.getByRole('button', { name: /Verlängerung starten/i }));
    expect(h.onStartOvertime).toHaveBeenCalledWith('match-1');
  });
  it('L1: ruft onStartPenaltyShootout über "Direkt zum Elfmeterschießen"', async () => {
    const h = allTb(); const user = userEvent.setup();
    render(<LiveCockpit {...baseProps(makeMatch(), h)} />);
    await user.click(screen.getByRole('button', { name: /Direkt zum Elfmeterschießen/i }));
    expect(h.onStartPenaltyShootout).toHaveBeenCalledWith('match-1');
  });
  it('L1: ruft onForceFinish über "Als Unentschieden beenden"', async () => {
    const h = allTb(); const user = userEvent.setup();
    render(<LiveCockpit {...baseProps(makeMatch(), h)} />);
    await user.click(screen.getByRole('button', { name: /Als Unentschieden beenden/i }));
    expect(h.onForceFinish).toHaveBeenCalledWith('match-1');
  });
  it('L1: zeigt bei goldenGoal den Golden-Goal-Button statt der Verlängerung', () => {
    render(<LiveCockpit {...baseProps(makeMatch({ tiebreakerMode: 'goldenGoal' }), allTb())} />);
    expect(screen.getByRole('button', { name: /Golden Goal starten/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Verlängerung starten/i })).not.toBeInTheDocument();
  });
  it('Regression: kein Banner ohne awaitingTiebreakerChoice', () => {
    render(<LiveCockpit {...baseProps(makeMatch({ awaitingTiebreakerChoice: false }), allTb())} />);
    expect(screen.queryByTestId('tiebreaker-banner')).not.toBeInTheDocument();
  });
});
