/**
 * LiveCockpit — `readOnly` sperrt die Bedienung wirklich (Task R2).
 *
 * Vorher: ManagementTab.tsx übergab `readOnly={!checkCanEditMatch(...)}` — eine echte
 * Berechtigungsprüfung — aber LiveCockpit.tsx destrukturierte die Prop nie. Wer laut
 * canEditResults() kein Bearbeitungsrecht hatte, konnte das Cockpit trotzdem voll bedienen.
 *
 * `isLocked = readOnly || isFinished` fasst beide Sperrgründe zusammen für die UI-Sperre
 * (Buttons disabled, Handler undefined), aber NUR `readOnly` zeigt das Berechtigungs-Banner —
 * ein beendetes Spiel braucht keine "du hast keine Berechtigung"-Erklärung (siehe Kommentar
 * in LiveCockpit.tsx bei `isLocked`).
 */
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
    id: 'match-1', number: 7, phaseLabel: 'Gruppenphase', fieldId: 'field-1',
    scheduledKickoff: new Date().toISOString(), durationSeconds: 600,
    homeTeam: { id: 'team-a', name: 'FC Alpha' }, awayTeam: { id: 'team-b', name: 'SV Beta' },
    homeScore: 1, awayScore: 0, status: 'RUNNING', elapsedSeconds: 30, playPhase: 'regular',
    events: [],
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

describe('LiveCockpit — readOnly sperrt die Bedienung (Task R2)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('readOnly=true: goal-button-home ist disabled, ein Klick ruft onGoal NICHT auf', async () => {
    const onGoal = vi.fn();
    const user = userEvent.setup();
    render(<LiveCockpit {...baseProps(makeMatch(), { onGoal })} readOnly />);

    const goalButton = screen.getByTestId('goal-button-home');
    expect(goalButton).toBeDisabled();

    // userEvent.click() auf einem disabled-Button löst in jsdom keinen Klick aus — trotzdem
    // explizit geprüft, damit ein künftiger Wegfall des disabled-Attributs (z.B. durch
    // versehentliches Entfernen von `isLocked` in TeamBlock) hier sichtbar würde.
    await user.click(goalButton);
    expect(onGoal).not.toHaveBeenCalled();
  });

  it('readOnly=true: Banner ist sichtbar', () => {
    render(<LiveCockpit {...baseProps(makeMatch())} readOnly />);
    expect(screen.getByTestId('cockpit-readonly-banner')).toBeInTheDocument();
  });

  it('readOnly=true: alle GameControls-Knöpfe sind disabled', () => {
    render(<LiveCockpit {...baseProps(makeMatch({ status: 'PAUSED' }))} readOnly />);
    expect(screen.getByTestId('match-start-button')).toBeDisabled();
    expect(screen.getByTestId('match-edit-time-button')).toBeDisabled();
    expect(screen.getByTestId('match-finish-button')).toBeDisabled();
  });

  it('readOnly=true: Timer-Klick öffnet den Zeit-Dialog NICHT', async () => {
    // Fixrunde 1 (Coordinator-Gegenprobe): die ursprüngliche Fassung suchte
    // `screen.queryByText('timeAdjust.title')` — unter dem i18next-Passthrough-Mock
    // (src/test/setup.ts) liefert t() aber `cockpit:timeAdjust.title` (Namespace-Präfix,
    // siehe TimeAdjustDialog.tsx:105 `t('timeAdjust.title')` unter useTranslation('cockpit')).
    // Die Query fand deshalb NIE etwas — weder offen noch geschlossen — und der Test bestand
    // unabhängig davon, ob der Dialog aufging. Jetzt über role="dialog" geprüft
    // (TimeAdjustDialog.tsx:100-102), das nur bei isOpen=true gerendert wird.
    const user = userEvent.setup();
    render(<LiveCockpit {...baseProps(makeMatch())} readOnly />);
    await user.click(screen.getByTestId('match-timer-display'));
    expect(screen.queryByRole('dialog', { name: 'cockpit:timeAdjust.title' })).not.toBeInTheDocument();
  });

  it('readOnly=false: Timer-Klick öffnet den Zeit-Dialog — Verhalten wie vorher', async () => {
    const user = userEvent.setup();
    render(<LiveCockpit {...baseProps(makeMatch())} />);
    await user.click(screen.getByTestId('match-timer-display'));
    expect(screen.getByRole('dialog', { name: 'cockpit:timeAdjust.title' })).toBeInTheDocument();
  });

  it('readOnly=true: Sidebar zeigt keinen Bearbeiten-Button für Ereignisse', () => {
    const match = makeMatch({
      status: 'PAUSED',
      events: [{ id: 'e1', matchId: 'match-1', type: 'GOAL', timestampSeconds: 30, payload: { team: 'home', delta: 1 }, scoreAfter: { home: 1, away: 0 } }],
    });
    render(<LiveCockpit {...baseProps(match)} readOnly />);
    expect(screen.queryByTitle('cockpit:sidebar.edit')).not.toBeInTheDocument();
  });

  it('readOnly=false (Standard): goal-button-home ist NICHT disabled, kein Banner — Verhalten wie vorher', () => {
    render(<LiveCockpit {...baseProps(makeMatch())} />);
    expect(screen.getByTestId('goal-button-home')).not.toBeDisabled();
    expect(screen.queryByTestId('cockpit-readonly-banner')).not.toBeInTheDocument();
  });

  it('readOnly=false + isFinished: gesperrt wie zuvor (Match-Ende), aber KEIN Berechtigungs-Banner', () => {
    render(<LiveCockpit {...baseProps(makeMatch({ status: 'FINISHED' }))} />);
    expect(screen.getByTestId('goal-button-home')).toBeDisabled();
    expect(screen.queryByTestId('cockpit-readonly-banner')).not.toBeInTheDocument();
  });
});

