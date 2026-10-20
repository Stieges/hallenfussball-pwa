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
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LiveCockpit } from '../LiveCockpit';
import type { LiveCockpitProps } from '../types';
import { engineHuelle } from './engineLogFixture';
import { REGEL_2X6, spielAnlegen, zu, type EngineSpiel } from './enginePhaseFixture';

vi.mock('../../../hooks/useMatchSound', () => ({
  useMatchSound: () => ({ play: vi.fn(), stop: vi.fn(), testPlay: vi.fn(), activate: vi.fn(), isPlaying: false, isLoading: false, isReady: true, isActivated: true, error: null }),
}));

// A4 (C-SYNC): SyncStatusIndicator (neu im Match-Header) braucht RepositoryContext via
// useSyncStatus/useRepositories -- diese Tests rendern LiveCockpit ohne Provider. isCloudSyncAvailable
// false spiegelt exakt den Gast/lokal-Fall wider (kein Provider = keine Cloud), Indicator rendert nichts.
vi.mock('../../../hooks/useSyncStatus', () => ({
  useSyncStatus: () => ({
    status: 'synced', isSyncing: false, pendingChanges: 0, failedChanges: 0, failedMutations: [],
    syncTournament: vi.fn(), retryFailedMutation: vi.fn(), discardFailedMutation: vi.fn(),
    isCloudSyncAvailable: false,
  }),
}));

// C3b-1: LiveCockpit bindet useEngineEventEditing ein -> useActorRole (braucht AuthProvider); hier nicht Gegenstand.
vi.mock('../../../hooks/useActorRole', () => ({ useActorRole: () => 'helper' }));

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
    currentMatch: match as never, upcomingMatches: [], kannSteuern: true,
    onStart: vi.fn(), onPause: vi.fn(), onResume: vi.fn(), onFinish: vi.fn(), onGoal: vi.fn(),
    onUndoLastEvent: vi.fn(), onManualEditResult: vi.fn(), onAdjustTime: vi.fn(),
    onLoadNextMatch: vi.fn(), onReopenLastMatch: vi.fn(), ...handlers,
  };
}

