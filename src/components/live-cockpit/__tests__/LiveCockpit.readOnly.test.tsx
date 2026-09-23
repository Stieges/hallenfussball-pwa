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
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useCallback, useState } from 'react';
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

/**
 * Fixrunde 2 (task-R2-fix2-brief.md) — Abschluss-Review von Fixrunde 1 fand weitere Lücken:
 * H1 (PenaltyShootoutDialog ungesperrt), H1b (mobiles EventLogBottomSheet ungesperrt), M1
 * (mehrere Sperren ohne eigenen Test), M2 (Regression gegen 235d947 bei beendeten Spielen:
 * Einstellungen/Ereignisprotokoll waren dort NIE durch isFinished gesperrt).
 *
 * Helper für mobile Breakpoint: useBreakpoint() misst window.innerWidth beim Mount (siehe
 * src/hooks/useBreakpoint.ts, `handleResize()` wird synchron im ersten Effect-Lauf aufgerufen).
 * window.innerWidth VOR dem render() setzen genügt, RTL flusht den Mount-Effect in act().
 */
function setMobileViewport() {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
}
function setDesktopViewport() {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });
}

describe('LiveCockpit — Fixrunde 2 (H1): PenaltyShootoutDialog ehrt readOnly', () => {
  beforeEach(() => vi.clearAllMocks());

  function makePenaltyMatch(overrides: Record<string, unknown> = {}) {
    return makeMatch({
      status: 'PAUSED', playPhase: 'penalty', awaitingTiebreakerChoice: false,
      homeScore: 2, awayScore: 2,
      ...overrides,
    });
  }

  it('readOnly=true: der Dialog wird NICHT gerendert, obwohl playPhase=penalty (z.B. via Realtime von einem anderen Gerät)', () => {
    const onRecordPenaltyResult = vi.fn();
    const onAbortPenaltyShootout = vi.fn();
    render(
      <LiveCockpit {...baseProps(makePenaltyMatch(), { onRecordPenaltyResult, onAbortPenaltyShootout })} readOnly />
    );
    expect(screen.queryByTestId('penalty-shootout-dialog')).not.toBeInTheDocument();
  });

  it('readOnly=false: der Dialog öffnet sich automatisch — Verhalten wie vorher (Regel 3)', () => {
    const onRecordPenaltyResult = vi.fn();
    const onAbortPenaltyShootout = vi.fn();
    render(
      <LiveCockpit {...baseProps(makePenaltyMatch(), { onRecordPenaltyResult, onAbortPenaltyShootout })} />
    );
    expect(screen.getByTestId('penalty-shootout-dialog')).toBeInTheDocument();
  });
});

describe('LiveCockpit — Fixrunde 2 (H1b/M1): Mobiles Ereignisprotokoll-Sheet', () => {
  beforeEach(() => { vi.clearAllMocks(); setMobileViewport(); });
  afterEach(() => setDesktopViewport());

  function matchWithEvent(overrides: Record<string, unknown> = {}) {
    return makeMatch({
      status: 'PAUSED',
      events: [{ id: 'e1', matchId: 'match-1', type: 'GOAL', timestampSeconds: 30, payload: { teamId: 'team-a' }, scoreAfter: { home: 1, away: 0 } }],
      ...overrides,
    });
  }

  it('readOnly=true: Ereignisprotokoll-Knopf bleibt bedienbar (Regel 2: öffnen/lesen erlaubt) — Sheet zeigt KEINEN Bearbeiten-Knopf', async () => {
    const user = userEvent.setup();
    render(<LiveCockpit {...baseProps(matchWithEvent())} readOnly />);

    const eventLogButton = screen.getByTestId('match-event-log-button');
    expect(eventLogButton).not.toBeDisabled();

    await user.click(eventLogButton);
    // Sheet ist offen und zeigt das Ereignis (Lesen bleibt erlaubt) ...
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // ... aber ohne Bearbeiten-Knopf (H1b: onEventEdit war vorher ungesperrt). Exakter Text statt
    // getByRole-Namensregex: GameControls' "Zeit bearbeiten"-Knopf matcht /bearbeiten/i ebenfalls.
    expect(screen.queryByText('✏️ Bearbeiten')).not.toBeInTheDocument();
  });

  it('readOnly=false: Sheet zeigt den Bearbeiten-Knopf, Klick öffnet den Bearbeiten-Dialog — Verhalten wie vorher', async () => {
    const user = userEvent.setup();
    render(<LiveCockpit {...baseProps(matchWithEvent())} />);

    await user.click(screen.getByTestId('match-event-log-button'));
    const editButton = screen.getByText('✏️ Bearbeiten');
    expect(editButton).toBeInTheDocument();

    await user.click(editButton);
    // Sheet schließt sich, EventEditDialog öffnet sich (LiveCockpit.tsx onEventEdit-Handler) —
    // einziger offener Dialog an dieser Stelle.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/bearbeiten/i, { selector: 'h2' })).toBeInTheDocument();
  });
});

