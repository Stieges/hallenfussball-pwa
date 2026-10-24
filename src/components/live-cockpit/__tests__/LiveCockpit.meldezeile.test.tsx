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
import { DEFAULT_MATCH_COCKPIT_SETTINGS } from '../../../types/tournament';


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
    currentMatch: match as never, upcomingMatches: [], kannSteuern: true,
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
    expect(screen.getByTestId('scoreboard-clock')).toBeVisible();
    expect(screen.getByTestId('scoreboard-score')).toBeVisible();
    expect(zeile).not.toContainElement(screen.getByTestId('scoreboard-clock'));
    expect(zeile).not.toContainElement(screen.getByTestId('scoreboard-score'));
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

  it('@SL-035 Gegenbeispiel: unter der Grenze (3 → 4 Fouls) bleibt die Meldezeile leer, der Zähler zeigt „Foul 4/5“', () => {
    const { rerender } = render(<LiveCockpit {...baseProps(matchMit(3))} />);
    rerender(<LiveCockpit {...baseProps(matchMit(4))} />);

    expect(screen.getByTestId(MELDUNG)).toBeEmptyDOMElement();
    expect(screen.getByTestId('team-fouls-home')).toHaveTextContent('Foul 4/5');
  });

  // Das Cockpit liest `cockpitSettings.foulLimit` (Plan Cockpit v2 A5; vorher fest 5, Befund C-FOUL-GRENZE-FEST).
  it('@SL-034 Grenze 3: das 3. Foul meldet „FC Alpha: 3. Foul in dieser Halbzeit“ (C-FOUL-GRENZE-FEST behoben)', () => {
    const settings = { ...DEFAULT_MATCH_COCKPIT_SETTINGS, foulLimit: 3 };
    const { rerender } = render(<LiveCockpit {...baseProps(matchMit(2), { cockpitSettings: settings })} />);
    rerender(<LiveCockpit {...baseProps(matchMit(3), { cockpitSettings: settings })} />);
    expect(screen.getByTestId(MELDUNG)).toHaveTextContent('FC Alpha: 3. Foul in dieser Halbzeit');
  });

  it('@SL-102 ist die Foul-Grenze ausgeschaltet, gibt es beim 5. Foul keinen Hinweis (C-FOUL-GRENZE-FEST behoben)', () => {
    const settings = { ...DEFAULT_MATCH_COCKPIT_SETTINGS, foulLimit: null };
    const { rerender } = render(<LiveCockpit {...baseProps(matchMit(4), { cockpitSettings: settings })} />);
    rerender(<LiveCockpit {...baseProps(matchMit(5), { cockpitSettings: settings })} />);
    expect(screen.getByTestId(MELDUNG)).toBeEmptyDOMElement();
  });

  // @SL-036 und @SL-100 (Zählung je Abschnitt, Verlängerung zum letzten Abschnitt): `hooks/__tests__/zaehleFouls.test.ts` und `LiveCockpit.foulGrenze.engine.test.tsx`

  it('@SL-098 Gegenbeispiel: Wechsel auf ein anderes Spiel mit 5 Fouls meldet nichts (kein „6. Foul“ beim Öffnen)', () => {
    const { rerender } = render(<LiveCockpit {...baseProps(matchMit(2))} />);
    rerender(<LiveCockpit {...baseProps(matchMit(5, { id: 'match-2' }))} />);
    expect(screen.getByTestId(MELDUNG)).toBeEmptyDOMElement();
    rerender(<LiveCockpit {...baseProps(matchMit(6, { id: 'match-2' }))} />);
    expect(screen.getByTestId(MELDUNG)).toHaveTextContent('FC Alpha: 6. Foul in dieser Halbzeit');
  });

  it('@SL-034 „deutlich“: die Foul-Grenze (Stufe 2) trägt ein Warn-Symbol, eine Bestätigung (Stufe 3) ein Häkchen', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<LiveCockpit {...baseProps(matchMit(4), { onFoul: vi.fn() })} />);
    await user.click(screen.getByRole('button', { name: /^Foul FC Alpha, Foul \d+\/5$/ }));
    expect(screen.getByTestId('notice-icon-3')).toBeInTheDocument();
    expect(screen.queryByTestId('notice-icon-2')).toBeNull();
    rerender(<LiveCockpit {...baseProps(matchMit(5), { onFoul: vi.fn() })} />);
    expect(screen.getByTestId('notice-icon-2')).toBeInTheDocument();
    expect(screen.queryByTestId('notice-icon-3')).toBeNull();
  });

  it('@SL-064 die Zeile ist am Handy (360 px) zwei Zeilen hoch (N1), ab Tablet (768 px) 32 px', () => {
    const alt = window.innerWidth;
    try {
      window.innerWidth = 360;
      const mobil = render(<LiveCockpit {...baseProps(matchMit(0))} />);
      expect(screen.getByTestId(MELDUNG).style.height).toMatch(/calc\(2 \*/);
      mobil.unmount();
      window.innerWidth = 1280;
      render(<LiveCockpit {...baseProps(matchMit(0))} />);
      expect(screen.getByTestId(MELDUNG).style.height).toBe('var(--sizing-notice-line-height-regular)');
    } finally {
      window.innerWidth = alt;
    }
  });

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

    await user.click(screen.getByRole('button', { name: /^Foul FC Alpha, Foul \d+\/5$/ }));

    expect(screen.getByTestId(MELDUNG)).toHaveTextContent('Foul für FC Alpha');
    expect(screen.queryByText('×')).toBeNull();
  });

  it('C-COCKPIT-TOASTS-HANDY: bei laufender Uhr (jedes Bild neu gezeichnet) verschwindet die Bestätigung nach 3 s von selbst', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onFoul = vi.fn();
    const laufend = matchMit(0, { status: 'RUNNING', timerStartTime: new Date().toISOString(), elapsedSeconds: 10 });
    render(<LiveCockpit {...baseProps(laufend, { onFoul })} />);
    fireClick(/^Foul FC Alpha, Foul \d+\/5$/);
    expect(screen.getByTestId(MELDUNG)).toHaveTextContent('Foul für FC Alpha');

    for (let s = 0; s < 2; s++) { await act(async () => { await vi.advanceTimersByTimeAsync(1000); }); }
    expect(screen.getByTestId(MELDUNG)).toHaveTextContent('Foul für FC Alpha');
    await act(async () => { await vi.advanceTimersByTimeAsync(1100); });
    expect(screen.getByTestId(MELDUNG)).toBeEmptyDOMElement();
  });

  it('Nur-Lesen-Banner und Meldezeile stehen getrennt: die Meldezeile zeigt keinen Berechtigungstext', () => {
    render(<LiveCockpit {...baseProps(matchMit(0), { kannSteuern: false })} />);
    expect(screen.getByTestId(MELDUNG)).toBeEmptyDOMElement();
    expect(screen.getByTestId('cockpit-readonly-banner')).toBeInTheDocument();
  });
});