describe('LiveCockpit — readOnly sperrt die Bedienung (Task R2)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('@SL-018 readOnly=true: die Spalte hat keine Tor-Taste (Zähler bleibt), onGoal wird nie gerufen', () => {
    const onGoal = vi.fn();
    render(<LiveCockpit {...baseProps(makeMatch(), { onGoal })} kannSteuern={false} />);

    expect(screen.queryByTestId('goal-button-home')).toBeNull();
    expect(screen.queryByTestId('foul-button-home')).toBeNull();
    expect(screen.queryByTestId('card-button-home')).toBeNull();
    expect(screen.queryByTestId('penalty-button-home')).toBeNull();
    expect(screen.getByTestId('team-fouls-home')).toBeInTheDocument();
    expect(onGoal).not.toHaveBeenCalled();
  });

  it('readOnly=true: Banner ist sichtbar', () => {
    render(<LiveCockpit {...baseProps(makeMatch())} kannSteuern={false} />);
    expect(screen.getByTestId('cockpit-readonly-banner')).toBeInTheDocument();
  });

  it('readOnly=true: keine Steuer-Knöpfe der Daumenleiste (Weiter, Abpfiff, Rückgängig); in „Mehr“ fehlt „Uhr korrigieren“', async () => {
    // Seit Aufgabe 3.6 ersetzt die Nur-Lesen-Zeile die Leiste (Spec § 4.4): die Knöpfe sind nicht mehr gesperrt, sondern nicht da.
    const user = userEvent.setup();
    render(<LiveCockpit {...baseProps(makeMatch({ status: 'PAUSED' }))} kannSteuern={false} />);
    expect(screen.queryByRole('toolbar')).toBeNull();
    expect(screen.queryByTestId('match-resume-button')).toBeNull();
    expect(screen.queryByTestId('match-finish-button')).toBeNull();
    expect(screen.queryByTestId('match-undo-button')).toBeNull();
    await user.click(screen.getByTestId('cockpit-more-button'));
    expect(screen.queryByTestId('mehr-uhr-korrigieren')).toBeNull();
  });

  it('readOnly=true: „Zeit bearbeiten“ öffnet den Zeit-Dialog NICHT (die Uhr der Tafel ist reine Anzeige)', async () => {
    // Fixrunde 1 (Coordinator-Gegenprobe): die ursprüngliche Fassung suchte
    // `screen.queryByText('timeAdjust.title')` — unter dem i18next-Passthrough-Mock
    // (src/test/setup.ts) liefert t() aber `cockpit:timeAdjust.title` (Namespace-Präfix,
    // siehe TimeAdjustDialog.tsx:105 `t('timeAdjust.title')` unter useTranslation('cockpit')).
    // Die Query fand deshalb NIE etwas — weder offen noch geschlossen — und der Test bestand
    // unabhängig davon, ob der Dialog aufging. Jetzt über role="dialog" geprüft
    // (TimeAdjustDialog.tsx:100-102), das nur bei isOpen=true gerendert wird.
    const user = userEvent.setup();
    render(<LiveCockpit {...baseProps(makeMatch())} kannSteuern={false} />);
    await user.click(screen.getByTestId('scoreboard-clock'));
    await user.click(screen.getByTestId('cockpit-more-button'));
    expect(screen.queryByTestId('mehr-uhr-korrigieren')).toBeNull();
    expect(screen.queryByRole('dialog', { name: 'cockpit:timeAdjust.title' })).not.toBeInTheDocument();
  });

  it('readOnly=false: „Zeit bearbeiten“ öffnet den Zeit-Dialog — Verhalten wie vorher', async () => {
    const user = userEvent.setup();
    render(<LiveCockpit {...baseProps(makeMatch())} />);
    await user.click(screen.getByTestId('cockpit-more-button'));
    await user.click(screen.getByTestId('mehr-uhr-korrigieren'));
    expect(screen.getByRole('dialog', { name: 'cockpit:timeAdjust.title' })).toBeInTheDocument();
  });

  it('readOnly=true: Sidebar zeigt keinen Bearbeiten-Button für Ereignisse', () => {
    const match = makeMatch({
      status: 'PAUSED',
      events: [{ id: 'e1', matchId: 'match-1', type: 'GOAL', timestampSeconds: 30, payload: { team: 'home', delta: 1 }, scoreAfter: { home: 1, away: 0 } }],
    });
    render(<LiveCockpit {...baseProps(match)} kannSteuern={false} />);
    expect(screen.queryByTitle('cockpit:sidebar.edit')).not.toBeInTheDocument();
  });

  it('readOnly=false (Standard): Tor-Taste da und nicht disabled, kein Banner — Verhalten wie vorher', () => {
    render(<LiveCockpit {...baseProps(makeMatch())} />);
    expect(screen.getByTestId('goal-button-home')).not.toBeDisabled();
    expect(screen.queryByTestId('cockpit-readonly-banner')).not.toBeInTheDocument();
  });

  it('readOnly=false + isFinished: keine Tasten wie zuvor gesperrt (Match-Ende, @SL-113), aber KEIN Berechtigungs-Banner', () => {
    render(<LiveCockpit {...baseProps(makeMatch({ status: 'FINISHED' }))} />);
    expect(screen.queryByTestId('goal-button-home')).toBeNull();
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

    const { unmount } = render(<LiveCockpit {...baseProps(match, { onStartOvertime })} kannSteuern={false} />);
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

    const { unmount } = render(<LiveCockpit {...baseProps(match, { onStartGoldenGoal })} kannSteuern={false} />);
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

    const { unmount } = render(<LiveCockpit {...baseProps(match, { onStartPenaltyShootout })} kannSteuern={false} />);
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

    const { unmount } = render(<LiveCockpit {...baseProps(match, { onForceFinish })} kannSteuern={false} />);
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
      <LiveCockpit {...baseProps(makePenaltyMatch(), { onRecordPenaltyResult, onAbortPenaltyShootout })} kannSteuern={false} />
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
    render(<LiveCockpit {...baseProps(matchWithEvent())} kannSteuern={false} />);

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
    // i18n ist hier Key-Passthrough: der Titel kommt ueber `eventEditDialog.title` (kein hartkodiertes "bearbeiten" mehr).
    expect(screen.getByRole('heading', { name: 'cockpit:eventEditDialog.title' })).toBeInTheDocument();
  });
});

