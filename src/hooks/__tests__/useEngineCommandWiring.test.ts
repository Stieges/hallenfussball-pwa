/**
 * useEngineCommandWiring (C3a-2a, A-08d2b): Schreibpfad ausschliesslich ueber MatchCommands, kein
 * Altweg; Aktionen ohne Engine-Weg werden mit Hinweis abgelehnt (@FU-069/@FU-070/@FU-071).
 * W6: kein Handler wirft; typisierte Fehler werden als Toast gezeigt.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { Tournament } from '../../types/tournament';
import type { LiveMatch } from '../../core/models/LiveMatch';

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

import { useEngineCommandWiring } from '../useEngineCommandWiring';
import { looseVs } from '../../test/matchSlotFixtures';
import { makeEngineContext } from '../../test/engineContextFixture';

const ENGINE_MATCH_ID = 'engine-1';
const OLD_MATCH_ID = 'old-1';

function tournament(): Tournament {
  return {
    id: 'tour-wiring',
    matches: [
      { id: ENGINE_MATCH_ID, ...looseVs('teama', 'teamb'), round: 1, field: 1, matchNumber: 1 },
      { id: OLD_MATCH_ID, ...looseVs('teama', 'teamb'), round: 1, field: 2, matchNumber: 2, matchStatus: 'finished' },
    ],
    teams: [
      { id: 'teama', name: 'Heim' },
      { id: 'teamb', name: 'Gast' },
    ],
    groupPhaseGameDuration: 20,
  } as unknown as Tournament;
}

describe('useEngineCommandWiring (C3a-2a, B4/W6)', () => {
  const engineLiveMatches = new Map<string, LiveMatch>([[ENGINE_MATCH_ID, { id: ENGINE_MATCH_ID } as unknown as LiveMatch]]);

  beforeEach(() => {
    mockShowWarning.mockClear();
    mockShowError.mockClear();
    mockCaptureFeatureError.mockClear();
    mockRole.current = 'owner';
  });

  it('A-08d2b (@FU-071): Altspiel ohne Engine-Weg -- handleStart lehnt ab, Toast, kein Anpfiff', async () => {
    const { result } = renderHook(() => useEngineCommandWiring(tournament(), null, engineLiveMatches));

    const started = await result.current.handleStart(OLD_MATCH_ID);

    expect(started).toBe(false);
    expect(mockShowWarning).toHaveBeenCalledWith('cockpit:engine.invalid');
  });

  it('B4: Engine-Spiel, MATCH_START -> schreibt ueber MatchCommands', async () => {
    const engineContext = await makeEngineContext();
    const { result } = renderHook(() => useEngineCommandWiring(tournament(), engineContext, engineLiveMatches));

    const started = await result.current.handleStart(ENGINE_MATCH_ID);

    expect(started).toBe(true);
    const copy = await engineContext.store.load(engineContext.accountId, ENGINE_MATCH_ID);
    expect(copy?.pending.some((e) => e.type === 'MATCH_START')).toBe(true);
  });

  it('W6: ein lokal ungueltiges Ereignis (Tor vor Anpfiff) zeigt einen Toast, wirft NICHT', async () => {
    const engineContext = await makeEngineContext();
    const { result } = renderHook(() => useEngineCommandWiring(tournament(), engineContext, engineLiveMatches));

    await result.current.handleGoal(ENGINE_MATCH_ID, 'teama', 1);

    await waitFor(() => expect(mockShowWarning.mock.calls.length + mockShowError.mock.calls.length).toBeGreaterThan(0));
    const copy = await engineContext.store.load(engineContext.accountId, ENGINE_MATCH_ID);
    expect(copy?.pending.some((e) => e.type === 'GOAL')).toBe(false);
  });

  it('PC14/A-08d2b: Tor mit delta -1 (Minus) wird abgelehnt (engine.invalid), kein GOAL im Log', async () => {
    const engineContext = await makeEngineContext();
    const { result } = renderHook(() => useEngineCommandWiring(tournament(), engineContext, engineLiveMatches));
    await result.current.handleStart(ENGINE_MATCH_ID);

    await result.current.handleGoal(ENGINE_MATCH_ID, 'teama', -1);

    expect(mockShowWarning).toHaveBeenCalledWith('cockpit:engine.invalid');
    const copy = await engineContext.store.load(engineContext.accountId, ENGINE_MATCH_ID);
    expect(copy?.pending.some((e) => e.type === 'GOAL')).toBe(false);
  });

  // A-08d2b: Gegenbeispiel "Spiel-ID ohne Engine-Ansicht" -- jede Aktion wird abgelehnt, kein Schreibweg.
  it('A-08d2b (@FU-071): Spiel ohne Engine-Ansicht -- handleStart false, handleGoal/handleFoul/handleFinish nur Toast', async () => {
    const { result } = renderHook(() => useEngineCommandWiring(tournament(), null, engineLiveMatches));

    expect(await result.current.handleStart(OLD_MATCH_ID)).toBe(false);
    await result.current.handleGoal(OLD_MATCH_ID, 'teama', 1);
    await result.current.handleFoul(OLD_MATCH_ID, 'teama');
    await result.current.handleFinish(OLD_MATCH_ID);

    expect(mockShowWarning).toHaveBeenCalledTimes(4);
    expect(mockShowWarning).toHaveBeenCalledWith('cockpit:engine.invalid');
  });

  // A-08d2b Pflichttest (@FU-070): zweites Spielende wird nicht zweimal in den Log geschrieben.
  it('A-08d2b (@FU-070): zweites handleFinish laesst den Log bei genau einem MATCH_END, wirft nicht', async () => {
    const engineContext = await makeEngineContext();
    const { result } = renderHook(() => useEngineCommandWiring(tournament(), engineContext, engineLiveMatches));
    await result.current.handleStart(ENGINE_MATCH_ID);
    await result.current.handleFinish(ENGINE_MATCH_ID);

    await expect(result.current.handleFinish(ENGINE_MATCH_ID)).resolves.toBeUndefined();

    const copy = await engineContext.store.load(engineContext.accountId, ENGINE_MATCH_ID);
    expect(copy!.pending.filter((e) => e.type === 'MATCH_END')).toHaveLength(1);
  });

  // A-08d2b Pflichttest (@FU-069): ein Tor nach Spielende wird abgelehnt mit dem Grund-Hinweis.
  it('A-08d2b (@FU-069): handleGoal(+1) nach Spielende -- kein GOAL, Toast mit Grund "Spiel beendet"', async () => {
    const engineContext = await makeEngineContext();
    const { result } = renderHook(() => useEngineCommandWiring(tournament(), engineContext, engineLiveMatches));
    await result.current.handleStart(ENGINE_MATCH_ID);
    await result.current.handleFinish(ENGINE_MATCH_ID);

    await result.current.handleGoal(ENGINE_MATCH_ID, 'teama', 1);

    expect(mockShowWarning).toHaveBeenCalledWith('cockpit:engine.retract.hint.goalFinished');
    const copy = await engineContext.store.load(engineContext.accountId, ENGINE_MATCH_ID);
    expect(copy?.pending.some((e) => e.type === 'GOAL')).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // I5 (Fixrunde 1): vier Mutationen aus dem Review muessen jetzt rot werden.
  // ---------------------------------------------------------------------------

  it('M3: der Akteur kommt aus der echten Rolle (collaborator -> helper), nicht fest verdrahtet', async () => {
    mockRole.current = 'collaborator';
    const engineContext = await makeEngineContext();
    const { result } = renderHook(() => useEngineCommandWiring(tournament(), engineContext, engineLiveMatches));

    await result.current.handleStart(ENGINE_MATCH_ID);

    const copy = await engineContext.store.load(engineContext.accountId, ENGINE_MATCH_ID);
    const startEvent = copy!.pending.find((e) => e.type === 'MATCH_START')!;
    expect(startEvent.actor).toBe('helper');
  });

  it('M3b: der Akteur kommt aus der echten Rolle (owner -> leitung)', async () => {
    mockRole.current = 'owner';
    const engineContext = await makeEngineContext();
    const { result } = renderHook(() => useEngineCommandWiring(tournament(), engineContext, engineLiveMatches));

    await result.current.handleStart(ENGINE_MATCH_ID);

    const copy = await engineContext.store.load(engineContext.accountId, ENGINE_MATCH_ID);
    const startEvent = copy!.pending.find((e) => e.type === 'MATCH_START')!;
    expect(startEvent.actor).toBe('leitung');
  });

  it('M4: MATCH_START.payload.rules beruecksichtigt die Phase (Finalrunden-Dauer statt Gruppenphase)', async () => {
    const engineContext = await makeEngineContext();
    const t = {
      ...tournament(),
      groupPhaseGameDuration: 20,
      finalRoundGameDuration: 30,
      matches: tournament().matches.map((m) => (m.id === ENGINE_MATCH_ID ? { ...m, phase: 'final' } : m)),
    } as unknown as Tournament;
    const { result } = renderHook(() => useEngineCommandWiring(t, engineContext, engineLiveMatches));

    await result.current.handleStart(ENGINE_MATCH_ID);

    const copy = await engineContext.store.load(engineContext.accountId, ENGINE_MATCH_ID);
    const startEvent = copy!.pending.find((e) => e.type === 'MATCH_START')!;
    const rules = startEvent.payload.rules as { sectionSeconds: number };
    // 30 Minuten (Finalrunde) / 1 Abschnitt (Default gamePeriods) = 1800s -- NICHT 20*60=1200s
    // (Gruppenphase-Dauer), die hier greifen wuerde, wenn die Phase ignoriert wird.
    expect(rules.sectionSeconds).toBe(1800);
  });

  it('M7: B4-Wache gilt auch fuer handleFinish (nicht nur handleStart)', async () => {
    const engineContext = await makeEngineContext();
    const { result } = renderHook(() => useEngineCommandWiring(tournament(), engineContext, engineLiveMatches));
    await result.current.handleStart(ENGINE_MATCH_ID);

    await result.current.handleFinish(ENGINE_MATCH_ID);
    const copy = await engineContext.store.load(engineContext.accountId, ENGINE_MATCH_ID);
    expect(copy?.pending.some((e) => e.type === 'MATCH_END')).toBe(true);
  });

  it('M11: teamId beim Tor wird klein geschrieben, auch wenn der Aufrufer eine andere Schreibweise uebergibt', async () => {
    const engineContext = await makeEngineContext();
    const { result } = renderHook(() => useEngineCommandWiring(tournament(), engineContext, engineLiveMatches));
    await result.current.handleStart(ENGINE_MATCH_ID);

    await result.current.handleGoal(ENGINE_MATCH_ID, 'TEAMA', 1);

    const copy = await engineContext.store.load(engineContext.accountId, ENGINE_MATCH_ID);
    const goalEvent = copy!.pending.find((e) => e.type === 'GOAL')!;
    expect(goalEvent.teamId).toBe('teama');
  });

  // ---------------------------------------------------------------------------
  // P3 (Fixrunde 3): Anpfiff-Fenster -- ein engine-bestimmtes Spiel, das die Engine noch KEINE
  // Ansicht hat (ensureMatch/Sammelabfrage noch nicht durchgelaufen, z. B. eine liegengebliebene
  // NOT_STARTED-Altzeile), darf beim Anpfiff nicht ohne Engine-Weg starten -- erst
  // `ensureEngineMatchReady`, DANN `commands.start`.
  // ---------------------------------------------------------------------------

  const RACE_MATCH_ID = 'race-1';

  it('P3: Anpfiff auf einem engine-bestimmten Spiel OHNE Engine-Ansicht ruft ensureEngineMatchReady, dann commands.start', async () => {
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
      matches: [...tournament().matches, { id: RACE_MATCH_ID, ...looseVs('teama', 'teamb'), round: 1, field: 3, matchNumber: 3 }],
    };
    const { result } = renderHook(() =>
      useEngineCommandWiring(raceTournament, engineContext, engineLiveMatches, isEngineDestinedMatchId, ensureEngineMatchReady),
    );

    const started = await result.current.handleStart(RACE_MATCH_ID);

    expect(ensureEngineMatchReady).toHaveBeenCalledWith(RACE_MATCH_ID);
    expect(started).toBe(true);
    const copy = await engineContext.store.load(engineContext.accountId, RACE_MATCH_ID);
    expect(copy?.pending.some((e) => e.type === 'MATCH_START')).toBe(true);
  });

  it('P3/Minor 3 (Fixrunde 4): liefert ensureEngineMatchReady fuer den KLAREN B1-Fall keine Ansicht, zeigt handleStart einen Toast statt still false zurueckzugeben ', async () => {
    const engineContext = await makeEngineContext();
    const ensureEngineMatchReady = vi.fn().mockResolvedValue(null);
    const isEngineDestinedMatchId = (matchId: string) => matchId === RACE_MATCH_ID;
    const { result } = renderHook(() =>
      useEngineCommandWiring(tournament(), engineContext, engineLiveMatches, isEngineDestinedMatchId, ensureEngineMatchReady),
    );

    const started = await result.current.handleStart(RACE_MATCH_ID);

    expect(started).toBe(false);
    // A-08e W1: erwartbarer Fall = ruhige Warnung mit Grund, KEIN Fehler-Toast, KEINE Sentry-Meldung
    expect(mockShowWarning).toHaveBeenCalledTimes(1);
    expect(mockShowError).not.toHaveBeenCalled();
    expect(mockCaptureFeatureError).not.toHaveBeenCalled();
  });

  // E3 (Fixrunde 4, Important 2): eine ABLEHNUNG von ensureEngineMatchReady (z. B. E1: die
  // Server-Klaerung ist gescheitert, das Spiel bleibt "unklar") wurde bisher NICHT gefangen --
  // eine unbehandelte Ablehnung ueber ManagementTab.tsx (`void hookHandleStart`).
  it('E3 (Fixrunde 4): eine Ablehnung von ensureEngineMatchReady wird gefangen -- Toast + Sentry (P7-Weg), KEINE unbehandelte Ablehnung, handleStart loest mit false auf', async () => {
    const engineContext = await makeEngineContext();
    const rejectionError = new Error('Engine-Spiel race-1: Server-Klaerung fehlgeschlagen (Netz weg).');
    const ensureEngineMatchReady = vi.fn().mockRejectedValue(rejectionError);
    const isEngineDestinedMatchId = (matchId: string) => matchId === RACE_MATCH_ID;
    const { result } = renderHook(() =>
      useEngineCommandWiring(tournament(), engineContext, engineLiveMatches, isEngineDestinedMatchId, ensureEngineMatchReady),
    );

    // Kein Wurf ueber die Grenze hinweg -- `handleStart` selbst loest auf (mit `false`), NICHT ab.
    await expect(result.current.handleStart(RACE_MATCH_ID)).resolves.toBe(false);

    expect(mockCaptureFeatureError).toHaveBeenCalledWith(rejectionError, 'tournament', 'ensureEngineMatchReady');
    expect(mockShowWarning.mock.calls.length + mockShowError.mock.calls.length).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------------------
  // F3b2 (Gelb-Rot im Cockpit): handleCard mappt den UI-Kartentyp auf den Engine-Befehl ueber
  // `mapCardTypeToEngine` -- nicht mehr ueber den fruehen ternaeren Ausdruck, der 'YELLOW_RED'
  // faelschlich auf 'RED_CARD' abbildete.
  // ---------------------------------------------------------------------------

  it('F3b2: handleCard(..., "YELLOW_RED") schreibt YELLOW_RED_CARD ins Engine-Log (Gegenbeispiel: nicht RED_CARD)', async () => {
    const engineContext = await makeEngineContext();
    const { result } = renderHook(() => useEngineCommandWiring(tournament(), engineContext, engineLiveMatches));
    await result.current.handleStart(ENGINE_MATCH_ID);

    await result.current.handleCard(ENGINE_MATCH_ID, 'teama', 'YELLOW_RED', { playerNumber: 7 });
    const copy = await engineContext.store.load(engineContext.accountId, ENGINE_MATCH_ID);
    const cardEvent = copy!.pending.find((e) => e.type === 'YELLOW_RED_CARD' || e.type === 'RED_CARD');
    expect(cardEvent?.type).toBe('YELLOW_RED_CARD');
  });

  it('F3b2: handleCard(..., "YELLOW") schreibt weiterhin YELLOW_CARD, handleCard(..., "RED") weiterhin RED_CARD', async () => {
    const engineContext = await makeEngineContext();
    const { result } = renderHook(() => useEngineCommandWiring(tournament(), engineContext, engineLiveMatches));
    await result.current.handleStart(ENGINE_MATCH_ID);

    await result.current.handleCard(ENGINE_MATCH_ID, 'teama', 'YELLOW');
    const afterYellow = await engineContext.store.load(engineContext.accountId, ENGINE_MATCH_ID);
    expect(afterYellow!.pending.some((e) => e.type === 'YELLOW_CARD')).toBe(true);

    await result.current.handleCard(ENGINE_MATCH_ID, 'teamb', 'RED');
    const afterRed = await engineContext.store.load(engineContext.accountId, ENGINE_MATCH_ID);
    expect(afterRed!.pending.some((e) => e.type === 'RED_CARD')).toBe(true);
  });

  // A-08d2b (Neuschnitt-Punkt 1): der P2-Fall (`null` = bestaetigtes Altspiel) bekommt keinen Altweg mehr.
  it('A-08d2b: ensureEngineMatchReady liefert null fuer ein engine-bestimmtes Spiel -> Ablehnung, KEIN Anpfiff, kein Altweg', async () => {
    const engineContext = await makeEngineContext();
    const ensureEngineMatchReady = vi.fn().mockResolvedValue(null);
    const isEngineDestinedMatchId = (matchId: string) => matchId === RACE_MATCH_ID;
    const { result } = renderHook(() =>
      useEngineCommandWiring(tournament(), engineContext, engineLiveMatches, isEngineDestinedMatchId, ensureEngineMatchReady),
    );

    const started = await result.current.handleStart(RACE_MATCH_ID);

    expect(started).toBe(false);
    expect(mockShowWarning).toHaveBeenCalledTimes(1);
    expect(mockShowError).not.toHaveBeenCalled();
    expect(mockCaptureFeatureError).not.toHaveBeenCalled();
    const copy = await engineContext.store.load(engineContext.accountId, RACE_MATCH_ID);
    expect(copy?.pending.some((e) => e.type === 'MATCH_START')).not.toBe(true);
  });
});
