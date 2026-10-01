/**
 * LiveCockpit -- Fouls zaehlen fuer das ganze Spiel (C3b-2, G11).
 * Kein Halbzeit-Reset, kein lokales +1, sichtbarer R6-Hinweis. Echte deutsche Texte.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LiveCockpit } from '../LiveCockpit';
import type { LiveCockpitProps } from '../types';

const tCalls = vi.hoisted(() => [] as string[]);

vi.mock('react-i18next', async () => {
  const de: unknown = (await import('../../../i18n/locales/de/cockpit.json')).default;
  const translate = (key: string, opts?: Record<string, unknown>): string => {
    tCalls.push(key);
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

describe('LiveCockpit — Fouls für das ganze Spiel (C3b-2, G11)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('kein Reset bei Halbzeit', async () => {
    const user = userEvent.setup();
    render(<LiveCockpit {...baseProps(makeMatch())} />);
    expect(screen.getByTestId('foul-count-home')).toHaveTextContent('2');
    expect(screen.getByTestId('foul-count-away')).toHaveTextContent('1');

    await user.click(screen.getByRole('button', { name: 'Halbzeit' }));

    expect(screen.getByTestId('foul-count-home')).toHaveTextContent('2');
    expect(screen.getByTestId('foul-count-away')).toHaveTextContent('1');
  });

  it('zurückgenommenes Foul zählt nicht', () => {
    const match = makeMatch({
      events: [
        { id: 'f1', matchId: 'match-1', type: 'FOUL', timestampSeconds: 5, payload: { teamId: 'team-a' }, scoreAfter: { home: 0, away: 0 } },
        { id: 'f2', matchId: 'match-1', type: 'FOUL', timestampSeconds: 15, payload: { teamId: 'team-a' }, scoreAfter: { home: 0, away: 0 } },
      ],
      retractedEvents: [
        { id: 'f0', matchId: 'match-1', type: 'FOUL', timestampSeconds: 1, payload: { teamId: 'team-a' }, scoreAfter: { home: 0, away: 0 } },
      ],
    });
    render(<LiveCockpit {...baseProps(match)} />);
    expect(screen.getByTestId('foul-count-home')).toHaveTextContent('2');
    expect(screen.getByTestId('foul-count-away')).toHaveTextContent('0');
  });

  it('kein lokales +1: Foul-Knopf ruft onFoul, der Zähler steigt erst mit dem Ereignis', async () => {
    const onFoul = vi.fn();
    const user = userEvent.setup();
    render(<LiveCockpit {...baseProps(makeMatch(), { onFoul })} />);
    expect(screen.getByTestId('foul-count-home')).toHaveTextContent('2');

    await user.click(screen.getByRole('button', { name: 'Foul für FC Alpha' }));

    expect(onFoul).toHaveBeenCalledWith('match-1', 'team-a');
    expect(screen.getByTestId('foul-count-home')).toHaveTextContent('2');
  });

  it('R6-Hinweis „Fouls zählen für das ganze Spiel – Karten und Zeitstrafen zählen als Foul“ ist sichtbar', () => {
    render(<LiveCockpit {...baseProps(makeMatch())} />);
    expect(screen.getByTestId('foul-hint')).toHaveTextContent(
      'Fouls zählen für das ganze Spiel – Karten und Zeitstrafen zählen als Foul',
    );
  });
});

describe('LiveCockpit — M7: Toasts i18n, Foul ohne Zahl, 5er-Warnung (F3a)', () => {
  beforeEach(() => vi.clearAllMocks());

  function events(count: number, extra: Record<string, unknown>[] = []) {
    return [
      ...Array.from({ length: count }, (_, i) => ({
        id: `f${i}`, matchId: 'match-1', type: 'FOUL', timestampSeconds: 5 + i,
        payload: { teamId: 'team-a' }, scoreAfter: { home: 0, away: 0 },
      })),
      ...extra,
    ];
  }

  it('Foul-Toast ohne Zahl: „Foul für FC Alpha“, kein (n)', async () => {
    const onFoul = vi.fn();
    const user = userEvent.setup();
    render(<LiveCockpit {...baseProps(makeMatch(), { onFoul })} />);

    await user.click(screen.getByRole('button', { name: 'Foul für FC Alpha' }));

    expect(await screen.findByText('Foul für FC Alpha')).toBeInTheDocument();
    expect(screen.queryByText(/Foul für FC Alpha \(\d+\)/)).toBeNull();
  });

  it('Karte erzeugt genau EINEN Eintrag: onCard, nicht zusätzlich onFoul (U3)', async () => {
    const onCard = vi.fn();
    const onFoul = vi.fn();
    const user = userEvent.setup();
    render(<LiveCockpit {...baseProps(makeMatch(), { onCard, onFoul })} />);

    await user.click(screen.getByRole('button', { name: 'Gelbe Karte für FC Alpha' }));
    await user.click(screen.getByRole('button', { name: 'Ohne Details' }));

    expect(onCard).toHaveBeenCalledTimes(1);
    expect(onCard).toHaveBeenCalledWith('match-1', 'team-a', 'YELLOW', { playerNumber: undefined });
    expect(onFoul).not.toHaveBeenCalled();
  });

  it('Halbzeit-, Karten- und Zeitstrafen-Toast kommen aus i18n', async () => {
    const onCard = vi.fn();
    const onTimePenalty = vi.fn();
    const user = userEvent.setup();
    tCalls.length = 0;
    render(<LiveCockpit {...baseProps(makeMatch(), { onCard, onTimePenalty })} />);

    await user.click(screen.getByRole('button', { name: 'Halbzeit' }));
    expect(await screen.findByText('Halbzeit')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Gelbe Karte für FC Alpha' }));
    await user.click(screen.getByRole('button', { name: 'Ohne Details' }));
    expect(await screen.findByText('Gelbe Karte für FC Alpha')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Zeitstrafe für FC Alpha' }));
    await user.click(screen.getByRole('button', { name: /Ohne Nr\./ }));
    expect(await screen.findByText('2 Min Zeitstrafe für FC Alpha')).toBeInTheDocument();
    expect(tCalls).toContain('toast.halftime');
    expect(tCalls).toContain('toast.yellowCard');
    expect(tCalls).toContain('toast.timePenalty');
  });

  it('5-Fouls-Warnung bei der 5. Strafe – auch als Karte; 4. Strafe ohne Warnung', async () => {
    const { rerender } = render(
      <LiveCockpit {...baseProps(makeMatch({ events: events(4) }))} />,
    );
    expect(screen.queryByText('⚠ ACHTUNG: FC Alpha hat 5 Fouls!')).toBeNull();

    const fifthIsCard = {
      id: 'k1', matchId: 'match-1', type: 'YELLOW_CARD', timestampSeconds: 40,
      payload: { teamId: 'team-a', playerNumber: 4 }, scoreAfter: { home: 0, away: 0 },
    };
    rerender(<LiveCockpit {...baseProps(makeMatch({ events: events(4, [fifthIsCard]) }))} />);

    expect(await screen.findByText('⚠ ACHTUNG: FC Alpha hat 5 Fouls!')).toBeInTheDocument();
  });
});

describe('LiveCockpit — Gelb-Rot im Cockpit (C3b-2 F3b2, PO 30.09.)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('eigener Schnellknopf "Gelb-Rot" -> Dialog -> onCard mit "YELLOW_RED" (keine automatische Umwandlung)', async () => {
    const onCard = vi.fn();
    const user = userEvent.setup();
    render(<LiveCockpit {...baseProps(makeMatch(), { onCard })} />);

    await user.click(screen.getByRole('button', { name: 'Gelb-Rote Karte für FC Alpha' }));
    await user.click(screen.getByRole('button', { name: 'Ohne Details' }));

    expect(onCard).toHaveBeenCalledTimes(1);
    expect(onCard).toHaveBeenCalledWith('match-1', 'team-a', 'YELLOW_RED', { playerNumber: undefined });
  });

  it('Toast nach Gelb-Rot kommt aus i18n ("Gelb-Rote Karte für ...")', async () => {
    const user = userEvent.setup();
    render(<LiveCockpit {...baseProps(makeMatch())} />);

    await user.click(screen.getByRole('button', { name: 'Gelb-Rote Karte für FC Alpha' }));
    await user.click(screen.getByRole('button', { name: 'Ohne Details' }));

    expect(await screen.findByText('Gelb-Rote Karte für FC Alpha')).toBeInTheDocument();
  });

  it('Ende-zu-Ende Dialog -> Zaehler: ein im Protokoll stehendes Gelb-Rot zaehlt als 1 Foul (Gegenbeispiel: Tor = 0)', () => {
    const match = makeMatch({
      events: [
        {
          id: 'yr1', matchId: 'match-1', type: 'RED_CARD', timestampSeconds: 10,
          payload: { teamId: 'team-a', cardType: 'YELLOW_RED' }, scoreAfter: { home: 0, away: 0 },
        },
        {
          id: 'g1', matchId: 'match-1', type: 'GOAL', timestampSeconds: 20,
          payload: { teamId: 'team-a', direction: 'INC' }, scoreAfter: { home: 1, away: 0 },
        },
      ],
    });
    render(<LiveCockpit {...baseProps(match)} />);

    // Gelb-Rot (1) -- das Tor zaehlt nicht mit (Gegenbeispiel).
    expect(screen.getByTestId('foul-count-home')).toHaveTextContent('1');
  });
});
