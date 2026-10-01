/**
 * LiveCockpit -- Fouls zaehlen fuer das ganze Spiel (C3b-2, G11).
 * Kein Halbzeit-Reset, kein lokales +1, sichtbarer R6-Hinweis. Echte deutsche Texte.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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