describe('LiveCockpit — Fixrunde 2 (M1): einzelne GameControls-Sperren unter readOnly', () => {
  beforeEach(() => vi.clearAllMocks());

  it('Rückgängig: readOnly=true disabled + Klick ruft onUndoLastEvent NICHT auf; readOnly=false enabled + Klick ruft es auf', async () => {
    const onUndoLastEvent = vi.fn();
    const match = makeMatch({
      status: 'PAUSED',
      events: [{ id: 'e1', matchId: 'match-1', type: 'GOAL', timestampSeconds: 10, payload: { teamId: 'team-a' }, scoreAfter: { home: 1, away: 0 } }],
    });
    const user = userEvent.setup();

    const { unmount } = render(<LiveCockpit {...baseProps(match, { onUndoLastEvent })} readOnly />);
    const undoButtonLocked = screen.getByTestId('match-undo-button');
    expect(undoButtonLocked).toBeDisabled();
    await user.click(undoButtonLocked);
    expect(onUndoLastEvent).not.toHaveBeenCalled();
    unmount();

    render(<LiveCockpit {...baseProps(match, { onUndoLastEvent })} />);
    const undoButtonUnlocked = screen.getByTestId('match-undo-button');
    expect(undoButtonUnlocked).not.toBeDisabled();
    await user.click(undoButtonUnlocked);
    expect(onUndoLastEvent).toHaveBeenCalledWith('match-1');
  });

  it('Seitenwechsel: readOnly=true disabled; readOnly=false enabled + Klick tauscht die Teams tatsächlich', async () => {
    // Review-Befund (Fixrunde 3, niedrig): nicht nur `disabled` prüfen, sondern wie die
    // Nachbartests den tatsächlichen Effekt. team-name-{home|away} bleibt inhaltlich konstant
    // (die testid folgt dem `side`-Prop, das beim Tausch mitwandert) — was sich ändert, ist die
    // DOM-REIHENFOLGE der beiden Blöcke (links/rechts). Das prüfen wir hier.
    const match = makeMatch({ status: 'PAUSED' });
    const user = userEvent.setup();

    const { unmount } = render(<LiveCockpit {...baseProps(match)} readOnly />);
    expect(screen.getByRole('button', { name: 'Seiten tauschen' })).toBeDisabled();
    unmount();

    const { container } = render(<LiveCockpit {...baseProps(match)} />);
    const switchButton = screen.getByRole('button', { name: 'Seiten tauschen' });
    expect(switchButton).not.toBeDisabled();

    const before = container.querySelectorAll('[data-testid^="team-name-"]');
    expect(before).toHaveLength(2);
    expect(before[0]).toHaveAttribute('data-testid', 'team-name-home');
    expect(before[1]).toHaveAttribute('data-testid', 'team-name-away');

    await user.click(switchButton);

    const after = container.querySelectorAll('[data-testid^="team-name-"]');
    expect(after[0]).toHaveAttribute('data-testid', 'team-name-away');
    expect(after[1]).toHaveAttribute('data-testid', 'team-name-home');
  });

  it('Halbzeit: readOnly=true disabled + Klick setzt die Fouls NICHT zurück; readOnly=false enabled + Klick setzt sie zurück', async () => {
    const match = makeMatch({
      status: 'PAUSED',
      events: [{ id: 'f1', matchId: 'match-1', type: 'FOUL', timestampSeconds: 5, payload: { teamId: 'team-a' } }],
    });
    const user = userEvent.setup();

    const { unmount } = render(<LiveCockpit {...baseProps(match)} readOnly />);
    expect(screen.getByTestId('foul-count-home')).toHaveTextContent('1');
    const halfTimeButtonLocked = screen.getByRole('button', { name: 'Halbzeit' });
    expect(halfTimeButtonLocked).toBeDisabled();
    await user.click(halfTimeButtonLocked);
    expect(screen.getByTestId('foul-count-home')).toHaveTextContent('1');
    unmount();

    render(<LiveCockpit {...baseProps(match)} />);
    expect(screen.getByTestId('foul-count-home')).toHaveTextContent('1');
    const halfTimeButtonUnlocked = screen.getByRole('button', { name: 'Halbzeit' });
    expect(halfTimeButtonUnlocked).not.toBeDisabled();
    await user.click(halfTimeButtonUnlocked);
    expect(screen.getByTestId('foul-count-home')).toHaveTextContent('0');
  });

  it('Einstellungen: readOnly=true öffnet den Dialog trotzdem, Eingaben sind disabled und lösen keinen Callback aus; readOnly=false alles wie vorher', async () => {
    // Review-Befund (Fixrunde 3, mittel): MatchCockpitSettingsPanel zeigt echte, synchronisierte
    // Werte (kein Lokalzustand wie beim Strafstoßschießen) — fällt NICHT unter "ausschließlich
    // schreibend". Regel 2: "Einstellungen ansehen, falls der Dialog etwas anzeigt" gilt hier
    // wörtlich. Der Button öffnet den Dialog deshalb IMMER; gesperrt werden nur die Eingaben
    // darin (natives <fieldset disabled> in MatchCockpitSettingsPanel).
    const onUpdateSettings = vi.fn();
    const match = makeMatch({ status: 'PAUSED' });
    const user = userEvent.setup();

    const { unmount } = render(<LiveCockpit {...baseProps(match, { onUpdateSettings })} readOnly />);
    const settingsButtonLocked = screen.getByRole('button', { name: 'Einstellungen' });
    expect(settingsButtonLocked).not.toBeDisabled();
    await user.click(settingsButtonLocked);
    expect(screen.getByText('Cockpit Einstellungen')).toBeInTheDocument();

    const vibrationToggleLocked = screen.getByRole('switch', { name: 'cockpit:settings.enableVibration' });
    expect(vibrationToggleLocked).toBeDisabled();
    await user.click(vibrationToggleLocked);
    expect(onUpdateSettings).not.toHaveBeenCalled();
    unmount();

    render(<LiveCockpit {...baseProps(match, { onUpdateSettings })} />);
    const settingsButtonUnlocked = screen.getByRole('button', { name: 'Einstellungen' });
    expect(settingsButtonUnlocked).not.toBeDisabled();
    await user.click(settingsButtonUnlocked);
    expect(screen.getByText('Cockpit Einstellungen')).toBeInTheDocument();

    const vibrationToggleUnlocked = screen.getByRole('switch', { name: 'cockpit:settings.enableVibration' });
    expect(vibrationToggleUnlocked).not.toBeDisabled();
    await user.click(vibrationToggleUnlocked);
    expect(onUpdateSettings).toHaveBeenCalled();
  });

  it('Ereignisprotokoll (mobil): bleibt unter readOnly bedienbar — öffnen erlaubt (Regel 2)', async () => {
    setMobileViewport();
    const match = makeMatch({ status: 'PAUSED' });
    const user = userEvent.setup();

    render(<LiveCockpit {...baseProps(match)} readOnly />);
    const eventLogButton = screen.getByTestId('match-event-log-button');
    expect(eventLogButton).not.toBeDisabled();
    await user.click(eventLogButton);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    setDesktopViewport();
  });
});

