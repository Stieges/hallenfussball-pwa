/**
 * ManagementTab (Cockpit der Turnierleitung) – A-04a: Spielseiten über slotLabel, Wartegrund bei offener Seite.
 *
 * @TM-015 „Toms Cockpit“ zeigt die Herkunft einer unbesetzten Seite (Spielauswahl und Vorschau „nächste Spiele“).
 * @TM-033 Ein Spiel mit unbesetzter Seite lässt sich nicht anpfeifen; das Cockpit nennt den Wartegrund.
 * @TM-035 Ein Gerät ohne Netz nennt zusätzlich, dass sein Stand ohne Netz ist.
 *
 * Echte i18n-Instanz für slotLabel (DE) und die echten DE-Texte für die Komponenten (N2: gerenderter Text).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';
import type { LiveMatch } from '../../../core/models/LiveMatch';
import type { GeneratedSchedule, ScheduledMatch } from '../../../core/generators';
import { MatchAwaitingTeamsError } from '../../../core/errors';
import { teamSlot, pendingSlot } from '../../../core/models/matchSlot';
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
  LiveCockpit: (props: {
    upcomingMatches?: { homeTeam: { name: string }; awayTeam: { name: string } }[];
    lastFinishedMatch?: { match: { homeTeam: { name: string }; awayTeam: { name: string } } } | null;
    currentMatch?: { id: string } | null;
    sperrHinweise?: { playerNumber: number }[];
    leer?: { art: string; gruende?: string[]; offline?: boolean } | null;
  }) => (
    <div data-testid="cockpit-stub" data-has-match={props.currentMatch ? 'ja' : 'nein'} data-match-id={props.currentMatch?.id ?? ''} data-sperr={(props.sperrHinweise ?? []).map((h) => h.playerNumber).join(',')}>
      {props.leer?.art === 'wartetAufHerkunft' && (
        <div data-testid="tafel-wartet">
          {props.leer.gruende?.map((g) => <span key={g} data-testid="tafel-grund">{g}</span>)}
          {props.leer.offline && <span data-testid="tafel-offline">offline</span>}
        </div>
      )}
      {props.lastFinishedMatch && (
        <span data-testid="last">{props.lastFinishedMatch.match.homeTeam.name} gegen {props.lastFinishedMatch.match.awayTeam.name}</span>
      )}
      {(props.upcomingMatches ?? []).map((match, index) => (
        <span key={index} data-testid="upcoming">{match.homeTeam.name} gegen {match.awayTeam.name}</span>
      ))}
    </div>
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

const NORD = testUuid(1);
const UFER = testUuid(2);
const HF1 = testUuid(101);
const HF2 = testUuid(102);

function scheduled(partial: Partial<ScheduledMatch> & Pick<ScheduledMatch, 'id'>): ScheduledMatch {
  const start = new Date('2026-10-03T10:00:00');
  return {
    matchNumber: 1, time: '10:00', field: 1, slot: 1, phase: 'semifinal', duration: 10,
    startTime: start, endTime: start,
    // veraltete gespeicherte Anzeigetexte: dürfen nirgends erscheinen
    homeTeam: 'ALTER NAME HEIM', awayTeam: 'ALTER NAME GAST', originalTeamA: 'alt-a', originalTeamB: 'alt-b',
    slotA: pendingSlot({ kind: 'groupRank', group: 'A', rank: 1 }),
    slotB: pendingSlot({ kind: 'groupRank', group: 'B', rank: 1 }),
    ...partial,
  };
}

// Halbfinale 1: FC Nord gegen „Zweiter Gruppe B“ (Gruppe B läuft noch)
const hf1 = scheduled({
  id: HF1, matchNumber: 7, label: '1. Halbfinale',
  slotA: teamSlot(NORD, { kind: 'groupRank', group: 'A', rank: 1 }),
  slotB: pendingSlot({ kind: 'groupRank', group: 'B', rank: 2 }),
});
const hf2 = scheduled({
  id: HF2, matchNumber: 8, label: '2. Halbfinale', slot: 2,
  slotA: pendingSlot({ kind: 'groupRank', group: 'A', rank: 1 }),
  slotB: pendingSlot({ kind: 'groupRank', group: 'B', rank: 2 }),
});

function setup(options: { teams?: { id: string; name: string }[]; matches: ScheduledMatch[] }) {
  const teams = options.teams ?? [{ id: NORD, name: 'FC Nord' }, { id: UFER, name: 'VfB Ufer' }];
  const tournament = { id: 't1', title: 'Hallencup', numberOfFields: 1, teams, matches: [], groups: [] } as unknown as Tournament;
  const schedule = {
    tournament: { id: 't1', title: 'Hallencup' }, teams, allMatches: options.matches, phases: [],
  } as unknown as GeneratedSchedule;
  return render(<ManagementTab tournament={tournament} schedule={schedule} onTournamentUpdate={vi.fn()} onLocalTournamentUpdate={vi.fn()} />);
}

describe('ManagementTab – @TM-033 Wartegrund bei offener Seite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnline.value = true;
    mockGetLiveMatchData.mockRejectedValue(new MatchAwaitingTeamsError(HF1, ['B']));
  });

  it('@TM-033 Cockpit lässt den Anpfiff nicht zu und nennt den Abschluss von Gruppe B als Wartegrund', async () => {
    setup({ matches: [hf1] });
    await waitFor(() => expect(screen.getByTestId('tafel-wartet')).toBeInTheDocument());
    expect(screen.getByTestId('tafel-grund')).toHaveTextContent('Abschluss von Gruppe B');
    // die Tafel steht ohne Spiel: nichts, was sich anpfeifen ließe
    expect(screen.getByTestId('cockpit-stub')).toHaveAttribute('data-has-match', 'nein');
  });

  it('@TM-033 Gegenbeispiel: ein Wartegrund ist kein Fehler – kein Toast, keine Sentry-Meldung, kein „wird vorbereitet“', async () => {
    setup({ matches: [hf1] });
    await waitFor(() => expect(screen.getByTestId('tafel-wartet')).toBeInTheDocument());
    expect(mockShowError).not.toHaveBeenCalled();
    expect(mockCaptureFeatureError).not.toHaveBeenCalled();
    expect(screen.queryByText('Spiel wird vorbereitet …')).toBeNull();
  });

  it('@TM-033 zwei offene Seiten nennen beide Gründe; Gegenbeispiel: eine besetzte Seite nennt keinen', async () => {
    mockGetLiveMatchData.mockRejectedValue(new MatchAwaitingTeamsError(HF2, ['A', 'B']));
    const { unmount } = setup({ matches: [hf2] });
    await waitFor(() => expect(screen.getAllByTestId('tafel-grund')).toHaveLength(2));
    expect(screen.getByText('Abschluss von Gruppe A')).toBeInTheDocument();
    expect(screen.getByText('Abschluss von Gruppe B')).toBeInTheDocument();
    unmount();

    // Halbfinale 1 hat eine besetzte Heimseite (FC Nord): genau EIN Grund
    mockGetLiveMatchData.mockRejectedValue(new MatchAwaitingTeamsError(HF1, ['B']));
    setup({ matches: [hf1] });
    await waitFor(() => expect(screen.getAllByTestId('tafel-grund')).toHaveLength(1));
  });

  it('@TM-033 Gegenbeispiel: bei besetzten Seiten erscheint das Cockpit und kein Wartegrund', async () => {
    const besetzt = scheduled({ id: HF1, label: '1. Halbfinale', slotA: teamSlot(NORD), slotB: teamSlot(UFER) });
    mockGetLiveMatchData.mockResolvedValue({ id: HF1, homeTeam: { id: NORD, name: 'FC Nord' }, awayTeam: { id: UFER, name: 'VfB Ufer' }, events: [] } as unknown as LiveMatch);
    setup({ matches: [besetzt] });
    await waitFor(() => expect(mockGetLiveMatchData).toHaveBeenCalled());
    expect(screen.queryByTestId('tafel-wartet')).toBeNull();
  });
});

describe('ManagementTab – @TM-035 Stand ohne Netz', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLiveMatchData.mockRejectedValue(new MatchAwaitingTeamsError(HF1, ['B']));
  });

  it('@TM-035 ohne Netz: Wartegrund UND der Hinweis, dass der Stand dieses Geräts ohne Netz ist', async () => {
    mockOnline.value = false;
    setup({ matches: [hf1] });
    await waitFor(() => expect(screen.getByTestId('tafel-wartet')).toBeInTheDocument());
    expect(screen.getByTestId('tafel-grund')).toHaveTextContent('Abschluss von Gruppe B');
    expect(screen.getByTestId('tafel-offline')).toBeInTheDocument();
  });

  it('@TM-035 gegenbeispiel: mit Netz fehlt der Hinweis „ohne Netz“', async () => {
    mockOnline.value = true;
    setup({ matches: [hf1] });
    await waitFor(() => expect(screen.getByTestId('tafel-wartet')).toBeInTheDocument());
    expect(screen.queryByTestId('tafel-offline')).toBeNull();
  });
});

describe('ManagementTab – @TM-015 Toms Cockpit zeigt die Herkunft', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnline.value = true;
    mockGetLiveMatchData.mockRejectedValue(new MatchAwaitingTeamsError(HF1, ['B']));
  });

  it('@TM-015 Spielauswahl zeigt „FC Nord vs Zweiter Gruppe B“ und „Erster Gruppe A vs Zweiter Gruppe B“', async () => {
    setup({ matches: [hf1, hf2] });
    expect(await screen.findByText(/FC Nord vs Zweiter Gruppe B/)).toBeInTheDocument();
    expect(screen.getByText(/Erster Gruppe A vs Zweiter Gruppe B/)).toBeInTheDocument();
    expect(screen.queryByText(/ALTER NAME/)).toBeNull();
  });

  it('@TM-015 Gegenbeispiel: nach Umbenennen zeigt die Spielauswahl den neuen Namen, nicht den alten', async () => {
    setup({ matches: [hf1], teams: [{ id: NORD, name: 'FC Nordlicht' }, { id: UFER, name: 'VfB Ufer' }] });
    expect(await screen.findByText(/FC Nordlicht vs Zweiter Gruppe B/)).toBeInTheDocument();
    expect(screen.queryByText(/FC Nord vs/)).toBeNull();
  });
});

describe('ManagementTab – @TM-015 Cockpit mit laufendem Spiel: nächste Spiele und letztes Spiel', () => {
  const G0 = testUuid(110);
  const G1 = testUuid(111);
  const finished = scheduled({
    id: G0, matchNumber: 1, slot: 0, phase: 'groupStage', scoreA: 1, scoreB: 0,
    slotA: teamSlot(NORD), slotB: teamSlot(UFER),
  });
  const current = scheduled({
    id: G1, matchNumber: 2, slot: 1, phase: 'groupStage',
    slotA: teamSlot(UFER), slotB: teamSlot(NORD),
  });
  const nextHf = { ...hf1, slot: 2 };

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnline.value = true;
    mockLiveMatches.map = new Map([[G1, { id: G1, homeTeam: { id: UFER, name: 'VfB Ufer' }, awayTeam: { id: NORD, name: 'FC Nord' }, events: [] }]]);
    mockGetLiveMatchData.mockResolvedValue(mockLiveMatches.map.get(G1) as LiveMatch);
  });

  it('@TM-015 nächste Spiele zeigen „FC Nord gegen Zweiter Gruppe B“, das letzte Spiel die Teamnamen', async () => {
    setup({ matches: [finished, current, nextHf] });
    expect((await screen.findByTestId('upcoming'))).toHaveTextContent('FC Nord gegen Zweiter Gruppe B');
    expect(screen.getByTestId('last')).toHaveTextContent('FC Nord gegen VfB Ufer');
    expect(screen.queryByText(/ALTER NAME/)).toBeNull();
  });

  it('@TM-015 Gegenbeispiel: nach Umbenennen zeigen nächste Spiele und letztes Spiel den neuen Namen', async () => {
    setup({ matches: [finished, current, nextHf], teams: [{ id: NORD, name: 'FC Nordlicht' }, { id: UFER, name: 'VfB Ufer' }] });
    expect((await screen.findByTestId('upcoming'))).toHaveTextContent('FC Nordlicht gegen Zweiter Gruppe B');
    expect(screen.getByTestId('last')).toHaveTextContent('FC Nordlicht gegen VfB Ufer');
    expect(screen.queryByText(/FC Nord gegen/)).toBeNull();
  });
});

describe('ManagementTab – @SL-089 Sperr-Hinweise gehen an das Cockpit', () => {
  const G1 = testUuid(120);
  const spiel = scheduled({ id: G1, matchNumber: 11, slot: 1, phase: 'groupStage', slotA: teamSlot(NORD), slotB: teamSlot(UFER) });

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnline.value = true;
    mockLiveMatches.map = new Map([[G1, { id: G1, homeTeam: { id: NORD, name: 'FC Nord' }, awayTeam: { id: UFER, name: 'VfB Ufer' }, events: [] }]]);
    mockGetLiveMatchData.mockResolvedValue(mockLiveMatches.map.get(G1) as LiveMatch);
  });

  it('@SL-089 die gesperrte Nr. 7 von FC Nord erreicht das Cockpit von Spiel 11', async () => {
    mockSperr.hinweise = [{ teamId: NORD, playerNumber: 7, ausSpielNummer: 8 }];
    setup({ matches: [spiel] });
    expect(await screen.findByTestId('cockpit-stub')).toHaveAttribute('data-sperr', '7');
  });

  it('@SL-089 Gegenbeispiel: ohne Sperre geht nichts an das Cockpit', async () => {
    mockSperr.hinweise = [];
    setup({ matches: [spiel] });
    expect(await screen.findByTestId('cockpit-stub')).toHaveAttribute('data-sperr', '');
  });
});

describe('ManagementTab – @SL-056 @SL-117 das nächste Spiel des Felds steht bereit', () => {
  const S11 = testUuid(130);
  const S13 = testUuid(131);
  const S15 = testUuid(132);
  const live = (id: string) => ({ id, homeTeam: { id: NORD, name: 'FC Nord' }, awayTeam: { id: UFER, name: 'VfB Ufer' }, events: [] });
  const spiel11 = scheduled({ id: S11, matchNumber: 11, slot: 1, phase: 'groupStage', scoreA: 2, scoreB: 1, slotA: teamSlot(NORD), slotB: teamSlot(UFER) });
  const spiel13 = scheduled({ id: S13, matchNumber: 13, slot: 2, phase: 'groupStage', slotA: teamSlot(UFER), slotB: teamSlot(NORD) });
  const spiel15 = scheduled({ id: S15, matchNumber: 15, slot: 3, phase: 'groupStage', slotA: teamSlot(NORD), slotB: teamSlot(UFER) });

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnline.value = true;
    mockLiveMatches.map = new Map([[S13, live(S13)], [S15, live(S15)]]);
    mockGetLiveMatchData.mockResolvedValue(live(S13) as unknown as LiveMatch);
  });

  it('@SL-056 auch ohne Netz steht nach Spiel 11 das Spiel 13 zum Anpfiff bereit', async () => {
    mockOnline.value = false;
    setup({ matches: [spiel11, spiel13, spiel15] });
    expect(await screen.findByTestId('cockpit-stub')).toHaveAttribute('data-match-id', S13);
    expect(screen.getByTestId('cockpit-stub')).toHaveAttribute('data-has-match', 'ja');
  });

  // @SL-117 (ausgefallenes Spiel steht nicht bereit): `ManagementTab` liest den Zeitplan (`ScheduledMatch`), der den Ausfall nicht
  // kennt; der Ausfall steht nur am gespeicherten Spiel (`matchStatus: 'skipped'`). Die Auswahl „nächstes Spiel“ übernimmt
  // B-10a1 (`readyMatchOf`). Bis dahin wählt `currentMatchData` das erste Spiel ohne Ergebnis, auch ein ausgefallenes (Befund
  // C-COCKPIT-AUSGEFALLEN-BEREIT, Ziel Record Spiel leiten); der Test entsteht mit B-10a1 am dann vorhandenen Baustein.
  it.todo('@SL-117 ein ausgefallenes Spiel 13 steht nicht bereit: nach Spiel 11 steht Spiel 15 zum Anpfiff bereit (B-10a1)');

  it('@SL-117 Gegenbeispiel: ohne Ausfall steht das nächste Spiel 13 bereit, nicht Spiel 15 (Reihenfolge des Felds)', async () => {
    setup({ matches: [spiel11, spiel13, spiel15] });
    expect(await screen.findByTestId('cockpit-stub')).toHaveAttribute('data-match-id', S13);
  });
});