/**
 * Fixrunde 1 (Coordinator-Gegenprobe): die vier Tiebreaker-Handler
 * (LiveCockpit.tsx:1188-1191, `onStartOvertime`/`onStartGoldenGoal`/`onStartPenaltyShootout`/
 * `onEndAsDraw` jeweils `&& !isLocked`) hatten keinen Test, der readOnly UND
 * awaitingTiebreakerChoice kombinierte — die Mutationsprobe "alle vier `&& !isLocked` entfernt"
 * lief mit dem ursprünglichen Report noch grün durch. Jeder der vier Handler wird hier EINZELN
 * geprüft (nicht stellvertretend durch einen), in beiden Richtungen. Match-Fixture nach dem
 * Muster von LiveCockpit.tiebreaker.test.tsx (awaitingTiebreakerChoice, tiebreakerMode).
 */
function makeTiebreakerMatch(overrides: Record<string, unknown> = {}) {
  return makeMatch({
    homeScore: 2, awayScore: 2, status: 'PAUSED', elapsedSeconds: 600,
    tiebreakerMode: 'overtime-then-shootout', overtimeDurationSeconds: 300,
    awaitingTiebreakerChoice: true, playPhase: 'regular',
    ...overrides,
  });
}

describe('LiveCockpit — readOnly sperrt die Tiebreaker-Aktionen (Task R2, Fixrunde 1)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('onStartOvertime: gesperrt ⇒ "Verlängerung starten" ist nicht vorhanden; entsperrt ⇒ Klick ruft onStartOvertime(matchId) auf', async () => {
    const onStartOvertime = vi.fn();
    const match = makeTiebreakerMatch({ tiebreakerMode: 'overtime-then-shootout' });

    const { unmount } = render(<LiveCockpit {...baseProps(match, { onStartOvertime })} readOnly />);
    expect(screen.getByTestId('tiebreaker-banner')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Verlängerung starten/i })).not.toBeInTheDocument();
    unmount();

    const user = userEvent.setup();
    render(<LiveCockpit {...baseProps(match, { onStartOvertime })} />);
    await user.click(screen.getByRole('button', { name: /Verlängerung starten/i }));
    expect(onStartOvertime).toHaveBeenCalledWith('match-1');
  });

  it('onStartGoldenGoal: gesperrt ⇒ Golden-Goal-Button ist nicht vorhanden; entsperrt ⇒ Klick ruft onStartGoldenGoal(matchId) auf', async () => {
    const onStartGoldenGoal = vi.fn();
    const match = makeTiebreakerMatch({ tiebreakerMode: 'goldenGoal' });

    const { unmount } = render(<LiveCockpit {...baseProps(match, { onStartGoldenGoal })} readOnly />);
    expect(screen.getByTestId('tiebreaker-banner')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sport:phases\.goldenGoal starten/i })).not.toBeInTheDocument();
    unmount();

    const user = userEvent.setup();
    render(<LiveCockpit {...baseProps(match, { onStartGoldenGoal })} />);
    await user.click(screen.getByRole('button', { name: /sport:phases\.goldenGoal starten/i }));
    expect(onStartGoldenGoal).toHaveBeenCalledWith('match-1');
  });

  it('onStartPenaltyShootout: gesperrt ⇒ Strafstoßschießen-Button ist nicht vorhanden; entsperrt ⇒ Klick ruft onStartPenaltyShootout(matchId) auf', async () => {
    const onStartPenaltyShootout = vi.fn();
    const match = makeTiebreakerMatch({ tiebreakerMode: 'shootout' });

    const { unmount } = render(<LiveCockpit {...baseProps(match, { onStartPenaltyShootout })} readOnly />);
    expect(screen.getByTestId('tiebreaker-banner')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sport:events\.penaltyShootout starten/i })).not.toBeInTheDocument();
    unmount();

    const user = userEvent.setup();
    render(<LiveCockpit {...baseProps(match, { onStartPenaltyShootout })} />);
    await user.click(screen.getByRole('button', { name: /sport:events\.penaltyShootout starten/i }));
    expect(onStartPenaltyShootout).toHaveBeenCalledWith('match-1');
  });

  it('onForceFinish ("Als Unentschieden beenden"): gesperrt ⇒ Button ist nicht vorhanden; entsperrt ⇒ Klick ruft onForceFinish(matchId) auf', async () => {
    const onForceFinish = vi.fn();
    const match = makeTiebreakerMatch();

    const { unmount } = render(<LiveCockpit {...baseProps(match, { onForceFinish })} readOnly />);
    expect(screen.getByTestId('tiebreaker-banner')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Als Unentschieden beenden/i })).not.toBeInTheDocument();
    unmount();

    const user = userEvent.setup();
    render(<LiveCockpit {...baseProps(match, { onForceFinish })} />);
    await user.click(screen.getByRole('button', { name: /Als Unentschieden beenden/i }));
    expect(onForceFinish).toHaveBeenCalledWith('match-1');
  });
});
