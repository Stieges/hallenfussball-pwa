/**
 * Auswahl des Gruppenspielplans: Plan ohne Rundenplan-Vorschlag (Gier-Varianten, @W4-023/@W4-024) gegen den
 * Runden-Spielplan als zusätzlichen Kandidaten (1 Feld, jede Gruppe ab 5 Teams, kein DFB-Schlüssel), danach die
 * Eröffnung durch die Mannschaft des Veranstalters und die Meldungen (@W4-027 … @W4-043).
 */
import { DEFAULT_OPENING_MODE, type Match } from '../../types/tournament';
import type { GroupPhaseScheduleOptions } from './fairScheduler';
import { dfbShortfallNotices, measurePlanQuality } from './planQuality';
import {
  dfbMinGamesBetween,
  isRoundsPlanEligible,
  planRounds,
  roundsPlanToMatches,
  ROUNDS_NODE_BUDGET,
  type RoundsPlan,
} from './roundRobinRounds';
import { applyHostOpening } from './scheduleOpening';
import type { ScheduleNotice } from './scheduleTypes';
import { prefersRoundsPlan } from './scheduleVariants';

export interface GroupPhaseScheduleResult {
  matches: Match[];
  notices: ScheduleNotice[];
  /** Der gewählte Plan ist der Runden-Spielplan. */
  roundsPlan: boolean;
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

/**
 * @param greedySchedule liefert den Plan ohne Rundenplan-Vorschlag (darf werfen, z. B. IncompleteScheduleError).
 * @param greedyOpenedBy derselbe Plan, aber mit einem Spiel der genannten Gruppe zuerst (Eröffnung, null = keiner).
 */
export function planGroupPhase(
  options: GroupPhaseScheduleOptions,
  greedySchedule: () => Match[],
  greedyOpenedBy?: (groupId: string) => Match[] | null,
): GroupPhaseScheduleResult {
  const groups = [...options.groups].map(([groupId, teams]) => ({ groupId, teamIds: teams.map((team) => team.id) }));
  const sizes = groups.map((group) => group.teamIds.length);

  let greedy: Match[] | null = null;
  let greedyError: Error | null = null;
  try {
    greedy = greedySchedule();
  } catch (error) {
    greedyError = asError(error);
  }

  let chosen = greedy;
  let rounds: RoundsPlan | null = null;
  if (isRoundsPlanEligible(sizes, options.numberOfFields, options.dfbPatternCode)) {
    const plan = planRounds(groups, options.minRestSlotsPerTeam, options.roundsNodeBudget ?? ROUNDS_NODE_BUDGET);
    if (plan) {
      const candidate = roundsPlanToMatches(plan, options);
      if (!greedy || prefersRoundsPlan(measurePlanQuality(candidate), measurePlanQuality(greedy), plan.dfbTarget)) {
        chosen = candidate;
        rounds = plan;
      }
    }
  }
  if (!chosen) { throw greedyError ?? new Error('Kein Gruppenspielplan'); }

  const opening = applyHostOpening({
    matches: chosen,
    groups: options.groups,
    hostTeamIds: options.hostTeamIds ?? [],
    openingMode: options.openingMode ?? DEFAULT_OPENING_MODE,
    roundPositionBySlot: rounds ? rounds.matches.map((entry) => entry.roundPosition) : undefined,
    minRestSlots: options.minRestSlotsPerTeam,
    slotDurationMinutes: options.slotDurationMinutes,
    breakBetweenSlotsMinutes: options.breakBetweenSlotsMinutes,
    replanOpenedBy: rounds || !greedyOpenedBy ? undefined : greedyOpenedBy,
    dfbTarget: rounds?.dfbTarget ?? null,
  });
  const notices = [...opening.notices];
  const dfbTarget = options.numberOfFields === 1 && !options.dfbPatternCode ? dfbMinGamesBetween(sizes) : null;
  if (dfbTarget !== null) { notices.push(...dfbShortfallNotices(opening.matches, dfbTarget)); }
  return { matches: opening.matches, notices, roundsPlan: rounds !== null };
}
