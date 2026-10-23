/**
 * LiveCockpit – Hülle: Daumenleiste nach der Matrix, Nur-Lesen, Entscheidung, Strafstoßschießen, Abschluss, Zugriff entzogen
 * (Aufgabe 3.6). Die Engine-Ansicht wird gemockt (`useEnginePhase`), damit jeder Zustand der Matrix ohne Uhr erreichbar ist;
 * echte deutsche Texte. Gegenstück mit echter Engine: `LiveCockpit.leiste.engine.test.tsx`, `LiveCockpit.tipps.engine.test.tsx`.
 * Szenarien: @SL-018, @SL-046, @SL-045, @HE-043, @SL-162, @SL-103, @SL-135, @SL-053, @SL-006, @SL-005, @SL-070, @HE-056, @OB-051, @FU-080.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { LiveCockpit } from '../LiveCockpit';
import type { PhaseView } from '../engine/phaseView';
import { makeLiveMatch, makePhaseView, makeProps } from './cockpitFixtures';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

vi.mock('../../../hooks/useMatchSound', () => ({
  useMatchSound: () => ({ play: vi.fn(), stop: vi.fn(), testPlay: vi.fn(), activate: vi.fn(), isPlaying: false, isLoading: false, isReady: true, isActivated: true, error: null }),
}));
vi.mock('../../../hooks/useSyncStatus', () => ({
  useSyncStatus: () => ({
    status: 'synced', isSyncing: false, pendingChanges: 0, failedChanges: 0, failedMutations: [],
    syncTournament: vi.fn(), retryFailedMutation: vi.fn(), discardFailedMutation: vi.fn(), isCloudSyncAvailable: false,
  }),
}));
vi.mock('../../../hooks/useActorRole', () => ({ useActorRole: () => 'helper' }));

let aktuelleView: PhaseView | null = null;
vi.mock('../hooks/useEnginePhase', () => ({ useEnginePhase: () => aktuelleView }));

function breite(px: number): void {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: px });
}
beforeEach(() => { aktuelleView = makePhaseView(); breite(1280); });
afterEach(() => { breite(1280); });

describe('Hülle – Nur-Lesen (@SL-018, @SL-046)', () => {
  it('@SL-018 @SL-046 Nur-Lesen: keine Daumenleiste, Zeile „Feld 1 wird von Tom gesteuert“ mit „Spielleitung übernehmen“, Zähler sichtbar', async () => {
    const onUebernehmen = vi.fn();
    render(<LiveCockpit {...makeProps(makeLiveMatch(), { kannSteuern: false, steuerung: { leitetName: 'Tom', onUebernehmen } })} />);
    expect(screen.queryByRole('toolbar')).toBeNull();
    expect(screen.getByText('Feld 1 wird von Tom gesteuert')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Spielleitung übernehmen' }));
    expect(onUebernehmen).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('team-fouls-home')).toBeInTheDocument();
    expect(screen.queryByTestId('goal-button-home')).toBeNull();
    expect(screen.queryByTestId('match-pause-button')).toBeNull();
  });

  it('@FU-026 @FU-027 B-49: fremd gesteuertes Feld – kein Berechtigungs-Banner, nach dem Verlust „Die Spielleitung hat jetzt Olli“', () => {
    render(<LiveCockpit {...makeProps(makeLiveMatch(), { kannSteuern: false, steuerung: { leitetName: 'Olli', verloren: true } })} />);
    expect(screen.getByText('Die Spielleitung hat jetzt Olli')).toBeInTheDocument();
    expect(screen.queryByTestId('cockpit-readonly-banner')).toBeNull();
    expect(screen.queryByTestId('goal-button-home')).toBeNull();
  });

  it('@FU-026 B-49: Halter ohne Namen – „Feld 1 wird von einem anderen Gerät gesteuert“', () => {
    render(<LiveCockpit {...makeProps(makeLiveMatch(), { kannSteuern: false, steuerung: { leitetName: null } })} />);
    expect(screen.getByText('Feld 1 wird von einem anderen Gerät gesteuert')).toBeInTheDocument();
  });

  it('Gegenbeispiel: ohne Recht (keine Steuer-Angabe) steht das Berechtigungs-Banner', () => {
    render(<LiveCockpit {...makeProps(makeLiveMatch(), { kannSteuern: false })} />);
    expect(screen.getByTestId('cockpit-readonly-banner')).toBeInTheDocument();
  });

  it('@SL-046 Gegenbeispiel: ohne Übernahme-Handler (Helfer – nur die Turnierleitung übernimmt) steht kein Knopf „Spielleitung übernehmen“', () => {
    render(<LiveCockpit {...makeProps(makeLiveMatch(), { kannSteuern: false, steuerung: { leitetName: 'Tom' } })} />);
    expect(screen.getByText('Feld 1 wird von Tom gesteuert')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Spielleitung übernehmen' })).toBeNull();
  });

  it('@SL-018 Gegenbeispiel: Nur-Lesen vor dem Anpfiff bietet keinen Anpfiff', () => {
    aktuelleView = makePhaseView({ status: 'scheduled' });
    render(<LiveCockpit {...makeProps(makeLiveMatch({ status: 'NOT_STARTED' }), { kannSteuern: false })} />);
    expect(screen.queryByTestId('match-start-button')).toBeNull();
  });

  it('@SL-018 Nur-Lesen bleibt lesbar: „Mehr“ ist da (Einstellungen gesperrt sichtbar), „Ereignisse“ unter 1024 px', () => {
    breite(800);
    render(<LiveCockpit {...makeProps(makeLiveMatch(), { kannSteuern: false })} />);
    expect(screen.getByTestId('cockpit-more-button')).toBeEnabled();
    expect(screen.getByTestId('match-event-log-button')).toBeEnabled();
  });
});

describe('Hülle – abgepfiffen (@SL-045, @HE-043, @SL-162)', () => {
  const abgepfiffen = () => {
    aktuelleView = makePhaseView({ status: 'finished' });
    return makeLiveMatch({ status: 'FINISHED', homeScore: 2, awayScore: 1 });
  };

  it('@SL-045 @HE-043 Helfer: kein Rückgängig, stehende Zeile „Spiel ist beendet – Korrektur über die Turnierleitung“, keine Spalten-Knöpfe', () => {
    render(<LiveCockpit {...makeProps(abgepfiffen(), { istLeitung: false })} />);
    expect(screen.queryByTestId('match-undo-button')).toBeNull();
    expect(screen.getByTestId('bar-finished')).toHaveTextContent('Spiel ist beendet – Korrektur über die Turnierleitung');
    expect(screen.queryByTestId('goal-button-home')).toBeNull();
  });

  it('@SL-159 Gegenbeispiel: die Turnierleitung sieht den Hinweis „Korrektur über die Turnierleitung“ nicht', () => {
    render(<LiveCockpit {...makeProps(abgepfiffen(), { istLeitung: true })} />);
    expect(screen.queryByTestId('bar-finished')).toBeNull();
  });

  it('@SL-162 „Weiter“ ruft das Laden des nächsten Spiels genau einmal, mit dem Feld des Spiels', async () => {
    const props = makeProps(abgepfiffen());
    render(<LiveCockpit {...props} />);
    await userEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    expect(props.onLoadNextMatch).toHaveBeenCalledTimes(1);
    expect(props.onLoadNextMatch).toHaveBeenCalledWith('field-1');
  });

  it('@SL-113 @SL-061 Nur-Lesen, abgepfiffen, 800 px: „Ereignisse“ öffnet die Liste der Einträge', async () => {
    breite(800);
    render(<LiveCockpit {...makeProps(abgepfiffen(), { kannSteuern: false })} />);
    expect(screen.queryByRole('toolbar')).toBeNull();
    await userEvent.click(screen.getByTestId('match-event-log-button'));
    expect(screen.getByTestId('event-log-sheet')).toBeInTheDocument();
  });

  it('@SL-113 @SL-061 Steuer-Gerät, abgepfiffen, 800 px: „Ereignisse“ steht in der Leiste und öffnet die Liste', async () => {
    breite(800);
    render(<LiveCockpit {...makeProps(abgepfiffen())} />);
    await userEvent.click(within(screen.getByRole('toolbar')).getByTestId('match-event-log-button'));
    expect(screen.getByTestId('event-log-sheet')).toBeInTheDocument();
  });

  it('@SL-061 Gegenbeispiel: abgepfiffen bei 1280 px hat keinen Leisten-Knopf „Ereignisse“, die Liste steht daneben', () => {
    render(<LiveCockpit {...makeProps(abgepfiffen())} />);
    expect(screen.queryByTestId('match-event-log-button')).toBeNull();
  });

  it('@SL-162 Gegenbeispiel: im laufenden Spiel gibt es kein „Weiter zum nächsten Spiel“', () => {
    render(<LiveCockpit {...makeProps(makeLiveMatch())} />);
    expect(screen.queryByTestId('match-next-button')).toBeNull();
  });
});

describe('Hülle – Strafstoßschießen und Entscheidung (@SL-103, @SL-135, @SL-053)', () => {
  it('@SL-103 @SL-135 Strafstoßschießen: Form statt Spalten, keine Hauptaktion, kein Abpfiff', () => {
    aktuelleView = makePhaseView({ status: 'shootout', phase: 'shootout' });
    render(<LiveCockpit {...makeProps(makeLiveMatch({ status: 'PAUSED' }), { strafstossForm: <div data-testid="shootout-form" /> })} />);
    expect(screen.getByTestId('shootout-form')).toBeInTheDocument();
    expect(screen.queryByTestId('team-head-home')).toBeNull();
    expect(screen.queryByTestId('match-pause-button')).toBeNull();
    expect(screen.queryByTestId('match-finish-button')).toBeNull();
  });

  it('@SL-103 Gegenbeispiel: ohne Form (B-09b offen) bleiben die Spalten stehen', () => {
    aktuelleView = makePhaseView({ status: 'shootout', phase: 'shootout' });
    render(<LiveCockpit {...makeProps(makeLiveMatch({ status: 'PAUSED' }))} />);
    expect(screen.getByTestId('team-head-home')).toBeInTheDocument();
  });

  it('@SL-053 Entscheidung offen: Hauptaktion „Entscheidung wählen“ öffnet drei Wege, die Wahl geht mit der Spiel-ID raus; keine Spalten', async () => {
    aktuelleView = makePhaseView({ status: 'decision_pending', tiebreakMode: null });
    const onChooseTiebreak = vi.fn();
    render(<LiveCockpit {...makeProps(makeLiveMatch({ status: 'PAUSED' }), { onChooseTiebreak })} />);
    expect(screen.queryByTestId('team-head-home')).toBeNull();
    await userEvent.click(screen.getByTestId('match-tiebreak-button'));
    const blatt = screen.getByTestId('tiebreak-choice');
    expect(blatt).toHaveAttribute('aria-modal', 'true');
    expect(within(blatt).getAllByRole('button').map((b) => b.textContent)).toEqual(['Verlängerung', 'Golden Goal', 'Strafstoßschießen']);
    await userEvent.click(within(blatt).getByRole('button', { name: 'Golden Goal' }));
    expect(onChooseTiebreak).toHaveBeenCalledWith('match-11', 'goldenGoal');
    expect(screen.queryByTestId('tiebreak-choice')).toBeNull();
  });

  it('@SL-053 Gegenbeispiel: ohne Handler (B-09a offen) ist die Hauptaktion gesperrt', () => {
    aktuelleView = makePhaseView({ status: 'decision_pending', tiebreakMode: null });
    render(<LiveCockpit {...makeProps(makeLiveMatch({ status: 'PAUSED' }))} />);
    expect(screen.getByTestId('match-tiebreak-button')).toBeDisabled();
  });
});

describe('Hülle – Halbzeitpause und Abpfiff (@SL-006, @SL-005, @SL-070, @SL-157)', () => {
  it('@SL-005 @SL-070 Halbzeitpause: die Leiste bietet den Wiederanpfiff, aber keinen Abpfiff (A2)', () => {
    aktuelleView = makePhaseView({ status: 'section_break', section: 1, isLastRegularSection: false, breakRemainingMs: 0 });
    render(<LiveCockpit {...makeProps(makeLiveMatch({ status: 'PAUSED' }))} />);
    expect(screen.getByTestId('match-wiederanpfiff-button')).toHaveTextContent('Wiederanpfiff');
    expect(screen.queryByTestId('match-finish-button')).toBeNull();
  });

  it('@SL-157 laeuft: „Abpfiff halten“ liegt in der Leiste, nicht im Blatt „Mehr“', async () => {
    render(<LiveCockpit {...makeProps(makeLiveMatch())} />);
    expect(within(screen.getByRole('toolbar')).getByRole('button', { name: 'Abpfiff halten' })).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('cockpit-more-button'));
    expect(within(screen.getByTestId('more-sheet')).queryByText(/Abpfiff/)).toBeNull();
  });
});

describe('Hülle – Rechte entzogen (@HE-056, @OB-051)', () => {
  it('@HE-056 Recht entzogen: nur der Hinweis mit der Zahl übergebener Einträge', () => {
    render(<LiveCockpit {...makeProps(makeLiveMatch(), { kannSteuern: false, zugriffEntzogen: { uebergebeneEintraege: 1 } })} />);
    expect(screen.getByText('Du hast keinen Zugriff mehr – 1 Eintrag an die Turnierleitung übergeben')).toBeInTheDocument();
    expect(screen.queryByTestId('scoreboard')).toBeNull();
  });

  it('@HE-056 Mehrzahl: 3 Einträge', () => {
    render(<LiveCockpit {...makeProps(makeLiveMatch(), { kannSteuern: false, zugriffEntzogen: { uebergebeneEintraege: 3 } })} />);
    expect(screen.getByText('Du hast keinen Zugriff mehr – 3 Einträge an die Turnierleitung übergeben')).toBeInTheDocument();
  });

  it('@OB-051 Gegenbeispiel: ohne Entzug zeigt die Hülle das Spiel, nie „kein Zugriff“', () => {
    render(<LiveCockpit {...makeProps(makeLiveMatch(), { kannSteuern: true })} />);
    expect(screen.getByTestId('scoreboard')).toBeInTheDocument();
    expect(screen.queryByText(/keinen Zugriff/)).toBeNull();
  });
});

describe('Hülle – Layout aus einer Quelle (Auflage 9)', () => {
  it.each([[1024, 'breit'], [1280, 'breit'], [1023, 'daumen'], [800, 'daumen'], [360, 'daumen']])('Hülle setzt data-layout bei %i px auf %s, die Leiste folgt', (px, erwartet) => {
    breite(px);
    render(<LiveCockpit {...makeProps(makeLiveMatch())} />);
    expect(screen.getByTestId('live-cockpit')).toHaveAttribute('data-layout', erwartet);
    expect(screen.getByRole('toolbar')).toHaveAttribute('data-layout', erwartet);
  });

  it('@SL-061 die Fläche trägt Tafel und beide Spalten, die Leiste steht unter der Fläche (nicht darin); am Laptop gehört die Liste zur Fläche', () => {
    render(<LiveCockpit {...makeProps(makeLiveMatch())} />);
    const flaeche = screen.getByTestId('cockpit-flaeche');
    expect(within(flaeche).getByTestId('scoreboard')).toBeInTheDocument();
    expect(within(flaeche).getByTestId('team-column-home')).toBeInTheDocument();
    expect(within(flaeche).getByTestId('team-column-away')).toBeInTheDocument();
    expect(within(flaeche).queryByRole('toolbar')).toBeNull();
    expect(flaeche.closest('[data-layout="breit"]')).not.toBeNull();
    expect(within(flaeche).getByText('Ereignisse')).toBeInTheDocument();
  });

  it('@SL-061 Gegenbeispiel: unter 1024 px steht keine Liste in der Fläche (sie öffnet sich über die Leiste)', () => {
    breite(800);
    render(<LiveCockpit {...makeProps(makeLiveMatch())} />);
    expect(within(screen.getByTestId('cockpit-flaeche')).queryByText('Ereignisse')).toBeNull();
  });

  it('@FU-080 bei 800 px öffnet „Ereignisse“ die Liste der Einträge', async () => {
    breite(800);
    render(<LiveCockpit {...makeProps(makeLiveMatch())} />);
    expect(screen.queryByTestId('event-log-sheet')).toBeNull();
    await userEvent.click(screen.getByTestId('match-event-log-button'));
    expect(screen.getByTestId('event-log-sheet')).toBeInTheDocument();
  });

  it('@FU-080 Gegenbeispiel: ab 1024 px steht die Liste daneben, der Leisten-Knopf „Ereignisse“ fehlt', () => {
    breite(1024);
    render(<LiveCockpit {...makeProps(makeLiveMatch())} />);
    expect(screen.queryByTestId('match-event-log-button')).toBeNull();
  });

  it('Größenänderung wechselt das Layout, ohne dass ein Zustand verloren geht (Fenster 1280 → 900 px)', () => {
    render(<LiveCockpit {...makeProps(makeLiveMatch())} />);
    expect(screen.getByTestId('live-cockpit')).toHaveAttribute('data-layout', 'breit');
    act(() => { breite(900); window.dispatchEvent(new Event('resize')); });
    expect(screen.getByTestId('live-cockpit')).toHaveAttribute('data-layout', 'daumen');
    expect(screen.getByTestId('match-event-log-button')).toBeInTheDocument();
  });
});
