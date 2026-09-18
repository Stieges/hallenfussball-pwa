/**
 * MatchExecutionService.recordGoal — Overtime-Floor (M2-Cockpit-Abschluss, 2026-09-17)
 *
 * Der reguläre Zweig von `recordGoal` flootet den Spielstand seit jeher mit
 * `Math.max(0, ...)`. Der Overtime-/Golden-Goal-Zweig tat das nicht: ein
 * `-1`-Klick, während `overtimeScoreA`/`overtimeScoreB` bereits 0 sind,
 * schrieb den Wert auf -1. In Kombination mit dem separaten UI-Bug in
 * LiveCockpit.tsx (Minus-Button-Guard prüfte die reguläre statt der
 * Verlängerungs-Anzeige) war der Button dabei aktiv, obwohl kein
 * Verlängerungstor zum Zurücknehmen vorhanden war — ein Fehlklick genügte,
 * um den effektiven Spielstand (homeScore + overtimeScoreA) unter das reale
 * Ergebnis fallen zu lassen.
 *
 * Fixture-Konventionen wie in MatchExecutionService.deleteEvent.test.ts:
 * `MatchEvent.payload` verwendet `team`/`delta`, nicht `teamId`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MatchExecutionService } from '../MatchExecutionService';
import type { LiveMatch } from '../../models/LiveMatch';

function makeMatch(overrides: Partial<LiveMatch> = {}): LiveMatch {
    return {
        id: 'm1',
        number: 1,
        phaseLabel: 'Finale',
        fieldId: 'field-1',
        scheduledKickoff: '2024-01-01T12:00:00.000Z',
        version: 1,
        homeTeam: { id: 'a', name: 'A' },
        awayTeam: { id: 'b', name: 'B' },
        homeScore: 1,
        awayScore: 1,
        status: 'RUNNING',
        elapsedSeconds: 650,
        durationSeconds: 600,
        tournamentPhase: 'final',
        events: [],
        ...overrides,
    } as unknown as LiveMatch;
}

describe('MatchExecutionService.recordGoal — Overtime-Floor', () => {
    let liveRepo: Record<string, ReturnType<typeof vi.fn>>;
    let service: MatchExecutionService;

    beforeEach(() => {
        liveRepo = {
            get: vi.fn(),
            save: vi.fn().mockResolvedValue(undefined),
        };
        service = new MatchExecutionService(liveRepo as never, { updateMatch: vi.fn(), get: vi.fn() } as never);
    });

    it('flootet overtimeScoreA nicht unter null (Heim, -1 bei bereits 0)', async () => {
        liveRepo.get.mockResolvedValue(makeMatch({
            playPhase: 'overtime',
            overtimeScoreA: 0,
            overtimeScoreB: 0,
        }));

        const r = await service.recordGoal('t1', 'm1', 'home', -1);

        expect(r.overtimeScoreA).toBe(0);
    });

    it('flootet overtimeScoreB nicht unter null (Gast, -1 bei bereits 0)', async () => {
        liveRepo.get.mockResolvedValue(makeMatch({
            playPhase: 'overtime',
            overtimeScoreA: 0,
            overtimeScoreB: 0,
        }));

        const r = await service.recordGoal('t1', 'm1', 'away', -1);

        expect(r.overtimeScoreB).toBe(0);
    });

    it('Regression: ein normales +1 in der Verlängerung erhöht weiterhin overtimeScoreA und lässt homeScore unangetastet', async () => {
        liveRepo.get.mockResolvedValue(makeMatch({
            playPhase: 'overtime',
            overtimeScoreA: 0,
            overtimeScoreB: 0,
        }));

        const r = await service.recordGoal('t1', 'm1', 'home', 1);

        expect(r.overtimeScoreA).toBe(1);
        expect(r.homeScore).toBe(1);
    });
});
