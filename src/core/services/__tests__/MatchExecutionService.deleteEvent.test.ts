/**
 * MatchExecutionService.deleteEvent (L9)
 *
 * Ereignis-Löschung persistieren: das Event verschwindet aus dem Array,
 * der Score wird bei GOAL korrigiert, und das Repository wird angewiesen,
 * das Event dauerhaft (soft-delete) zu markieren.
 *
 * Hinweis zur Fixture: `MatchEvent.payload` verwendet `team: 'home' | 'away'`
 * und `delta`, NICHT `teamId` (core/models/LiveMatch.ts) — abweichend vom
 * Brief-Sketch, der `payload: { teamId }` verwendete. `recordGoal` (Zeile ~191)
 * und `undoLastEvent` (Zeile ~589) bestätigen das reale Format.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MatchExecutionService } from '../MatchExecutionService';
import type { LiveMatch } from '../../models/LiveMatch';

function makeMatch(overrides: Partial<LiveMatch> = {}): LiveMatch {
    return {
        id: 'm1',
        number: 1,
        phaseLabel: 'Gruppenphase',
        fieldId: 'field-1',
        scheduledKickoff: '2024-01-01T12:00:00.000Z',
        version: 1,
        homeTeam: { id: 'a', name: 'A' },
        awayTeam: { id: 'b', name: 'B' },
        homeScore: 2,
        awayScore: 1,
        status: 'RUNNING',
        elapsedSeconds: 100,
        durationSeconds: 600,
        tournamentPhase: 'groupStage',
        events: [
            { id: 'e1', matchId: 'm1', type: 'GOAL', timestampSeconds: 30, payload: { team: 'home', delta: 1 }, scoreAfter: { home: 1, away: 0 } },
            { id: 'e2', matchId: 'm1', type: 'YELLOW_CARD', timestampSeconds: 60, payload: { team: 'away' }, scoreAfter: { home: 1, away: 0 } },
        ],
        ...overrides,
    } as unknown as LiveMatch;
}

describe('MatchExecutionService.deleteEvent (L9)', () => {
    let liveRepo: Record<string, ReturnType<typeof vi.fn>>;
    let service: MatchExecutionService;

    beforeEach(() => {
        liveRepo = {
            get: vi.fn().mockResolvedValue(makeMatch()),
            save: vi.fn().mockResolvedValue(undefined),
            deleteEvent: vi.fn().mockResolvedValue(undefined),
        };
        // Konstruktor-Signatur ist (liveMatchRepo, tournamentRepo) — MatchExecutionService.ts:47f.
        // Der Brief-Sketch hatte die Reihenfolge vertauscht.
        service = new MatchExecutionService(liveRepo as never, { updateMatch: vi.fn(), get: vi.fn() } as never);
    });

    it('L9: entfernt das Event aus dem Array und markiert es im Repository als gelöscht', async () => {
        const r = await service.deleteEvent('t1', 'm1', 'e2');
        expect(r.events.map(e => e.id)).toEqual(['e1']);
        expect(liveRepo.deleteEvent).toHaveBeenCalledWith('t1', 'm1', 'e2');
    });

    it('L9: korrigiert bei einem GOAL den Spielstand der Heimmannschaft', async () => {
        const r = await service.deleteEvent('t1', 'm1', 'e1');
        expect(r.homeScore).toBe(1);
        expect(r.awayScore).toBe(1);
    });

    it('L9: lässt den Spielstand bei einer Karte unangetastet', async () => {
        const r = await service.deleteEvent('t1', 'm1', 'e2');
        expect(r.homeScore).toBe(2);
        expect(r.awayScore).toBe(1);
    });

    it('L9: geht bei unbekannter Event-ID wirkungslos durch', async () => {
        const r = await service.deleteEvent('t1', 'm1', 'gibtsnicht');
        expect(r.events).toHaveLength(2);
        expect(liveRepo.deleteEvent).not.toHaveBeenCalled();
        expect(liveRepo.save).not.toHaveBeenCalled();
    });

    it('L9: unterschreitet den Spielstand nicht unter null', async () => {
        liveRepo.get.mockResolvedValue(makeMatch({ homeScore: 0 }));
        const r = await service.deleteEvent('t1', 'm1', 'e1');
        expect(r.homeScore).toBe(0);
    });
});