describe('LiveCockpit — Fixrunde 2 (M1): Tor-Knopf des Gast-Teams (TeamBlock rechts)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('readOnly=true: goal-button-away ist disabled, Klick ruft onGoal NICHT auf; readOnly=false: enabled, Klick ruft es auf', async () => {
    const onGoal = vi.fn();
    const match = makeMatch();
    const user = userEvent.setup();

    const { unmount } = render(<LiveCockpit {...baseProps(match, { onGoal })} readOnly />);
    const goalButtonLocked = screen.getByTestId('goal-button-away');
    expect(goalButtonLocked).toBeDisabled();
    await user.click(goalButtonLocked);
    expect(onGoal).not.toHaveBeenCalled();
    unmount();

    render(<LiveCockpit {...baseProps(match, { onGoal })} />);
    const goalButtonUnlocked = screen.getByTestId('goal-button-away');
    expect(goalButtonUnlocked).not.toBeDisabled();
    await user.click(goalButtonUnlocked);
    // goal-button-away öffnet erst den GoalScorerDialog (Torschütze erfassen); onGoal wird erst
    // beim Bestätigen/Überspringen aufgerufen (handleGoalConfirm → onGoal), siehe LiveCockpit.tsx.
    await user.click(screen.getByTestId('dialog-skip-button'));
    expect(onGoal).toHaveBeenCalledWith('match-1', 'team-b', 1, expect.anything());
  });
});

