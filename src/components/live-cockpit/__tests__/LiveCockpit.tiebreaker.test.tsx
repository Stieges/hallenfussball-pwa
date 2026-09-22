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
  it('L1: ruft onStartPenaltyShootout über "Direkt zum Strafstoßschießen"', async () => {
    const h = allTb(); const user = userEvent.setup();
    render(<LiveCockpit {...baseProps(makeMatch(), h)} />);
    // t() ist in Tests gemockt (Passthrough mit Namespace-Präfix, siehe src/test/setup.ts) —
    // der Button-Text ist daher "Direkt zum sport:events.penaltyShootout", nicht der übersetzte Begriff.
    await user.click(screen.getByRole('button', { name: /Direkt zum sport:events\.penaltyShootout/i }));
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
    // t() ist in Tests gemockt (Passthrough mit Namespace-Präfix, siehe src/test/setup.ts) —
    // der Button-Text ist daher "sport:phases.goldenGoal starten", nicht der übersetzte Begriff.
    expect(screen.getByRole('button', { name: /sport:phases\.goldenGoal starten/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Verlängerung starten/i })).not.toBeInTheDocument();
  });
  it('Regression: kein Banner ohne awaitingTiebreakerChoice', () => {
    render(<LiveCockpit {...baseProps(makeMatch({ awaitingTiebreakerChoice: false }), allTb())} />);
    expect(screen.queryByTestId('tiebreaker-banner')).not.toBeInTheDocument();
  });
  it('L1: Score im Banner zählt die Verlängerungstore mit (overtimeScoreA/B), nicht nur die reguläre Zeit', () => {
    render(<LiveCockpit {...baseProps(makeMatch({ homeScore: 1, overtimeScoreA: 1, awayScore: 1, overtimeScoreB: 1 }), allTb())} />);
    expect(screen.getByText('2 : 2')).toBeInTheDocument();
  });
});

describe('LiveCockpit — Strafstoßschießen (L1)', () => {
  beforeEach(() => vi.clearAllMocks());
  // Fixwave-Fix (Critical): pen() liefert jetzt onAbortPenaltyShootout statt des entfernten
  // onCancelTiebreaker (das beendete das Spiel als Unentschieden — siehe MatchExecutionService.
  // cancelTiebreaker). onForceFinish ist mit im Bundle, damit die Tests unten beweisen können,
  // dass Abbrechen/Escape es NICHT auslösen.
  const pen = () => ({ onRecordPenaltyResult: vi.fn(), onAbortPenaltyShootout: vi.fn(), onForceFinish: vi.fn() });

  it('L1: öffnet den Dialog, wenn das Match in der Penalty-Phase ist', () => {
    render(<LiveCockpit {...baseProps(makeMatch({ playPhase: 'penalty', awaitingTiebreakerChoice: false }), pen())} />);
    expect(screen.getByTestId('penalty-shootout-dialog')).toBeInTheDocument();
  });
  it('Regression: kein Dialog in der regulären Phase', () => {
    render(<LiveCockpit {...baseProps(makeMatch({ playPhase: 'regular', awaitingTiebreakerChoice: false }), pen())} />);
    expect(screen.queryByTestId('penalty-shootout-dialog')).not.toBeInTheDocument();
  });
  it('Regression: kein Dialog bei bereits beendetem Match', () => {
    render(<LiveCockpit {...baseProps(makeMatch({ playPhase: 'penalty', status: 'FINISHED', awaitingTiebreakerChoice: false }), pen())} />);
    expect(screen.queryByTestId('penalty-shootout-dialog')).not.toBeInTheDocument();
  });

  // Fixwave-Fix (Critical): vorher pinnte dieser Test (unter dem Namen "Abbrechen ruft
  // onCancelTiebreaker mit der matchId") den Defekt als gewolltes Verhalten fest — "Abbrechen"
  // beendete damit unwiderruflich das Finale als Unentschieden. Jetzt beweist er das Gegenteil.
  it('Fixwave: Abbrechen ruft onAbortPenaltyShootout mit der matchId, NICHT onForceFinish', async () => {
    const h = pen(); const user = userEvent.setup();
    render(<LiveCockpit {...baseProps(makeMatch({ playPhase: 'penalty', awaitingTiebreakerChoice: false }), h)} />);
    await user.click(screen.getByRole('button', { name: /Abbrechen/i }));
    expect(h.onAbortPenaltyShootout).toHaveBeenCalledWith('match-1');
    expect(h.onForceFinish).not.toHaveBeenCalled();
  });

  it('Fixwave: Escape im Dialog verhält sich wie "Abbrechen" (onAbortPenaltyShootout, NICHT onForceFinish)', async () => {
    const h = pen(); const user = userEvent.setup();
    render(<LiveCockpit {...baseProps(makeMatch({ playPhase: 'penalty', awaitingTiebreakerChoice: false }), h)} />);
    expect(screen.getByTestId('penalty-shootout-dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(h.onAbortPenaltyShootout).toHaveBeenCalledWith('match-1');
    expect(h.onForceFinish).not.toHaveBeenCalled();
  });

  // Fixwave-Fix (Critical): der Zustand direkt nach einem Abbruch — abortPenaltyShootout setzt
  // awaitingTiebreakerChoice:true bei weiterhin playPhase:'penalty'. Der Dialog muss zu- und das
  // Banner aufgehen, sonst hätte der Organisator nach dem Abbrechen gar keine Handlungsoption mehr.
  it('Fixwave: awaitingTiebreakerChoice:true + playPhase:penalty (Zustand nach Abbruch) — kein Dialog, Banner sichtbar', () => {
    render(<LiveCockpit {...baseProps(makeMatch({ playPhase: 'penalty', awaitingTiebreakerChoice: true }), { ...pen(), ...allTb() })} />);
    expect(screen.queryByTestId('penalty-shootout-dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('tiebreaker-banner')).toBeInTheDocument();
  });

  // Regression (andere Richtung): der Abort-Fix darf den normalen Öffnen-Pfad nicht kaputt machen.
  it('Regression: awaitingTiebreakerChoice:false + playPhase:penalty öffnet weiterhin den Dialog', () => {
    render(<LiveCockpit {...baseProps(makeMatch({ playPhase: 'penalty', awaitingTiebreakerChoice: false }), pen())} />);
    expect(screen.getByTestId('penalty-shootout-dialog')).toBeInTheDocument();
  });
});