function fireClick(name: string | RegExp): void {
  act(() => { screen.getByRole('button', { name }).click(); });
}

/**
 * B3 (Review 2c, VISUAL-DESIGN § 1, @OB-025): Namen werden in der Meldezeile nie mit „…“ gekürzt. Die Zahl der reservierten
 * Zeilen hängt je Spiel an den beiden Teamnamen und der Tafelgröße; sie ändert sich innerhalb eines Spiels nie.
 */
describe('LiveCockpit – Meldezeile reserviert Zeilen je Spiel (B3)', () => {
  const NAME_50 = 'Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921';
  const breite = (px: number) => { Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: px }); };
  const langesSpiel = (extra: Record<string, unknown> = {}) => makeMatch({ homeTeam: { id: 'team-a', name: NAME_50 }, ...extra });
  afterEach(() => breite(1024));

  it('@OB-025 am Handy (360 px) reserviert ein Spiel mit einem Namen von 50 Zeichen drei Zeilen, und die Meldung steht vollständig da', () => {
    breite(360);
    const { rerender } = render(<LiveCockpit {...baseProps(langesSpiel({ events: fouls('team-a', 4) }))} />);
    const hoheOhne = screen.getByTestId(MELDUNG).style.height;
    expect(screen.getByTestId(MELDUNG)).toHaveAttribute('data-zeilen', '3');
    rerender(<LiveCockpit {...baseProps(langesSpiel({ events: fouls('team-a', 5) }))} />);
    expect(screen.getByTestId(MELDUNG)).toHaveTextContent(`${NAME_50}: 5. Foul in dieser Halbzeit`);
    expect(screen.getByTestId(MELDUNG).style.height).toBe(hoheOhne); // mit und ohne Meldung gleich hoch
  });

  it('N1 am Handy (360 px) reserviert auch ein Spiel mit kurzen Namen zwei Zeilen: „SV Südpark: 5. Foul in dieser Halbzeit“ steht ohne „…“ da', () => {
    breite(360);
    const kurz = (extra: Record<string, unknown>) => makeMatch({ awayTeam: { id: 'team-b', name: 'SV Südpark' }, ...extra });
    const { rerender } = render(<LiveCockpit {...baseProps(kurz({}))} />);
    expect(screen.getByTestId(MELDUNG)).toHaveAttribute('data-zeilen', '2');
    rerender(<LiveCockpit {...baseProps(kurz({ events: fouls('team-b', 5) }))} />);
    expect(screen.getByTestId(MELDUNG)).toHaveTextContent('SV Südpark: 5. Foul in dieser Halbzeit');
    expect(screen.getByTestId(MELDUNG)).toHaveAttribute('data-zeilen', '2');
  });

  it('N1 „Spiel 15 von der Turnierleitung zurückgesetzt“ steht bei 360 px vollständig in der Meldezeile (2 Zeilen)', () => {
    breite(360);
    const match = makeMatch({ number: 15 });
    const { rerender } = render(<LiveCockpit {...baseProps(match)} />);
    rerender(<LiveCockpit {...baseProps(match, {})} {...({ letzteZuruecksetzung: { id: 'r1', spielNummer: 15 } } as object)} />);
    expect(screen.getByTestId(MELDUNG)).toHaveTextContent('Spiel 15 von der Turnierleitung zurückgesetzt');
    expect(screen.getByTestId(MELDUNG)).toHaveAttribute('data-zeilen', '2');
  });

  it('@OB-025 Gegenbeispiel: ab 768 px reicht auch bei langen Namen eine Zeile', () => {
    breite(768);
    render(<LiveCockpit {...baseProps(langesSpiel())} />);
    expect(screen.getByTestId(MELDUNG)).toHaveAttribute('data-zeilen', '1');
  });

  it('@OB-025 die Reserve ändert sich innerhalb eines Spiels nie (Foul-Stand, Spielstand, Status)', () => {
    breite(360);
    const { rerender } = render(<LiveCockpit {...baseProps(langesSpiel())} />);
    for (const extra of [{ events: fouls('team-a', 5) }, { status: 'RUNNING', homeScore: 1 }, { status: 'PAUSED' }]) {
      rerender(<LiveCockpit {...baseProps(langesSpiel(extra))} />);
      expect(screen.getByTestId(MELDUNG)).toHaveAttribute('data-zeilen', '3');
    }
  });
});