/**
 * M2 (Regel 1): bei beendeten Spielen (readOnly=false, isFinished) muss die Bedienung exakt wie
 * auf Commit 235d947 sein. Dort waren Einstellungen, Ereignisprotokoll (mobil) und der
 * Bearbeiten-Button in der Sidebar NIE durch isFinished gesperrt (siehe
 * `git show 235d947:src/components/live-cockpit/components/GameControls/index.tsx` — kein
 * `disabled`-Attribut an diesen beiden Buttons; `git show 235d947:.../LiveCockpit.tsx` —
 * `onEventEdit={handleEventEdit}` unbedingt).
 */
describe('LiveCockpit — Fixrunde 2 (M2): beendetes Spiel + readOnly=false — wie vor R2 (235d947)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('Einstellungen bleiben bedienbar', async () => {
    const user = userEvent.setup();
    render(<LiveCockpit {...baseProps(makeMatch({ status: 'FINISHED' }))} />);
    const settingsButton = screen.getByRole('button', { name: 'Einstellungen' });
    expect(settingsButton).not.toBeDisabled();
    await user.click(settingsButton);
    expect(screen.getByText('Cockpit Einstellungen')).toBeInTheDocument();
  });

  it('Ereignisprotokoll (mobil) bleibt bedienbar', async () => {
    setMobileViewport();
    const user = userEvent.setup();
    render(<LiveCockpit {...baseProps(makeMatch({ status: 'FINISHED' }))} />);
    const eventLogButton = screen.getByTestId('match-event-log-button');
    expect(eventLogButton).not.toBeDisabled();
    await user.click(eventLogButton);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    setDesktopViewport();
  });

  it('Sidebar zeigt weiterhin den Bearbeiten-Button für Ereignisse (Desktop)', () => {
    const match = makeMatch({
      status: 'FINISHED',
      events: [{ id: 'e1', matchId: 'match-1', type: 'GOAL', timestampSeconds: 30, payload: { team: 'home', delta: 1 }, scoreAfter: { home: 1, away: 0 } }],
    });
    render(<LiveCockpit {...baseProps(match)} />);
    expect(screen.getByTitle('cockpit:sidebar.edit')).toBeInTheDocument();
  });
});

/**
 * L2: Banner bekommt role="status" (Screenreader kündigt es als Statusmeldung an), der Timer
 * bekommt unter Sperre aria-disabled="true".
 */
describe('LiveCockpit — Fixrunde 2 (L2): ARIA-Attribute', () => {
  beforeEach(() => vi.clearAllMocks());

  it('Banner hat role="status"', () => {
    render(<LiveCockpit {...baseProps(makeMatch())} readOnly />);
    expect(screen.getByTestId('cockpit-readonly-banner')).toHaveAttribute('role', 'status');
  });

  it('Timer hat aria-disabled="true" unter Sperre (readOnly), "false" wenn entsperrt', () => {
    const { unmount } = render(<LiveCockpit {...baseProps(makeMatch())} readOnly />);
    expect(screen.getByTestId('match-timer-display')).toHaveAttribute('aria-disabled', 'true');
    unmount();

    render(<LiveCockpit {...baseProps(makeMatch())} />);
    expect(screen.getByTestId('match-timer-display')).toHaveAttribute('aria-disabled', 'false');
  });
});

