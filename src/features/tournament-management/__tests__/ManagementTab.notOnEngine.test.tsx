/**
 * ManagementTab – A-08a (@FU-069): Spiel mit eingetragenem Ergebnis ist nicht über die Engine leitbar.
 * Gegenbeispiel: kein Cockpit im DOM, stattdessen der Hinweis (data-testid `cockpit-not-on-engine`),
 * ohne Toast und ohne Sentry-Meldung.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';
import type { GeneratedSchedule, ScheduledMatch } from '../../../core/generators';
import { MatchNotOnEngineError } from '../../../core/errors';
import { teamSlot } from '../../../core/models/matchSlot';
import { testUuid } from '../../../test/testIds';

// R3-4 (@SL-159): „Korrektur über die Turnierleitung“ gilt nur für Helfer; ob Olli (Turnierleitung) oder Tom (Helfer) davorsitzt, steuert `can.lead`
const can = vi.hoisted(() => ({ lead: false }));
vi.mock('../../auth/hooks/useCan', () => ({
  useCan: (permission: string) => (permission === 'writeMatchData' ? true : permission === 'leadMatches' && can.lead),
  useCanState: (permission: string) => ({ allowed: permission === 'writeMatchData', isLoading: false }),
}));
const mockShowError = vi.fn();
vi.mock('../../../hooks/useActorRole', () => ({ useActorRole: () => 'owner' }));
vi.mock('../../../components/ui/Toast/ToastContext', () => ({
  useToast: () => ({ showError: mockShowError, showSuccess: vi.fn(), showWarning: vi.fn(), showInfo: vi.fn() }),
}));
const mockCaptureFeatureError = vi.fn();
vi.mock('../../../lib/sentry', () => ({
  captureFeatureError: (...args: unknown[]) => mockCaptureFeatureError(...args),
}));
vi.mock('../../auth/hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: true, user: { id: 'user-1' } }),
}));
vi.mock('../../../components/live-cockpit', () => ({
  LiveCockpit: () => <div data-testid="cockpit-stub" />,
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
vi.mock('../../../hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => ({ isOnline: true, wasOffline: false }),
}));

// Übersetzung aus den echten DE-Dateien (tournament + cockpit), Namespace wird ignoriert.
vi.mock('react-i18next', async () => {
  const tournamentDe: unknown = (await import('../../../i18n/locales/de/tournament.json')).default;
  const cockpitDe: unknown = (await import('../../../i18n/locales/de/cockpit.json')).default;
  const resources: unknown[] = [tournamentDe, cockpitDe];
  const translate = (key: string): string => {
    for (const root of resources) {
      const found = key.split('.').reduce<unknown>(
        (node, part) => (typeof node === 'object' && node !== null ? (node as Record<string, unknown>)[part] : undefined),
        root,
      );
      if (typeof found === 'string') { return found; }
    }
    return key;
  };
  const stable = { t: translate, i18n: { language: 'de' } };
  return { useTranslation: () => stable };
});

const mockGetLiveMatchData = vi.fn<() => Promise<unknown>>();
vi.mock('../../../hooks/useCockpitExecution', () => ({
  useCockpitExecution: () => ({
    liveMatches: new Map(),
    getLiveMatchData: mockGetLiveMatchData,
    hasRunningMatch: () => undefined,
    handleStart: vi.fn(), handlePause: vi.fn(), handleResume: vi.fn(), handleFinish: vi.fn(),
    handleForceFinish: vi.fn(), handleGoal: vi.fn(), handleTimePenalty: vi.fn(), handleCard: vi.fn(),
    handleSubstitution: vi.fn(), handleFoul: vi.fn(), handleUndoLastEvent: vi.fn(),
    handleManualEditResult: vi.fn(), handleAdjustTime: vi.fn(),
    handleStartOvertime: vi.fn(), handleStartGoldenGoal: vi.fn(), handleStartPenaltyShootout: vi.fn(),
    handleRecordPenaltyResult: vi.fn(), handleAbortPenaltyShootout: vi.fn(),
    handleUpdateEvent: vi.fn(), handleDeleteEvent: vi.fn(),
  }),
}));

import { ManagementTab } from '../ManagementTab';
import { resetClosedTournaments, setTournamentClosed } from '../../../core/services/closedTournaments';

import { RouterWrapper } from './routerWrapper';
const NORD = testUuid(1);
const UFER = testUuid(2);
const SPIEL = testUuid(201);

function scheduled(partial: Partial<ScheduledMatch> & Pick<ScheduledMatch, 'id'>): ScheduledMatch {
  const start = new Date('2026-10-03T10:00:00');
  return {
    matchNumber: 1, time: '10:00', field: 1, slot: 1, phase: 'groupStage', duration: 10,
    startTime: start, endTime: start,
    homeTeam: 'FC Nord', awayTeam: 'VfB Ufer', originalTeamA: NORD, originalTeamB: UFER,
    slotA: teamSlot(NORD), slotB: teamSlot(UFER),
    ...partial,
  };
}

function setup(matches: ScheduledMatch[], initialMatchId?: string) {
  const teams = [{ id: NORD, name: 'FC Nord' }, { id: UFER, name: 'VfB Ufer' }];
  const tournament = { id: 't1', title: 'Hallencup', numberOfFields: 1, teams, matches: [], groups: [] } as unknown as Tournament;
  const schedule = {
    tournament: { id: 't1', title: 'Hallencup' }, teams, allMatches: matches, phases: [],
  } as unknown as GeneratedSchedule;
  return render(<ManagementTab tournament={tournament} schedule={schedule} onTournamentUpdate={vi.fn()} onLocalTournamentUpdate={vi.fn()} initialMatchId={initialMatchId} />, { wrapper: RouterWrapper });
}

/** Spiele mit Ergebnis fallen bei der Auto-Auswahl heraus; sie öffnen sich über `?matchId=` aus dem Spielplan (es gibt keine Spielauswahl, @SL-057). */