describe('LiveCockpit — Fixrunde 2 (M1): einzelne GameControls-Sperren unter readOnly', () => {
  beforeEach(() => vi.clearAllMocks());

  it('A-08c: ohne Engine-Ansicht ist Rückgängig gesperrt und ruft den Altweg nie, auch nicht unter readOnly=false (Altweg entfernt)', async () => {
    const onUndoLastEvent = vi.fn();
    const match = makeMatch({
      status: 'PAUSED',
      events: [{ id: 'e1', matchId: 'match-1', type: 'GOAL', timestampSeconds: 10, payload: { teamId: 'team-a' }, scoreAfter: { home: 1, away: 0 } }],
    });

    const { unmount } = render(<LiveCockpit {...baseProps(match, { onUndoLastEvent })} kannSteuern={false} />);
    expect(screen.queryByTestId('match-undo-button')).toBeNull();
    unmount();

    render(<LiveCockpit {...baseProps(match, { onUndoLastEvent })} />);
    // Der Platz bleibt stehen (die Leiste springt nicht), ohne Engine-Weg ist er gesperrt (@FU-071)
    expect(screen.getByTestId('match-undo-button')).toBeDisabled();
    await userEvent.click(screen.getByTestId('match-undo-button'));
    expect(onUndoLastEvent).not.toHaveBeenCalled();
  });

  it('Seitenwechsel (@SL-065): bleibt auch unter readOnly=true bedienbar (nur die eigene Anzeige, darf.ts); Klick tauscht die Teams tatsächlich', async () => {
    // Review-Befund (Fixrunde 3, niedrig): nicht nur `disabled` prüfen, sondern wie die
    // Nachbartests den tatsächlichen Effekt. team-column-{home|away} bleibt inhaltlich konstant
    // (die testid folgt dem `seite`-Prop, das beim Tausch mitwandert) — was sich ändert, ist die
    // DOM-REIHENFOLGE der beiden Spalten (links/rechts). Das prüfen wir hier.
    const match = makeMatch({ status: 'PAUSED' });
    const user = userEvent.setup();

    // Nur-Lesen: Seiten tauschen ändert nur die Anzeige dieses Geräts und bleibt erreichbar (`darfImZustand`: auch ohne Steuer)
    const lesen = render(<LiveCockpit {...baseProps(match)} kannSteuern={false} />);
    await user.click(screen.getByTestId('cockpit-more-button'));
    expect(screen.getByTestId('mehr-seiten-tauschen')).not.toBeDisabled();
    lesen.unmount();

    const { container } = render(<LiveCockpit {...baseProps(match)} />);
    await user.click(screen.getByTestId('cockpit-more-button'));
    const switchButton = screen.getByTestId('mehr-seiten-tauschen');
    expect(switchButton).not.toBeDisabled();

    const before = container.querySelectorAll('[data-testid^="team-column-"]');
    expect(before).toHaveLength(2);
    expect(before[0]).toHaveAttribute('data-testid', 'team-column-home');
    expect(before[1]).toHaveAttribute('data-testid', 'team-column-away');

    await user.click(switchButton);

    const after = container.querySelectorAll('[data-testid^="team-column-"]');
    expect(after[0]).toHaveAttribute('data-testid', 'team-column-away');
    expect(after[1]).toHaveAttribute('data-testid', 'team-column-home');
  });

  it('Halbzeit: der Knopf fehlt im Cockpit bei JEDEM Status (Platzhalter-Liste Nr. 3, @OB-002; B-08 baut Halbzeit)', () => {
    // Ruling B-03 Fixrunde 1: Platzhalter-Liste Nr. 3, @OB-002; B-08 baut Halbzeit.
    // Bis dahin verschwindet der Knopf „Halbzeit“ bei JEDEM Status — auch bei RUNNING und PAUSED.
    // Die alte Aussage (disabled bei readOnly, Klick setzt die Fouls zurück) ist mit dem Ruling
    // entfallen: handleHalfTime und der Knopf sind bis B-08 komplett entfernt.
    for (const status of ['NOT_STARTED', 'RUNNING', 'PAUSED', 'FINISHED'] as const) {
      const { unmount } = render(<LiveCockpit {...baseProps(makeMatch({ status }))} />);
      expect(screen.queryByRole('button', { name: 'Halbzeit' })).not.toBeInTheDocument();
      unmount();
    }
    render(<LiveCockpit {...baseProps(makeMatch({ status: 'RUNNING' }))} kannSteuern={false} />);
    expect(screen.queryByRole('button', { name: 'Halbzeit' })).not.toBeInTheDocument();
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

    const { unmount } = render(<LiveCockpit {...baseProps(match, { onUpdateSettings })} kannSteuern={false} />);
    await user.click(screen.getByTestId('cockpit-more-button'));
    const settingsButtonLocked = screen.getByTestId('mehr-einstellungen');
    expect(settingsButtonLocked).not.toBeDisabled();
    await user.click(settingsButtonLocked);
    expect(screen.getByText('Cockpit Einstellungen')).toBeInTheDocument();

    const vibrationToggleLocked = screen.getByRole('switch', { name: 'cockpit:settings.enableVibration' });
    expect(vibrationToggleLocked).toBeDisabled();
    await user.click(vibrationToggleLocked);
    expect(onUpdateSettings).not.toHaveBeenCalled();
    unmount();

    render(<LiveCockpit {...baseProps(match, { onUpdateSettings })} />);
    await user.click(screen.getByTestId('cockpit-more-button'));
    const settingsButtonUnlocked = screen.getByTestId('mehr-einstellungen');
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

    render(<LiveCockpit {...baseProps(match)} kannSteuern={false} />);
    const eventLogButton = screen.getByTestId('match-event-log-button');
    expect(eventLogButton).not.toBeDisabled();
    await user.click(eventLogButton);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    setDesktopViewport();
  });
});

