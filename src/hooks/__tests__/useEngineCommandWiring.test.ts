/**
 * useEngineCommandWiring (C3a-2a): B4-Schreibpfad (Engine-Spiele -> MatchCommands statt Alt-
 * Handler) + W6 (kein Handler wirft; typisierte Fehler werden als Toast gezeigt).
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { Tournament } from '../../types/tournament';
import type { LiveMatch } from '../../core/models/LiveMatch';
import { LocalMatchStore, ClockSync, MatchEngine } from '../../core/match/client';

const mockShowWarning = vi.fn();
const mockShowError = vi.fn();
vi.mock('../../components/ui/Toast/ToastContext', () => ({
  useToast: () => ({ showWarning: mockShowWarning, showError: mockShowError, showInfo: vi.fn() }),
}));

const mockCaptureFeatureError = vi.fn();
vi.mock('../../lib/sentry', () => ({
  captureFeatureError: (...args: unknown[]) => mockCaptureFeatureError(...args),
}));

const mockRole: { current: 'owner' | 'co-admin' | 'collaborator' } = { current: 'owner' };
vi.mock('../../features/auth/hooks/useMyTournamentRole', () => ({
  useMyTournamentRole: () => ({ role: mockRole.current, isLoading: false }),
}));

import { useEngineCommandWiring, type EngineCommandFallbackHandlers } from '../useEngineCommandWiring';
import type { MatchEngineContextValue } from '../../features/match-engine/matchEngineContextInstance';

const ENGINE_MATCH_ID = 'engine-1';
const OLD_MATCH_ID = 'old-1';

function makeFallback(): EngineCommandFallbackHandlers {
  return {
    handleStart: vi.fn().mockResolvedValue(true),
    handlePause: vi.fn().mockResolvedValue(undefined),
    handleResume: vi.fn().mockResolvedValue(undefined),
    handleFinish: vi.fn().mockResolvedValue(undefined),
    handleForceFinish: vi.fn().mockResolvedValue(undefined),
    handleGoal: vi.fn().mockResolvedValue(undefined),
    handleCard: vi.fn().mockResolvedValue(undefined),
    handleTimePenalty: vi.fn().mockResolvedValue(undefined),
    handleSubstitution: vi.fn().mockResolvedValue(undefined),
    handleFoul: vi.fn().mockResolvedValue(undefined),
    handleStartOvertime: vi.fn().mockResolvedValue(undefined),
    handleStartGoldenGoal: vi.fn().mockResolvedValue(undefined),
    handleStartPenaltyShootout: vi.fn().mockResolvedValue(undefined),
    handleRecordPenaltyResult: vi.fn().mockResolvedValue(undefined),
    handleCancelTiebreaker: vi.fn().mockResolvedValue(undefined),
    handleAbortPenaltyShootout: vi.fn().mockResolvedValue(undefined),
    handleManualEditResult: vi.fn().mockResolvedValue(undefined),
    handleAdjustTime: vi.fn().mockResolvedValue(undefined),
    handleSkipMatch: vi.fn().mockResolvedValue(undefined),
    handleUnskipMatch: vi.fn().mockResolvedValue(undefined),
    handleUndoLastEvent: vi.fn().mockResolvedValue(undefined),
    handleUpdateEvent: vi.fn().mockResolvedValue(undefined),
    handleDeleteEvent: vi.fn().mockResolvedValue(undefined),
  };
}

function tournament(): Tournament {
  return {
    id: 'tour-wiring',
    matches: [
      { id: ENGINE_MATCH_ID, teamA: 'teama', teamB: 'teamb', round: 1, field: 1, matchNumber: 1 },
      { id: OLD_MATCH_ID, teamA: 'teama', teamB: 'teamb', round: 1, field: 2, matchNumber: 2, matchStatus: 'finished' },
    ],
    teams: [
      { id: 'teama', name: 'Heim' },
      { id: 'teamb', name: 'Gast' },
    ],
    groupPhaseGameDuration: 20,
  } as unknown as Tournament;
}

// Jeder Test bekommt ein EIGENES Konto: `fake-indexeddb` teilt die Kopie zwischen Tests (kein
// Reset zwischen `it()`-Bloecken) -- ein gemeinsames Konto wuerde MATCH_START aus einem
// vorigen Test wiederfinden (Zustand waere faelschlich schon 'running').
let accountCounter = 0;
async function makeEngineContext() {
  const accountId = `acc-wiring-${(accountCounter += 1)}`;
  const store = new LocalMatchStore();
  const clock = new ClockSync(() => Promise.resolve(1_790_000_000_000), () => 1_790_000_000_000, {
    get: () => null,
    set: () => undefined,
  });
  const engine = new MatchEngine({
    store,
    clock,
    sender: { start: vi.fn().mockResolvedValue(undefined), stop: vi.fn() },
    fetchConfirmed: vi.fn(),
    now: () => 1_790_000_000_000,
  });
  await engine.start(accountId);
  await engine.ensureMatch(ENGINE_MATCH_ID, { matchId: ENGINE_MATCH_ID, teamAId: 'teama', teamBId: 'teamb' });
  return {
    engine,
    store,
    clock,
    sender: { kick: vi.fn().mockResolvedValue(undefined) },
    accountId,
  } as unknown as MatchEngineContextValue;
}

describe('useEngineCommandWiring (C3a-2a, B4/W6)', () => {
  const engineLiveMatches = new Map<string, LiveMatch>([[ENGINE_MATCH_ID, { id: ENGINE_MATCH_ID } as unknown as LiveMatch]]);

  beforeEach(() => {
    mockShowWarning.mockClear();
    mockShowError.mockClear();
    mockCaptureFeatureError.mockClear();
    mockRole.current = 'owner';
  });

  it('Altspiel: handleStart delegiert unveraendert an den Alt-Handler', async () => {
    const fallback = makeFallback();
    const { result } = renderHook(() => useEngineCommandWiring(tournament(), null, engineLiveMatches, fallback));

    const started = await result.current.handleStart(OLD_MATCH_ID);

    expect(started).toBe(true);
    expect(fallback.handleStart).toHaveBeenCalledWith(OLD_MATCH_ID);
  });

  it('B4: Engine-Spiel, MATCH_START -> ruft MatchCommands statt fallback.handleStart auf', async () => {
    const fallback = makeFallback();
    const engineContext = await makeEngineContext();
    const { result } = renderHook(() => useEngineCommandWiring(tournament(), engineContext, engineLiveMatches, fallback));

    const started = await result.current.handleStart(ENGINE_MATCH_ID);

    expect(started).toBe(true);
    expect(fallback.handleStart).not.toHaveBeenCalled();
    const copy = await engineContext.store.load(engineContext.accountId, ENGINE_MATCH_ID);
    expect(copy?.pending.some((e) => e.type === 'MATCH_START')).toBe(true);
  });

  it('W6: ein lokal ungueltiges Ereignis (Tor vor Anpfiff) zeigt einen Toast, wirft NICHT', async () => {
    const fallback = makeFallback();
    const engineContext = await makeEngineContext();
    const { result } = renderHook(() => useEngineCommandWiring(tournament(), engineContext, engineLiveMatches, fallback));

    await result.current.handleGoal(ENGINE_MATCH_ID, 'teama', 1);

    await waitFor(() => expect(mockShowWarning.mock.calls.length + mockShowError.mock.calls.length).toBeGreaterThan(0));
    expect(fallback.handleGoal).not.toHaveBeenCalled();
    const copy = await engineContext.store.load(engineContext.accountId, ENGINE_MATCH_ID);
    expect(copy?.pending.some((e) => e.type === 'GOAL')).toBe(false);
  });

  it('PC14: Tor mit delta -1 (Minus/Rueckgaengig) zeigt NotOnEngineYetError-Toast statt Ausfuehrung', async () => {
    const fallback = makeFallback();
    const engineContext = await makeEngineContext();
    const { result } = renderHook(() => useEngineCommandWiring(tournament(), engineContext, engineLiveMatches, fallback));

    await result.current.handleGoal(ENGINE_MATCH_ID, 'teama', -1);

    expect(mockShowWarning).toHaveBeenCalled();
    expect(fallback.handleGoal).not.toHaveBeenCalled();
  });

  it('PC14: eine nicht umgestellte Aktion (handleUndoLastEvent) zeigt fuer ein Engine-Spiel den Toast, ruft den Alt-Handler NICHT', async () => {
    const fallback = makeFallback();
    const engineContext = await makeEngineContext();
    const { result } = renderHook(() => useEngineCommandWiring(tournament(), engineContext, engineLiveMatches, fallback));

    await result.current.handleUndoLastEvent(ENGINE_MATCH_ID);

    expect(mockShowWarning).toHaveBeenCalled();
    expect(fallback.handleUndoLastEvent).not.toHaveBeenCalled();
  });

  it('PC14: dieselbe nicht umgestellte Aktion ruft fuer ein Altspiel unveraendert den Alt-Handler auf', async () => {
    const fallback = makeFallback();
    const { result } = renderHook(() => useEngineCommandWiring(tournament(), null, engineLiveMatches, fallback));

    await result.current.handleUndoLastEvent(OLD_MATCH_ID);

    expect(fallback.handleUndoLastEvent).toHaveBeenCalledWith(OLD_MATCH_ID);
    expect(mockShowWarning).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // I5 (Fixrunde 1): vier Mutationen aus dem Review muessen jetzt rot werden.
  // ---------------------------------------------------------------------------

  it('M3: der Akteur kommt aus der echten Rolle (collaborator -> helper), nicht fest verdrahtet', async () => {
    mockRole.current = 'collaborator';
    const fallback = makeFallback();
    const engineContext = await makeEngineContext();
    const { result } = renderHook(() => useEngineCommandWiring(tournament(), engineContext, engineLiveMatches, fallback));

    await result.current.handleStart(ENGINE_MATCH_ID);

    const copy = await engineContext.store.load(engineContext.accountId, ENGINE_MATCH_ID);
    const startEvent = copy!.pending.find((e) => e.type === 'MATCH_START')!;
    expect(startEvent.actor).toBe('helper');
  });

  it('M3b: der Akteur kommt aus der echten Rolle (owner -> leitung)', async () => {
    mockRole.current = 'owner';
    const fallback = makeFallback();
    const engineContext = await makeEngineContext();
    const { result } = renderHook(() => useEngineCommandWiring(tournament(), engineContext, engineLiveMatches, fallback));

    await result.current.handleStart(ENGINE_MATCH_ID);

    const copy = await engineContext.store.load(engineContext.accountId, ENGINE_MATCH_ID);
    const startEvent = copy!.pending.find((e) => e.type === 'MATCH_START')!;
    expect(startEvent.actor).toBe('leitung');
  });

  it('M4: MATCH_START.payload.rules beruecksichtigt die Phase (Finalrunden-Dauer statt Gruppenphase)', async () => {
    const fallback = makeFallback();
    const engineContext = await makeEngineContext();
    const t = {
      ...tournament(),
      groupPhaseGameDuration: 20,
      finalRoundGameDuration: 30,
      matches: tournament().matches.map((m) => (m.id === ENGINE_MATCH_ID ? { ...m, phase: 'final' } : m)),
    } as unknown as Tournament;
    const { result } = renderHook(() => useEngineCommandWiring(t, engineContext, engineLiveMatches, fallback));

    await result.current.handleStart(ENGINE_MATCH_ID);

    const copy = await engineContext.store.load(engineContext.accountId, ENGINE_MATCH_ID);
    const startEvent = copy!.pending.find((e) => e.type === 'MATCH_START')!;
    const rules = startEvent.payload.rules as { sectionSeconds: number };
    // 30 Minuten (Finalrunde) / 1 Abschnitt (Default gamePeriods) = 1800s -- NICHT 20*60=1200s
    // (Gruppenphase-Dauer), die hier greifen wuerde, wenn die Phase ignoriert wird.
    expect(rules.sectionSeconds).toBe(1800);
  });

  it('M7: B4-Wache gilt auch fuer handleFinish (nicht nur handleStart)', async () => {
    const fallback = makeFallback();
    const engineContext = await makeEngineContext();
    const { result } = renderHook(() => useEngineCommandWiring(tournament(), engineContext, engineLiveMatches, fallback));
    await result.current.handleStart(ENGINE_MATCH_ID);

    await result.current.handleFinish(ENGINE_MATCH_ID);

    expect(fallback.handleFinish).not.toHaveBeenCalled();
    const copy = await engineContext.store.load(engineContext.accountId, ENGINE_MATCH_ID);
    expect(copy?.pending.some((e) => e.type === 'MATCH_END')).toBe(true);
  });

  it('M11: teamId beim Tor wird klein geschrieben, auch wenn der Aufrufer eine andere Schreibweise uebergibt', async () => {
    const fallback = makeFallback();
    const engineContext = await makeEngineContext();
    const { result } = renderHook(() => useEngineCommandWiring(tournament(), engineContext, engineLiveMatches, fallback));
    await result.current.handleStart(ENGINE_MATCH_ID);

    await result.current.handleGoal(ENGINE_MATCH_ID, 'TEAMA', 1);

    const copy = await engineContext.store.load(engineContext.accountId, ENGINE_MATCH_ID);
    const goalEvent = copy!.pending.find((e) => e.type === 'GOAL')!;
    expect(goalEvent.teamId).toBe('teama');
  });

  // ---------------------------------------------------------------------------
  // P3 (Fixrunde 3): Anpfiff-Fenster -- ein engine-bestimmtes Spiel, das die Engine noch KEINE
  // Ansicht hat (ensureMatch/Sammelabfrage noch nicht durchgelaufen, z. B. eine liegengebliebene
  // NOT_STARTED-Altzeile), darf beim Anpfiff nicht auf `fallback.handleStart` (Altweg,
  // `service.startMatch`) zurueckfallen -- erst `ensureEngineMatchReady`, DANN `commands.start`.
  // ---------------------------------------------------------------------------

  const RACE_MATCH_ID = 'race-1';

  it('P3: Anpfiff auf einem engine-bestimmten Spiel OHNE Engine-Ansicht ruft ensureEngineMatchReady, dann commands.start -- NICHT fallback.handleStart', async () => {
    const fallback = makeFallback();
    const engineContext = await makeEngineContext();
    // RACE_MATCH_ID ist bewusst NICHT in `engineLiveMatches` (keine Ansicht) UND NICHT vorab
    // `ensureMatch`-t (anders als ENGINE_MATCH_ID in `makeEngineContext()`) -- genau die Race
    // zwischen Mount und dem asynchronen `ensureMatch`.
    const ensureEngineMatchReady = vi.fn(async (matchId: string) => {
      await engineContext.engine.ensureMatch(matchId, { matchId, teamAId: 'teama', teamBId: 'teamb' });
      return { id: matchId } as unknown as LiveMatch;
    });
    const isEngineDestinedMatchId = (matchId: string) => matchId === RACE_MATCH_ID;
    const raceTournament: Tournament = {
      ...tournament(),
      matches: [...tournament().matches, { id: RACE_MATCH_ID, teamA: 'teama', teamB: 'teamb', round: 1, field: 3, matchNumber: 3 }],
    };
    const { result } = renderHook(() =>
      useEngineCommandWiring(raceTournament, engineContext, engineLiveMatches, fallback, isEngineDestinedMatchId, ensureEngineMatchReady),
    );

    const started = await result.current.handleStart(RACE_MATCH_ID);

    expect(ensureEngineMatchReady).toHaveBeenCalledWith(RACE_MATCH_ID);
    expect(started).toBe(true);
    expect(fallback.handleStart).not.toHaveBeenCalled();
    const copy = await engineContext.store.load(engineContext.accountId, RACE_MATCH_ID);
    expect(copy?.pending.some((e) => e.type === 'MATCH_START')).toBe(true);
  });

  it('P3/Minor 3 (Fixrunde 4): liefert ensureEngineMatchReady fuer den KLAREN B1-Fall keine Ansicht, zeigt handleStart einen Toast statt still false zurueckzugeben -- OHNE fallback.handleStart', async () => {
    const fallback = makeFallback();
    const engineContext = await makeEngineContext();
    const ensureEngineMatchReady = vi.fn().mockResolvedValue(null);
    const isEngineDestinedMatchId = (matchId: string) => matchId === RACE_MATCH_ID;
    const { result } = renderHook(() =>
      useEngineCommandWiring(tournament(), engineContext, engineLiveMatches, fallback, isEngineDestinedMatchId, ensureEngineMatchReady),
    );

    const started = await result.current.handleStart(RACE_MATCH_ID);

    expect(started).toBe(false);
    expect(fallback.handleStart).not.toHaveBeenCalled();
    expect(mockShowWarning.mock.calls.length + mockShowError.mock.calls.length).toBeGreaterThan(0);
  });

  // E3 (Fixrunde 4, Important 2): eine ABLEHNUNG von ensureEngineMatchReady (z. B. E1: die
  // Server-Klaerung ist gescheitert, das Spiel bleibt "unklar") wurde bisher NICHT gefangen --
  // eine unbehandelte Ablehnung ueber ManagementTab.tsx (`void hookHandleStart`).
  it('E3 (Fixrunde 4): eine Ablehnung von ensureEngineMatchReady wird gefangen -- Toast + Sentry (P7-Weg), KEINE unbehandelte Ablehnung, handleStart loest mit false auf', async () => {
    const fallback = makeFallback();
    const engineContext = await makeEngineContext();
    const rejectionError = new Error('Engine-Spiel race-1: Server-Klaerung fehlgeschlagen (Netz weg).');
    const ensureEngineMatchReady = vi.fn().mockRejectedValue(rejectionError);
    const isEngineDestinedMatchId = (matchId: string) => matchId === RACE_MATCH_ID;
    const { result } = renderHook(() =>
      useEngineCommandWiring(tournament(), engineContext, engineLiveMatches, fallback, isEngineDestinedMatchId, ensureEngineMatchReady),
    );

    // Kein Wurf ueber die Grenze hinweg -- `handleStart` selbst loest auf (mit `false`), NICHT ab.
    await expect(result.current.handleStart(RACE_MATCH_ID)).resolves.toBe(false);

    expect(mockCaptureFeatureError).toHaveBeenCalledWith(rejectionError, 'tournament', 'ensureEngineMatchReady');
    expect(mockShowWarning.mock.calls.length + mockShowError.mock.calls.length).toBeGreaterThan(0);
    expect(fallback.handleStart).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // F3b2 (Gelb-Rot im Cockpit): handleCard mappt den UI-Kartentyp auf den Engine-Befehl ueber
  // `mapCardTypeToEngine` -- nicht mehr ueber den fruehen ternaeren Ausdruck, der 'YELLOW_RED'
  // faelschlich auf 'RED_CARD' abbildete.
  // ---------------------------------------------------------------------------

  it('F3b2: handleCard(..., "YELLOW_RED") schreibt YELLOW_RED_CARD ins Engine-Log (Gegenbeispiel: nicht RED_CARD)', async () => {
    const fallback = makeFallback();
    const engineContext = await makeEngineContext();
    const { result } = renderHook(() => useEngineCommandWiring(tournament(), engineContext, engineLiveMatches, fallback));
    await result.current.handleStart(ENGINE_MATCH_ID);

    await result.current.handleCard(ENGINE_MATCH_ID, 'teama', 'YELLOW_RED', { playerNumber: 7 });

    expect(fallback.handleCard).not.toHaveBeenCalled();
    const copy = await engineContext.store.load(engineContext.accountId, ENGINE_MATCH_ID);
    const cardEvent = copy!.pending.find((e) => e.type === 'YELLOW_RED_CARD' || e.type === 'RED_CARD');
    expect(cardEvent?.type).toBe('YELLOW_RED_CARD');
  });

  it('F3b2: handleCard(..., "YELLOW") schreibt weiterhin YELLOW_CARD, handleCard(..., "RED") weiterhin RED_CARD', async () => {
    const fallback = makeFallback();
    const engineContext = await makeEngineContext();
    const { result } = renderHook(() => useEngineCommandWiring(tournament(), engineContext, engineLiveMatches, fallback));
    await result.current.handleStart(ENGINE_MATCH_ID);

    await result.current.handleCard(ENGINE_MATCH_ID, 'teama', 'YELLOW');
    const afterYellow = await engineContext.store.load(engineContext.accountId, ENGINE_MATCH_ID);
    expect(afterYellow!.pending.some((e) => e.type === 'YELLOW_CARD')).toBe(true);

    await result.current.handleCard(ENGINE_MATCH_ID, 'teamb', 'RED');
    const afterRed = await engineContext.store.load(engineContext.accountId, ENGINE_MATCH_ID);
    expect(afterRed!.pending.some((e) => e.type === 'RED_CARD')).toBe(true);
  });

  it('P2/P3: liefert ensureEngineMatchReady fuer einen fremd-Kandidaten KEINE Ansicht (bestaetigtes Altspiel), faellt handleStart auf fallback.handleStart zurueck', async () => {
    const fallback = makeFallback();
    const engineContext = await makeEngineContext();
    const ensureEngineMatchReady = vi.fn().mockResolvedValue(null);
    const isEngineDestinedMatchId = (matchId: string) => matchId === RACE_MATCH_ID;
    const isForeignCandidateMatchId = (matchId: string) => matchId === RACE_MATCH_ID;
    const { result } = renderHook(() =>
      useEngineCommandWiring(
        tournament(), engineContext, engineLiveMatches, fallback,
        isEngineDestinedMatchId, ensureEngineMatchReady, isForeignCandidateMatchId,
      ),
    );

    const started = await result.current.handleStart(RACE_MATCH_ID);

    expect(started).toBe(true);
    expect(fallback.handleStart).toHaveBeenCalledWith(RACE_MATCH_ID);
  });
});
