/**
 * LiveCockpit -- Meldezeile statt Cockpit-Toast (Aufgabe 2.3).
 * Szenarien: @SL-064, @SL-034, @SL-035, @SL-098; Befund C-COCKPIT-TOASTS-HANDY.
 * Testwerte aus dem Gherkin; echte deutsche Texte (cockpit.json).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LiveCockpit } from '../LiveCockpit';
import type { LiveCockpitProps } from '../types';


vi.mock('react-i18next', async () => {
  const de: unknown = (await import('../../../i18n/locales/de/cockpit.json')).default;
  const translate = (key: string, opts?: Record<string, unknown>): string => {
    const found = key.split('.').reduce<unknown>(
      (node, part) => (typeof node === 'object' && node !== null ? (node as Record<string, unknown>)[part] : undefined),
      de,
    );
    let text = typeof found === 'string' ? found : key;
    for (const [name, value] of Object.entries(opts ?? {})) {
      text = text.replace(`{{${name}}}`, String(value));
    }
    return text;
  };
  const stable = { t: translate, i18n: { language: 'de' } };
  return { useTranslation: () => stable };
});
vi.mock('../../../hooks/useMatchSound', () => ({
  useMatchSound: () => ({ play: vi.fn(), stop: vi.fn(), testPlay: vi.fn(), activate: vi.fn(), isPlaying: false, isLoading: false, isReady: true, isActivated: true, error: null }),
}));
vi.mock('../../../hooks/useSyncStatus', () => ({
  useSyncStatus: () => ({
    status: 'synced', isSyncing: false, pendingChanges: 0, failedChanges: 0, failedMutations: [],
    syncTournament: vi.fn(), retryFailedMutation: vi.fn(), discardFailedMutation: vi.fn(),
    isCloudSyncAvailable: false,
  }),
}));
vi.mock('../../../hooks/useActorRole', () => ({ useActorRole: () => 'helper' }));

function makeMatch(overrides: Record<string, unknown> = {}) {
  return {
    id: 'match-1', number: 7, phaseLabel: 'Gruppenphase', fieldId: 'field-1',
    scheduledKickoff: new Date().toISOString(), durationSeconds: 600,
    homeTeam: { id: 'team-a', name: 'FC Alpha' }, awayTeam: { id: 'team-b', name: 'SV Beta' },
    homeScore: 0, awayScore: 0, status: 'PAUSED', elapsedSeconds: 30, playPhase: 'regular',
    events: [
      { id: 'f1', matchId: 'match-1', type: 'FOUL', timestampSeconds: 5, payload: { teamId: 'team-a' }, scoreAfter: { home: 0, away: 0 } },
      { id: 'f2', matchId: 'match-1', type: 'FOUL', timestampSeconds: 15, payload: { teamId: 'team-a' }, scoreAfter: { home: 0, away: 0 } },
      { id: 'f3', matchId: 'match-1', type: 'FOUL', timestampSeconds: 25, payload: { teamId: 'team-b' }, scoreAfter: { home: 0, away: 0 } },
    ],
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


function fouls(teamId: string, count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `${teamId}-f${i}`, matchId: 'match-1', type: 'FOUL', timestampSeconds: 5 + i,
    payload: { teamId }, scoreAfter: { home: 0, away: 0 },
  }));
}

function matchMit(foulsA: number, extra: Record<string, unknown> = {}) {
  return makeMatch({ events: fouls('team-a', foulsA), ...extra });
}

const MELDUNG = 'notice-line';

describe('LiveCockpit – Meldezeile statt Toast (Aufgabe 2.3)', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.useRealTimers());

  it('@SL-034 Grenze 5: das 5. Foul zeigt „FC Alpha: 5. Foul in dieser Halbzeit“ in der Meldezeile, Uhr und Stand bleiben sichtbar', () => {
    const { rerender } = render(<LiveCockpit {...baseProps(matchMit(4))} />);
    expect(screen.getByTestId(MELDUNG)).toBeEmptyDOMElement();

    rerender(<LiveCockpit {...baseProps(matchMit(5))} />);

    const zeile = screen.getByTestId(MELDUNG);
    expect(zeile).toHaveTextContent('FC Alpha: 5. Foul in dieser Halbzeit');
    expect(zeile).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByTestId('match-timer-display')).toBeVisible();
    expect(screen.getByTestId('score-home')).toBeVisible();
    expect(zeile).not.toContainElement(screen.getByTestId('match-timer-display'));
    expect(zeile).not.toContainElement(screen.getByTestId('score-home'));
  });

  it('@SL-064 die Meldung überlagert nichts: kein fixiertes oder absolutes Element in der Kette der Zeile, kein Toast-Stapel, kein ×', () => {
    const { rerender } = render(<LiveCockpit {...baseProps(matchMit(4))} />);
    rerender(<LiveCockpit {...baseProps(matchMit(5))} />);

    let knoten: HTMLElement | null = screen.getByTestId(MELDUNG);
    while (knoten) {
      expect(['fixed', 'absolute', 'sticky']).not.toContain(getComputedStyle(knoten).position);
      knoten = knoten.parentElement;
    }
    expect(screen.queryByText('×')).toBeNull();
    expect(screen.getAllByText(/Foul in dieser Halbzeit/)).toHaveLength(1);
  });

  it('@SL-098 auch über der Grenze meldet das Cockpit jedes weitere Foul: „FC Alpha: 6. Foul in dieser Halbzeit“', () => {
    const { rerender } = render(<LiveCockpit {...baseProps(matchMit(5))} />);
    expect(screen.getByTestId(MELDUNG)).toBeEmptyDOMElement();

    rerender(<LiveCockpit {...baseProps(matchMit(6))} />);

    expect(screen.getByTestId(MELDUNG)).toHaveTextContent('FC Alpha: 6. Foul in dieser Halbzeit');
  });

  it('@SL-035 Gegenbeispiel: unter der Grenze (3 → 4 Fouls) bleibt die Meldezeile leer, der Zähler zeigt 4', () => {
    const { rerender } = render(<LiveCockpit {...baseProps(matchMit(3))} />);
    rerender(<LiveCockpit {...baseProps(matchMit(4))} />);

    expect(screen.getByTestId(MELDUNG)).toBeEmptyDOMElement();
    expect(screen.getByTestId('foul-count-home')).toHaveTextContent('4');
  });

  // Befund: Das Cockpit liest die eingestellte Foul-Grenze (`foulLimit`) und den Halbzeit-Zähler erst mit
  // B-11a (ZA-0 liefert nur das Feld). Bis dahin gilt fest 5 für das ganze Spiel.
  it.todo('@SL-034 Grenze 3: das 3. Foul meldet „SV Süd: 3. Foul in dieser Halbzeit“ (wartet auf B-11a)');

  it('@SL-064 Gegenbeispiel: die Meldung hält die Uhr nicht an und der Spielstatus bleibt unberührt', () => {
    const onPause = vi.fn();
    const { rerender } = render(<LiveCockpit {...baseProps(matchMit(4), { onPause })} />);
    rerender(<LiveCockpit {...baseProps(matchMit(5), { onPause })} />);
    expect(onPause).not.toHaveBeenCalled();
  });

  it('Bestätigung nach dem Foul-Knopf steht in der Meldezeile, nicht als Toast', async () => {
    const onFoul = vi.fn();
    const user = userEvent.setup();
    render(<LiveCockpit {...baseProps(matchMit(0), { onFoul })} />);

    await user.click(screen.getByRole('button', { name: 'Foul für FC Alpha' }));

    expect(screen.getByTestId(MELDUNG)).toHaveTextContent('Foul für FC Alpha');
    expect(screen.queryByText('×')).toBeNull();
  });

  it('C-COCKPIT-TOASTS-HANDY: bei laufender Uhr (jedes Bild neu gezeichnet) verschwindet die Bestätigung nach 3 s von selbst', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onFoul = vi.fn();
    const laufend = matchMit(0, { status: 'RUNNING', timerStartTime: new Date().toISOString(), elapsedSeconds: 10 });
    render(<LiveCockpit {...baseProps(laufend, { onFoul })} />);
    fireClick('Foul für FC Alpha');
    expect(screen.getByTestId(MELDUNG)).toHaveTextContent('Foul für FC Alpha');

    for (let s = 0; s < 2; s++) { await act(async () => { await vi.advanceTimersByTimeAsync(1000); }); }
    expect(screen.getByTestId(MELDUNG)).toHaveTextContent('Foul für FC Alpha');
    await act(async () => { await vi.advanceTimersByTimeAsync(1100); });
    expect(screen.getByTestId(MELDUNG)).toBeEmptyDOMElement();
  });

  it('Nur-Lesen-Banner und Meldezeile stehen getrennt: die Meldezeile zeigt keinen Berechtigungstext', () => {
    render(<LiveCockpit {...baseProps(matchMit(0), { readOnly: true })} />);
    expect(screen.getByTestId(MELDUNG)).toBeEmptyDOMElement();
    expect(screen.getByTestId('cockpit-readonly-banner')).toBeInTheDocument();
  });
});

function fireClick(name: string): void {
  act(() => { screen.getByRole('button', { name }).click(); });
}
