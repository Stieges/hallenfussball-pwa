/**
 * ManagementTab, @SL-243: das Cockpit der Turnierleitung sagt der Tafel, ob das Feld genannt wird – nur bei mehr als einem Feld
 * (`effectiveFieldCount` des Turniers, dieselbe Zählweise wie Monitor und Spielplan). Der Cockpit-Baustein ist ein Stub, der die Angabe zeigt;
 * die Texte der Tafel prüfen `LiveCockpit.einFeld.test.tsx` und `toScoreboardModel.einFeld.test.ts`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';
import type { LiveMatch } from '../../../core/models/LiveMatch';
import type { GeneratedSchedule, ScheduledMatch } from '../../../core/generators';
import { teamSlot } from '../../../core/models/matchSlot';
import { testUuid } from '../../../test/testIds';

const mockShowError = vi.fn();
vi.mock('../../../hooks/useActorRole', () => ({ useActorRole: () => 'helper' }));
vi.mock('../../../components/ui/Toast/ToastContext', () => ({
  useToast: () => ({ showError: mockShowError, showSuccess: vi.fn(), showWarning: vi.fn(), showInfo: vi.fn() }),
}));
const mockCaptureFeatureError = vi.fn();
// Merge Spur A/B: ManagementTab loest seit B-04 Fixrunde 1 (@W2A-030) die Spielregel-Rolle ueber
// useEffectiveTournamentRole auf; das braucht useAuth. Hier nicht Gegenstand.
vi.mock('../../auth/hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: true, user: { id: 'user-1' } }),
}));

vi.mock('../../../lib/sentry', () => ({
  captureFeatureError: (...args: unknown[]) => mockCaptureFeatureError(...args),
}));

// Cockpit-Stub: zeigt die „nächsten Spiele“ als Text, damit ihre Namen prüfbar sind
vi.mock('../../../components/live-cockpit', () => ({
  LiveCockpit: (props: { currentMatch?: { id: string } | null; showField?: boolean; leer?: { art: string; feldName?: string } | null }) => (
    <div data-testid="cockpit-stub" data-has-match={props.currentMatch ? 'ja' : 'nein'} data-show-field={String(props.showField)} data-leer-feld={props.leer?.feldName ?? ''} />
  ),
}));
vi.mock('../../../hooks/useMatchSound', () => ({
  useMatchSound: () => ({
    play: vi.fn(), stop: vi.fn(), testPlay: vi.fn(), activate: vi.fn(),
    isPlaying: false, isLoading: false, isReady: true, isActivated: true, error: null,
  }),
}));
vi.mock('../../auth/hooks/useTournamentMembers', () => ({
  useTournamentMembers: () => ({ members: [], isLoading: false, error: null, myMembership: undefined }),
}));

const mockSperr = vi.hoisted(() => ({ hinweise: [] as { teamId: string; playerNumber: number; ausSpielNummer: number }[] }));
vi.mock('../../../hooks/useRedCardSuspensions', () => ({ useRedCardSuspensions: () => mockSperr.hinweise }));

const mockOnline = vi.hoisted(() => ({ value: true }));
vi.mock('../../../hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => ({ isOnline: mockOnline.value, wasOffline: false }),
}));

vi.mock('i18next', async () => {
  const actual = await vi.importActual<typeof import('i18next')>('i18next');
  const de = (await import('../../../i18n/locales/de/tournament.json')).default;
  const instance = actual.default.createInstance();
  await instance.init({
    lng: 'de',
    fallbackLng: false,
    resources: { de: { tournament: de } },
    interpolation: { escapeValue: false },
  });
  return { default: instance };
});
vi.mock('react-i18next', async () => {
  const de: unknown = (await import('../../../i18n/locales/de/tournament.json')).default;
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

const mockGetLiveMatchData = vi.fn<() => Promise<LiveMatch>>();
const mockLiveMatches = vi.hoisted(() => ({ map: new Map<string, unknown>() }));
vi.mock('../../../hooks/useCockpitExecution', () => ({
  useCockpitExecution: () => ({
    liveMatches: mockLiveMatches.map as Map<string, LiveMatch>,
    loadingStates: { goal: false, card: false, finish: false, undo: false, start: false },
    isAnyLoading: false,
    getLiveMatchData: mockGetLiveMatchData,
    handleStart: vi.fn(), handlePause: vi.fn(), handleResume: vi.fn(), handleFinish: vi.fn(),
    handleForceFinish: vi.fn(), handleGoal: vi.fn(), handleTimePenalty: vi.fn(), handleCard: vi.fn(),
    handleSubstitution: vi.fn(), handleFoul: vi.fn(), handleUndoLastEvent: vi.fn(),
    handleManualEditResult: vi.fn(), handleAdjustTime: vi.fn(), handleReopenMatch: vi.fn(),
    hasRunningMatch: () => undefined,
    handleStartOvertime: vi.fn(), handleStartGoldenGoal: vi.fn(), handleStartPenaltyShootout: vi.fn(),
    handleRecordPenaltyResult: vi.fn(), handleAbortPenaltyShootout: vi.fn(),
    handleUpdateEvent: vi.fn(), handleDeleteEvent: vi.fn(),
  }),
}));

import { ManagementTab } from '../ManagementTab';
import { RouterWrapper } from './routerWrapper';

const NORD = testUuid(1);
const UFER = testUuid(2);
const SPIEL = testUuid(101);

function setup(felder: number, mitSpiel: boolean) {
  const teams = [{ id: NORD, name: 'FC Nord' }, { id: UFER, name: 'VfB Ufer' }];
  const start = new Date('2026-10-03T10:00:00');
  const match: ScheduledMatch = {
    id: SPIEL, matchNumber: 3, time: '10:00', field: 1, slot: 1, phase: 'groupStage', duration: 10, startTime: start, endTime: start,
    homeTeam: 'x', awayTeam: 'y', originalTeamA: 'a', originalTeamB: 'b', slotA: teamSlot(NORD), slotB: teamSlot(UFER),
  };
  const tournament = { id: 't1', title: 'Nikolaus-Turnier', numberOfFields: felder, teams, matches: [], groups: [] } as unknown as Tournament;
  const schedule = { tournament: { id: 't1', title: 'Nikolaus-Turnier' }, teams, allMatches: mitSpiel ? [match] : [], phases: [] } as unknown as GeneratedSchedule;
  const live = { id: SPIEL, homeTeam: { id: NORD, name: 'FC Nord' }, awayTeam: { id: UFER, name: 'VfB Ufer' }, events: [] };
  mockLiveMatches.map = new Map([[SPIEL, live]]);
  mockGetLiveMatchData.mockResolvedValue(live as unknown as LiveMatch);
  return render(<ManagementTab tournament={tournament} schedule={schedule} onTournamentUpdate={vi.fn()} onLocalTournamentUpdate={vi.fn()} />, { wrapper: RouterWrapper });
}

describe('@SL-243 ManagementTab: Feld in der Tafel nur bei mehreren Feldern', () => {
  beforeEach(() => { vi.clearAllMocks(); mockOnline.value = true; });

  it('ein Feld, Spiel im Cockpit: showField ist false', async () => {
    setup(1, true);
    await waitFor(() => expect(screen.getByTestId('cockpit-stub')).toHaveAttribute('data-has-match', 'ja'));
    expect(screen.getByTestId('cockpit-stub')).toHaveAttribute('data-show-field', 'false');
  });

  it('Gegenbeispiel zwei Felder, Spiel im Cockpit: showField ist true', async () => {
    setup(2, true);
    await waitFor(() => expect(screen.getByTestId('cockpit-stub')).toHaveAttribute('data-has-match', 'ja'));
    expect(screen.getByTestId('cockpit-stub')).toHaveAttribute('data-show-field', 'true');
  });

  it('ein Feld, kein Spiel mehr: showField false und kein Feldname im Grund', async () => {
    setup(1, false);
    const stub = await screen.findByTestId('cockpit-stub');
    expect(stub).toHaveAttribute('data-has-match', 'nein');
    expect(stub).toHaveAttribute('data-show-field', 'false');
    expect(stub).toHaveAttribute('data-leer-feld', '');
  });

  it('Gegenbeispiel zwei Felder, kein Spiel mehr: der Grund nennt das Feld', async () => {
    setup(2, false);
    const stub = await screen.findByTestId('cockpit-stub');
    expect(stub).toHaveAttribute('data-show-field', 'true');
    expect(stub.getAttribute('data-leer-feld')).toMatch(/Feld 1/);
  });
});
