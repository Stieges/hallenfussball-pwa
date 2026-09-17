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
 *
 * Fixround (2026-09-17): drei Nachbesserungen.
 * - Critical: Löschen eines Overtime-/Golden-Goal-Tors muss overtimeScoreA/B
 *   korrigieren, nicht homeScore/awayScore (siehe recordGoal-Verzweigung).
 * - Important: die ursprünglichen fünf Tests prüften nie, dass `save`
 *   tatsächlich aufgerufen wird und VOR dem Soft-Delete passiert.
 * - Important: `deleteEvent` läuft jetzt wie `recordGoal` durch
 *   `executeWithRetry` (siehe MatchExecutionService.ts) — hier nicht separat
 *   getestet, weil es sich um denselben, bereits getesteten
 *   SingleFlight-Retry-Mechanismus handelt.
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

    // ------------------------------------------------------------------
    // FIX 1 (Critical): Overtime/Golden-Goal-Tore korrigieren overtimeScoreA/B,
    // nicht homeScore/awayScore. Fixture: 0:0 nach der regulären Spielzeit,
    // zwei Tore in der Verlängerung — genau der Fall, der ohne diesen Fix
    // stillschweigend gar nichts bewirkt (Math.max(0, 0-1) = 0, overtimeScoreA
    // bleibt bei 2).
    // ------------------------------------------------------------------

    it('L9 (Fix 1): löscht ein Verlängerungs-Tor der Heimmannschaft und korrigiert overtimeScoreA, nicht homeScore', async () => {
        liveRepo.get.mockResolvedValue(makeMatch({
            homeScore: 0,
            awayScore: 0,
            playPhase: 'overtime',
            overtimeScoreA: 2,
            overtimeScoreB: 0,
            events: [
                { id: 'e1', matchId: 'm1', type: 'GOAL', timestampSeconds: 610, payload: { team: 'home', delta: 1 }, scoreAfter: { home: 0, away: 0 } },
                { id: 'e2', matchId: 'm1', type: 'GOAL', timestampSeconds: 650, payload: { team: 'home', delta: 1 }, scoreAfter: { home: 0, away: 0 } },
            ],
        }));

        const r = await service.deleteEvent('t1', 'm1', 'e2');

        expect(r.overtimeScoreA).toBe(1);
        expect(r.homeScore).toBe(0);
        expect(r.overtimeScoreB).toBe(0);
        expect(r.awayScore).toBe(0);
    });

    it('L9 (Fix 1): löscht ein Verlängerungs-Tor der Gastmannschaft und korrigiert overtimeScoreB, nicht awayScore', async () => {
        liveRepo.get.mockResolvedValue(makeMatch({
            homeScore: 0,
            awayScore: 0,
            playPhase: 'overtime',
            overtimeScoreA: 0,
            overtimeScoreB: 2,
            events: [
                { id: 'e1', matchId: 'm1', type: 'GOAL', timestampSeconds: 610, payload: { team: 'away', delta: 1 }, scoreAfter: { home: 0, away: 0 } },
                { id: 'e2', matchId: 'm1', type: 'GOAL', timestampSeconds: 650, payload: { team: 'away', delta: 1 }, scoreAfter: { home: 0, away: 0 } },
            ],
        }));

        const r = await service.deleteEvent('t1', 'm1', 'e2');

        expect(r.overtimeScoreB).toBe(1);
        expect(r.awayScore).toBe(0);
        expect(r.overtimeScoreA).toBe(0);
        expect(r.homeScore).toBe(0);
    });

    it('L9 (Fix 1 Regression): bei playPhase "regular" ändert sich weiterhin der reguläre Spielstand', async () => {
        liveRepo.get.mockResolvedValue(makeMatch({
            playPhase: 'regular',
            homeScore: 2,
            awayScore: 1,
        }));

        const r = await service.deleteEvent('t1', 'm1', 'e1');

        expect(r.homeScore).toBe(1);
        expect(r.overtimeScoreA).toBeUndefined();
    });

    it('L9 (Fix 1): goldenGoal verhält sich wie overtime', async () => {
        liveRepo.get.mockResolvedValue(makeMatch({
            homeScore: 0,
            awayScore: 0,
            playPhase: 'goldenGoal',
            overtimeScoreA: 1,
            overtimeScoreB: 0,
            events: [
                { id: 'e1', matchId: 'm1', type: 'GOAL', timestampSeconds: 610, payload: { team: 'home', delta: 1 }, scoreAfter: { home: 0, away: 0 } },
            ],
        }));

        const r = await service.deleteEvent('t1', 'm1', 'e1');

        expect(r.overtimeScoreA).toBe(0);
        expect(r.homeScore).toBe(0);
    });

    it('L9 (Fix 1): flootet den Verlängerungs-Spielstand nicht unter null', async () => {
        liveRepo.get.mockResolvedValue(makeMatch({
            homeScore: 0,
            awayScore: 0,
            playPhase: 'overtime',
            overtimeScoreA: 0,
            overtimeScoreB: 0,
            events: [
                { id: 'e1', matchId: 'm1', type: 'GOAL', timestampSeconds: 610, payload: { team: 'home', delta: 1 }, scoreAfter: { home: 0, away: 0 } },
            ],
        }));

        const r = await service.deleteEvent('t1', 'm1', 'e1');

        expect(r.overtimeScoreA).toBe(0);
    });

    // ------------------------------------------------------------------
    // FIX 2 (Important): Persistenz muss geprüft werden — die fünf Tests
    // oben prüfen nur den Rückgabewert. Ohne diese Assertions bleibt
    // unentdeckt, wenn `save` entfernt wird oder die Reihenfolge
    // save-vor-Soft-Delete umgedreht wird (siehe Revert-Probe im Report).
    // ------------------------------------------------------------------

    it('L9 (Fix 2): ruft save() mit dem korrigierten Spielstand auf', async () => {
        await service.deleteEvent('t1', 'm1', 'e1');
        expect(liveRepo.save).toHaveBeenCalledWith('t1', expect.objectContaining({ homeScore: 1 }));
    });

    it('L9 (Fix 2): ruft save() VOR dem Soft-Delete (deleteEvent) auf', async () => {
        await service.deleteEvent('t1', 'm1', 'e1');
        const saveOrder = liveRepo.save.mock.invocationCallOrder[0];
        const deleteOrder = liveRepo.deleteEvent.mock.invocationCallOrder[0];
        expect(saveOrder).toBeLessThan(deleteOrder);
    });
});