describe('LiveCockpit — Fixrunde 2 (M1): Tor-Knopf des Gast-Teams (Team-Spalte rechts)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('@SL-018 readOnly=true: keine Tor-Taste für das Gast-Team; readOnly=false: da, der erste Tipp zählt das Tor sofort (@SL-019)', async () => {
    const onGoal = vi.fn();
    const match = makeMatch();
    const user = userEvent.setup();

    const { unmount } = render(<LiveCockpit {...baseProps(match, { onGoal })} kannSteuern={false} />);
    expect(screen.queryByTestId('goal-button-away')).toBeNull();
    expect(onGoal).not.toHaveBeenCalled();
    unmount();

    render(<LiveCockpit {...baseProps(match, { onGoal })} />);
    const goalButtonUnlocked = screen.getByTestId('goal-button-away');
    expect(goalButtonUnlocked).not.toBeDisabled();
    await user.click(goalButtonUnlocked);
    // Seit Aufgabe 3.4 zählt das Tor mit dem ersten Tipp; die Nummernauswahl folgt nur für den Nachtrag.
    expect(onGoal).toHaveBeenCalledWith('match-1', 'team-b', 1, undefined);
    expect(screen.getByTestId('number-picker')).toBeInTheDocument();
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
  afterEach(() => setDesktopViewport()); // auch nach dem erwartet fehlschlagenden Handy-Test wieder Laptop-Breite

  it('Einstellungen bleiben bedienbar', async () => {
    const user = userEvent.setup();
    render(<LiveCockpit {...baseProps(makeMatch({ status: 'FINISHED' }))} />);
    await user.click(screen.getByTestId('cockpit-more-button'));
    const settingsButton = screen.getByTestId('mehr-einstellungen');
    expect(settingsButton).not.toBeDisabled();
    await user.click(settingsButton);
    expect(screen.getByText('Cockpit Einstellungen')).toBeInTheDocument();
  });

  // Befund C-COCKPIT-EREIGNISSE-NACH-ABPFIFF-HANDY: Die Tabelle `leisteFuer` (Plan 3.6) kennt im Zustand `abgepfiffen` unter
  // 1024 px keinen Platz „Ereignisse“. Damit ist die Liste der Einträge nach dem Abpfiff am Handy nicht mehr erreichbar, obwohl
  // Spec § 6 „Nummer nachtragen über die Liste“ verlangt (@SL-113). Der Test bleibt wörtlich, bis die Tabelle entschieden ist.
  it.fails('Ereignisprotokoll (mobil) bleibt bedienbar (Befund C-COCKPIT-EREIGNISSE-NACH-ABPFIFF-HANDY, Ziel Plan 3.6 / LT-4)', async () => {
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
    render(<LiveCockpit {...baseProps(makeMatch())} kannSteuern={false} />);
    expect(screen.getByTestId('cockpit-readonly-banner')).toHaveAttribute('role', 'status');
  });

  it('Die Uhr der Tafel ist reine Anzeige (kein Knopf, kein aria-disabled); „Mehr“ bleibt unter Sperre und sonst bedienbar', () => {
    const { unmount } = render(<LiveCockpit {...baseProps(makeMatch())} kannSteuern={false} />);
    expect(screen.getByTestId('scoreboard-clock')).not.toHaveAttribute('aria-disabled');
    expect(screen.getByTestId('scoreboard-clock')).not.toHaveAttribute('role');
    unmount();

    render(<LiveCockpit {...baseProps(makeMatch())} />);
    expect(screen.getByTestId('cockpit-more-button')).not.toBeDisabled();
  });
});

/**
 * Fixrunde 4 (Task R4, H3): Auto-Finish ignorierte `readOnly` vollständig – auf dem Gerät eines Viewers/Trainers hätte
 * das Cockpit ein laufendes Spiel automatisch beendet (lokal beendet, die DB lehnt den Eintrag ab, der lokale Stand
 * weicht ab; final-review.md H3).
 *
 * B-08b: das Ende von selbst ist `useAutoSectionEnd` und läuft über die Engine. Die Tests nehmen deshalb eine echte
 * Engine mit angepfiffenem Spiel (1 x 10 Minuten) und stellen die Uhr hinter die Grenze; geprüft wird das Log
 * (kein / genau ein `MATCH_END`), nicht ein `onFinish`-Mock.
 */
