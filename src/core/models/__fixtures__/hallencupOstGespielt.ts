/**
 * Fixture „Hallencup Ost“ für Kopie-Tests (@W5-024 bis @W5-027): veröffentlicht, mit Freigabe-Code,
 * Spiele beendet, Turnier abgeschlossen, Monitore hinterlegt. Bewusst alle Ergebnis- und Abschlussfelder gesetzt.
 */
import type { Match, Team, Tournament } from '../../../types/tournament';
import type { TournamentMonitor } from '../../../types/monitor';
import { teamSlot, pendingSlot } from '../matchSlot';
import { testUuid } from '../../../test/testIds';

export const OST_ID = testUuid(1);
export const OST_CODE = 'K9X2M4';
export const OST_TEAM_A = testUuid(11);
export const OST_TEAM_B = testUuid(12);
export const OST_M_GRUPPE = testUuid(21);
export const OST_M_FINALE = testUuid(22);

const teams = [
  { id: OST_TEAM_A, name: 'FC Nord', group: 'A' },
  { id: OST_TEAM_B, name: 'VfB Ufer', group: 'A' },
] as Team[];

const matches = [
  {
    id: OST_M_GRUPPE, round: 1, field: 1, group: 'A', slotA: teamSlot(OST_TEAM_A), slotB: teamSlot(OST_TEAM_B),
    scoreA: 3, scoreB: 1, matchStatus: 'finished', finishedAt: '2026-11-26T10:12:00.000Z',
    events: [{ id: 'e1', type: 'GOAL' }, { id: 'e2', type: 'YELLOW_CARD' }],
    correctionHistory: [{ at: '2026-11-26T10:20:00.000Z' }],
    timerStartTime: '2026-11-26T10:00:00.000Z', timerPausedAt: '2026-11-26T10:05:00.000Z', timerElapsedSeconds: 300,
    overtimeScoreA: 1, overtimeScoreB: 1, penaltyScoreA: 4, penaltyScoreB: 3, decidedBy: 'penalty',
    skippedReason: 'Team zurückgezogen', skippedAt: '2026-11-26T09:00:00.000Z',
    liveState: { phase: 'ended' },
    kit: { a: 'red', b: 'blue' },
  },
  {
    id: OST_M_FINALE, round: 2, field: 1, isFinal: true, finalType: 'final',
    slotA: pendingSlot({ kind: 'matchResult', matchId: OST_M_GRUPPE, role: 'winner' }),
    slotB: pendingSlot({ kind: 'matchResult', matchId: OST_M_GRUPPE, role: 'loser' }),
    scoreA: 2, scoreB: 0, matchStatus: 'finished', finishedAt: '2026-11-26T11:00:00.000Z', decidedBy: 'regular',
  },
] as unknown as Match[];

const monitors = [
  { id: 'mon-1', name: 'Haupthalle', slides: [], createdAt: '2026-11-01', updatedAt: '2026-11-01' },
] as unknown as TournamentMonitor[];

/** Frisches Objekt je Aufruf, damit Tests das Original nicht gegenseitig verändern. */
export function hallencupOstGespielt(): Tournament {
  return structuredClone({
    id: OST_ID, title: 'Hallencup Ost', status: 'published',
    createdAt: '2026-10-01T08:00:00.000Z', updatedAt: '2026-11-26T12:00:00.000Z',
    publishedAt: '2026-10-02T08:00:00.000Z', isPublic: true, shareCode: OST_CODE, shareCodeCreatedAt: '2026-10-02T08:00:00.000Z',
    version: 17, changeRevision: 9, ownerId: 'olli',
    manuallyCompleted: true, completedAt: '2026-11-26T12:00:00.000Z',
    statsSnapshot: { frozen: true }, dashboardStatus: 'finished',
    startDate: '2099-11-26', startTime: '09:00', date: '2099-11-26', timeSlot: '09:00',
    numberOfFields: 1, numberOfGroups: 1,
    groups: [{ id: 'A', customName: 'Löwen' }], fields: [{ id: 'field-1', defaultName: 'Feld 1' }],
    pointSystem: { win: 3, draw: 1, loss: 0 },
    matchCockpitSettings: { timerDirection: 'countdown' },
    refereeConfig: { mode: 'organizer', manualAssignments: { [OST_M_GRUPPE]: 2 } },
    fieldAssignments: { [OST_M_GRUPPE]: 1 },
    sponsors: [{ id: 'sp-1', name: 'Autohaus' }],
    monitors, teams, matches,
    lastVisitedStep: 5,
  } as unknown as Tournament);
}