describe('ManagementTab – @FU-069 Hinweis bei eingetragenem Ergebnis (A-08a)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    can.lead = false;
    mockGetLiveMatchData.mockRejectedValue(new MatchNotOnEngineError('resultEntered'));
  });

  it('@FU-069 zeigt den Hinweis statt Cockpit, ohne Toast und ohne Sentry-Meldung', async () => {
    setup([scheduled({ id: SPIEL, scoreA: 3, scoreB: 1 })], SPIEL);

    await waitFor(() => expect(screen.getByTestId('cockpit-not-on-engine')).toBeInTheDocument());
    expect(screen.getByTestId('cockpit-not-on-engine')).toHaveTextContent('Spiel ist beendet – Korrektur über die Turnierleitung');
    expect(screen.queryByTestId('cockpit-stub')).toBeNull();
    expect(mockShowError).not.toHaveBeenCalled();
    expect(mockCaptureFeatureError).not.toHaveBeenCalled();
  });

  it('@SL-159 Tom (Helfer) liest „Korrektur über die Turnierleitung“; Olli (Turnierleitung) liest nicht, an wen er sich wenden soll, sondern wo er korrigiert', async () => {
    can.lead = true;
    setup([scheduled({ id: SPIEL, scoreA: 3, scoreB: 1 })], SPIEL);
    await waitFor(() => expect(screen.getByTestId('cockpit-not-on-engine')).toBeInTheDocument());
    expect(screen.getByTestId('cockpit-not-on-engine')).toHaveTextContent('Für dieses Spiel ist ein Ergebnis eingetragen. Korrigieren geht im Spielplan.');
    expect(screen.getByTestId('cockpit-not-on-engine')).not.toHaveTextContent('über die Turnierleitung');
  });

  it('Review #395: nach dem Abschluss liest die Turnierleitung weder den Helfer-Satz noch den Korrektur-Satz, sondern „abgeschlossen“', async () => {
    can.lead = true;
    setTournamentClosed('t1', true);
    try {
      setup([scheduled({ id: SPIEL, scoreA: 3, scoreB: 1 })], SPIEL);
      await waitFor(() => expect(screen.getByTestId('cockpit-not-on-engine')).toBeInTheDocument());
      expect(screen.getByTestId('cockpit-not-on-engine')).toHaveTextContent('Das Turnier ist abgeschlossen');
      expect(screen.getByTestId('cockpit-not-on-engine')).not.toHaveTextContent('Korrektur über die Turnierleitung');
    } finally {
      resetClosedTournaments();
    }
  });
});