const GRENZE_MS = 600_000;

function engineSpielMatch(spiel: EngineSpiel) {
  return makeMatch({
    id: spiel.matchId, homeTeam: { id: 'teama', name: 'FC Alpha' }, awayTeam: { id: 'teamb', name: 'SV Beta' },
    status: 'RUNNING', durationSeconds: 600, timerElapsedSeconds: 0,
  });
}

async function laufendesSpiel() {
  vi.useFakeTimers({ toFake: ['Date'] });
  zu(0);
  const spiel = await spielAnlegen();
  await spiel.a.commands.start(spiel.matchId, spiel.ctx, 'leitung', { ...REGEL_2X6, sections: 1, sectionSeconds: 600 });
  const mitEngine = engineHuelle(spiel);
  const enden = (): number => (spiel.a.engine.view(spiel.matchId)?.log ?? []).filter((e) => e.type === 'MATCH_END').length;
  return { spiel, mitEngine, enden };
}

const echteWartezeit = (ms: number): Promise<void> => new Promise((fertig) => { setTimeout(fertig, ms); });
async function wartenAuf(ms = 150): Promise<void> {
  await act(async () => { await echteWartezeit(ms); });
}

describe('LiveCockpit — Fixrunde 4 (H3, Task R4): Auto-Finish ehrt readOnly', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => { vi.useRealTimers(); });

  it('readOnly=true: Standard-Einstellung + läuft + Spielzeit überschritten ⇒ kein Spielende im Log', async () => {
    const { spiel, mitEngine, enden } = await laufendesSpiel();
    zu(GRENZE_MS + 100_000);
    render(mitEngine(<LiveCockpit {...baseProps(engineSpielMatch(spiel))} kannSteuern={false} />));
    await wartenAuf();
    expect(enden()).toBe(0);
  });

  it('readOnly=false: dieselbe Situation ⇒ genau ein Spielende im Log (Kontrolle)', async () => {
    const { spiel, mitEngine, enden } = await laufendesSpiel();
    zu(GRENZE_MS + 100_000);
    render(mitEngine(<LiveCockpit {...baseProps(engineSpielMatch(spiel))} kannSteuern />));
    await waitFor(() => expect(enden()).toBe(1));
    await wartenAuf();
    expect(enden()).toBe(1);
  });
});

/**
 * Task R7 (aus task-R4-review.md, Befund M1): `readOnly` wechselt dynamisch während eines überzogenen Spiels – genau
 * das Szenario, das ein zweites Gerät per Realtime auslösen kann (Rollenwechsel durch den Eigentümer, während das
 * Cockpit auf einem anderen Gerät offen bleibt). `rerender` auf derselben Komponenteninstanz beweist, dass `readOnly`
 * selbst in die Auslösung eingeht.
 */
describe('LiveCockpit — Fixrunde R7 (Task R4-Review M1): readOnly wechselt dynamisch während eines überzogenen Spiels', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => { vi.useRealTimers(); });

  it('true → false: beim Mount mit readOnly=true kein Spielende, nach dem Wechsel auf readOnly=false genau eines', async () => {
    const { spiel, mitEngine, enden } = await laufendesSpiel();
    zu(GRENZE_MS + 100_000);
    const match = engineSpielMatch(spiel);
    const { rerender } = render(mitEngine(<LiveCockpit {...baseProps(match)} kannSteuern={false} />));
    await wartenAuf();
    expect(enden()).toBe(0);
    rerender(mitEngine(<LiveCockpit {...baseProps(match)} kannSteuern />));
    await waitFor(() => expect(enden()).toBe(1));
  });

  it('false → true, bevor die Spielzeit abläuft: kein Spielende, auch nicht sobald das Spiel danach überzieht', async () => {
    const { spiel, mitEngine, enden } = await laufendesSpiel();
    zu(300_000);
    const match = engineSpielMatch(spiel);
    const { rerender } = render(mitEngine(<LiveCockpit {...baseProps(match)} kannSteuern />));
    await wartenAuf();
    expect(enden()).toBe(0);
    rerender(mitEngine(<LiveCockpit {...baseProps(match)} kannSteuern={false} />));
    zu(GRENZE_MS + 100_000);
    rerender(mitEngine(<LiveCockpit {...baseProps(match)} kannSteuern={false} />));
    await wartenAuf();
    expect(enden()).toBe(0);
  });
});