/**
 * Fixrunde 4 (Task R4, H3): Auto-Finish ignorierte `readOnly` vollständig — der Effekt
 * (LiveCockpit.tsx, "Auto-Finish Logic") rief handleFinish() auf, sobald autoFinishEnabled
 * (Standard: true, DEFAULT_MATCH_COCKPIT_SETTINGS) && status === 'RUNNING' && isOvertime,
 * unabhängig vom Bearbeitungsrecht. Auf dem Gerät eines Viewers/Trainers hätte das Cockpit so
 * automatisch ein laufendes Spiel beendet: lokal (Offline-first) beendet, die DB lehnt den
 * Mutationsqueue-Eintrag für trainer/viewer ab (RLS), der Eintrag landet still in der
 * Dead-Letter-Queue, der lokale Stand weicht ab (final-review.md H3, bewiesen mit einem
 * temporären, danach gelöschten Test: readOnly=true → onFinish trotzdem 1×).
 *
 * `isOvertime` kommt aus useMatchTimerExtended(timerElapsedSeconds, ..., durationSeconds, ...) —
 * ohne timerStartTime berechnet sich `elapsedSeconds` synchron aus `timerElapsedSeconds` (kein
 * RAF-Loop, kein Timer-Mock nötig): timerElapsedSeconds > durationSeconds ⇒ isOvertime bereits
 * beim ersten Render.
 *
 * Test-Harness statt direktem `onFinish: vi.fn()`: Ein reiner No-Op-Mock lässt `currentMatch`
 * für immer auf `status: 'RUNNING'` stehen — die Guard-Bedingung des Effekts bliebe unter
 * readOnly=false dauerhaft erfüllt, und weil `useMatchSound` (siehe Mock oben) bei jedem Render
 * ein frisches Objekt liefert, bekommt `handleFinish` bei jedem Render eine neue Identität, die
 * Effekt-Abhängigkeitsliste ändert sich erneut, der Effekt feuert erneut — Endlosschleife
 * (verifiziert: der naive Aufbau ohne Harness hängt sich in `act()` auf, siehe Task-R4-Report).
 * Die Harness bildet nach, was in der echten App passiert (`onFinish` beendet das Spiel, der
 * Status wechselt weg von `RUNNING`): Nach dem ersten Aufruf kippt `status` auf `FINISHED`,
 * die Guard-Bedingung wird falsch, die Schleife bricht kontrolliert nach einem Aufruf ab.
 */
function makeOvertimeMatch(overrides: Record<string, unknown> = {}) {
  return makeMatch({
    status: 'RUNNING',
    durationSeconds: 600,
    timerElapsedSeconds: 700, // > durationSeconds ⇒ isOvertime
    ...overrides,
  });
}

function OvertimeAutoFinishHarness({ readOnly, onFinishSpy }: { readOnly: boolean; onFinishSpy: (matchId: string) => void }) {
  const [match, setMatch] = useState(() => makeOvertimeMatch());
  const handleFinish = useCallback((matchId: string) => {
    onFinishSpy(matchId);
    setMatch((prev) => ({ ...prev, status: 'FINISHED' }));
  }, [onFinishSpy]);
  return <LiveCockpit {...baseProps(match, { onFinish: handleFinish })} readOnly={readOnly} />;
}

describe('LiveCockpit — Fixrunde 4 (H3, Task R4): Auto-Finish ehrt readOnly', () => {
  beforeEach(() => vi.clearAllMocks());

  it('readOnly=true: autoFinishEnabled (Standard) + RUNNING + Spielzeit überschritten ⇒ onFinish wird NICHT automatisch aufgerufen', () => {
    const onFinishSpy = vi.fn();
    render(<OvertimeAutoFinishHarness readOnly onFinishSpy={onFinishSpy} />);
    expect(onFinishSpy).not.toHaveBeenCalled();
  });

  it('readOnly=false: dieselbe Situation ⇒ onFinish wird automatisch 1× aufgerufen — Kontrolle, Verhalten wie vorher', () => {
    const onFinishSpy = vi.fn();
    render(<OvertimeAutoFinishHarness readOnly={false} onFinishSpy={onFinishSpy} />);
    expect(onFinishSpy).toHaveBeenCalledTimes(1);
    expect(onFinishSpy).toHaveBeenCalledWith('match-1');
  });
});
