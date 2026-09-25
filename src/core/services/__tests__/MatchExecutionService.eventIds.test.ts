/**
 * MatchExecutionService — Event-Kennungen sind UUIDs (C-EVID Sofort-Fix)
 *
 * `match_events.id` ist in Postgres eine `uuid`-Spalte. Vor diesem Fix erzeugten alle
 * sechs Stellen, die ein MatchEvent anlegen, eine Text-Kennung
 * (`${matchId}-goal-${Date.now()}-${zufall}` bzw. `${matchId}-${Date.now()}`) — jeder
 * Insert wurde von Postgres mit `22P02 invalid input syntax for type uuid` abgelehnt.
 *
 * Dieser Test deckt JEDE per Suche erhobene Erzeugungsstelle ab (siehe Report):
 * recordGoal, recordCard (YELLOW/RED), recordTimePenalty, recordSubstitution,
 * recordFoul, createStatusEvent (über startMatch/pauseMatch/resumeMatch/persistFinalResult).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MatchExecutionService } from '../MatchExecutionService';
import { ITournamentRepository } from '../../repositories/ITournamentRepository';
import { LiveMatch, MatchStatus } from '../../models/LiveMatch';
import { isUuidFormat } from '../../utils/id';

const mockLiveMatchRepo = {
  get: vi.fn(),
  getAll: vi.fn(),
  save: vi.fn(),
  saveAll: vi.fn(),
  delete: vi.fn(),
  deleteEvent: vi.fn(),
  clear: vi.fn(),
};

const mockTournamentRepo = {
  get: vi.fn(),
  save: vi.fn(),
  updateMatch: vi.fn(),
};

describe('MatchExecutionService — Event-Kennungen sind UUIDs', () => {
  let service: MatchExecutionService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new MatchExecutionService(
      mockLiveMatchRepo,
      mockTournamentRepo as unknown as ITournamentRepository
    );
  });

  const runningMatch: LiveMatch = {
    id: 'match-1',
    number: 1,
    status: 'RUNNING' as MatchStatus,
    phaseLabel: 'Group Stage',
    fieldId: 'field-1',
    scheduledKickoff: '2024-01-01T12:00:00.000Z',
    durationSeconds: 900,
    homeTeam: { id: 'team-a', name: 'Team A' },
    awayTeam: { id: 'team-b', name: 'Team B' },
    homeScore: 0,
    awayScore: 0,
    elapsedSeconds: 0,
    timerStartTime: new Date().toISOString(),
    events: [],
  } as unknown as LiveMatch;

  it('recordGoal erzeugt eine UUID-förmige Kennung', async () => {
    vi.mocked(mockLiveMatchRepo.get).mockResolvedValue(runningMatch);

    const result = await service.recordGoal('tour-1', 'match-1', 'home', 1);

    expect(result.events).toHaveLength(1);
    expect(isUuidFormat(result.events[0].id)).toBe(true);
  });

  it('recordCard (YELLOW) erzeugt eine UUID-förmige Kennung', async () => {
    vi.mocked(mockLiveMatchRepo.get).mockResolvedValue(runningMatch);

    const result = await service.recordCard('tour-1', 'match-1', 'away', 'YELLOW', { playerNumber: 7 });

    expect(result.events).toHaveLength(1);
    expect(isUuidFormat(result.events[0].id)).toBe(true);
  });

  it('recordCard (RED) erzeugt eine UUID-förmige Kennung', async () => {
    vi.mocked(mockLiveMatchRepo.get).mockResolvedValue(runningMatch);

    const result = await service.recordCard('tour-1', 'match-1', 'home', 'RED', { playerNumber: 4 });

    expect(result.events).toHaveLength(1);
    expect(isUuidFormat(result.events[0].id)).toBe(true);
  });

  it('recordTimePenalty erzeugt eine UUID-förmige Kennung', async () => {
    vi.mocked(mockLiveMatchRepo.get).mockResolvedValue(runningMatch);

    const result = await service.recordTimePenalty('tour-1', 'match-1', 'home', { playerNumber: 9 });

    expect(result.events).toHaveLength(1);
    expect(isUuidFormat(result.events[0].id)).toBe(true);
  });

  it('recordSubstitution erzeugt eine UUID-förmige Kennung', async () => {
    vi.mocked(mockLiveMatchRepo.get).mockResolvedValue(runningMatch);

    const result = await service.recordSubstitution('tour-1', 'match-1', 'home', {
      playersIn: [10],
      playersOut: [5],
    });

    expect(result.events).toHaveLength(1);
    expect(isUuidFormat(result.events[0].id)).toBe(true);
  });

  it('recordFoul erzeugt eine UUID-förmige Kennung', async () => {
    vi.mocked(mockLiveMatchRepo.get).mockResolvedValue(runningMatch);

    const result = await service.recordFoul('tour-1', 'match-1', 'away', { playerNumber: 11 });

    expect(result.events).toHaveLength(1);
    expect(isUuidFormat(result.events[0].id)).toBe(true);
  });

  it('createStatusEvent (über startMatch) erzeugt eine UUID-förmige Kennung', async () => {
    const notStarted: LiveMatch = { ...runningMatch, status: 'NOT_STARTED', timerStartTime: undefined };
    vi.mocked(mockLiveMatchRepo.get).mockResolvedValue(notStarted);

    const result = await service.startMatch('tour-1', 'match-1');

    expect(result.events).toHaveLength(1);
    expect(result.events[0].type).toBe('STATUS_CHANGE');
    expect(isUuidFormat(result.events[0].id)).toBe(true);
  });

  it('createStatusEvent (über pauseMatch) erzeugt eine UUID-förmige Kennung', async () => {
    vi.mocked(mockLiveMatchRepo.get).mockResolvedValue(runningMatch);

    const result = await service.pauseMatch('tour-1', 'match-1');

    expect(result.events).toHaveLength(1);
    expect(isUuidFormat(result.events[0].id)).toBe(true);
  });

  it('zwei nacheinander erzeugte Ereignisse haben unterschiedliche Kennungen', async () => {
    vi.mocked(mockLiveMatchRepo.get).mockResolvedValue(runningMatch);

    const first = await service.recordGoal('tour-1', 'match-1', 'home', 1);
    vi.mocked(mockLiveMatchRepo.get).mockResolvedValue(first);
    const second = await service.recordGoal('tour-1', 'match-1', 'away', 1);

    expect(second.events).toHaveLength(2);
    expect(second.events[0].id).not.toBe(second.events[1].id);
  });
});
