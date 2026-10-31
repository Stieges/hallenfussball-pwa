/**
 * Spielzahl und voraussichtliches Ende bei „Jeder gegen jeden“ mit Rundenzahl (@TM-153). Rein, ohne React.
 * Das Ende kommt aus dem tatsächlich erzeugten Spielplan (Fair-Scheduler + weitere Runden), nicht aus einer Formel –
 * bei mehreren Feldern bleiben wegen der Mindestpause Felder frei, die Formel läge dort Stunden daneben.
 * Ohne Teamliste (Assistent vor Schritt „Teams“) wird mit Platzhalter-Teams in der eingestellten Zahl geplant.
 * Rückfall auf die Formel nur, wenn der Plan nicht erzeugbar ist.
 */
import type { Team, Tournament } from '../../../types/tournament';
import { calculateTotalMatchDuration } from '../../../core/generators/scheduleHelpers';
import { generateFullSchedule } from '../../../core/generators';
import { effectiveRoundCount } from '../../../core/generators/repeatRounds';
import { DEFAULT_VALUES } from '../../../constants/tournamentOptions';

export interface RoundCountEstimate {
  matches: number;
  /** Ende als „hh:mm“, null ohne gültigen Beginn. */
  endTime: string | null;
  /** Minuten vom Beginn bis zum Ende des letzten Spiels, null ohne gültigen Beginn. */
  durationMinutes: number | null;
}

const MINUTES_PER_DAY = 24 * 60;

function parseClock(value: string | undefined): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(value?.trim() ?? '');
  if (match === null) { return null; }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
}

const pad = (value: number): string => String(value).padStart(2, '0');

const clockOf = (minutes: number): string => {
  const clock = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${pad(Math.floor(clock / 60))}:${pad(clock % 60)}`;
};

/** Platzhalter-ID im UUID-Format (der Generator verlangt UUIDs), fest je Position. */
const placeholderId = (index: number): string => `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;

function teamsFor(formData: Partial<Tournament>, count: number): Team[] {
  const active = (formData.teams ?? []).filter((team) => team.isRemoved !== true);
  if (active.length === count) { return active; }
  return Array.from({ length: count }, (_, index) => ({ id: placeholderId(index), name: `Team ${String(index + 1)}` }));
}

/** Minuten bis zum Ende des letzten Gruppenspiels im erzeugten Plan; null, wenn nicht erzeugbar. */
function plannedDuration(formData: Partial<Tournament>, teamCount: number, rounds: number, clock: string): number | null {
  try {
    const schedule = generateFullSchedule({
      ...(formData as Tournament),
      teams: teamsFor(formData, teamCount),
      matches: [],
      groupSystem: 'roundRobin',
      numberOfRounds: rounds,
      refereeConfig: undefined,
      date: '2030-01-07',
      timeSlot: clock,
      finals: { final: false, thirdPlace: false, fifthSixth: false, seventhEighth: false },
      finalsConfig: { preset: 'none' },
    });
    const ends = schedule.allMatches.map((match) => match.endTime.getTime());
    if (ends.length === 0) { return null; }
    return Math.round((Math.max(...ends) - schedule.startTime.getTime()) / 60_000);
  } catch {
    return null;
  }
}

/** Formel (volle Felder) – nur Rückfall, wenn der Plan nicht erzeugbar ist. */
function formulaDuration(formData: Partial<Tournament>, perRound: number, rounds: number): number {
  const fields = Math.max(1, formData.numberOfFields ?? 1);
  const game = calculateTotalMatchDuration(
    formData.groupPhaseGameDuration ?? DEFAULT_VALUES.groupPhaseGameDuration,
    formData.gamePeriods ?? DEFAULT_VALUES.gamePeriods,
    formData.halftimeBreak ?? 0,
  );
  const pause = formData.groupPhaseBreakDuration ?? DEFAULT_VALUES.groupPhaseBreakDuration;
  const slots = Math.ceil(perRound / fields) * rounds;
  return (slots - 1) * (game + pause) + game;
}

export function estimateRoundRobinRounds(formData: Partial<Tournament>): RoundCountEstimate {
  const teams = formData.numberOfTeams ?? 0;
  const rounds = effectiveRoundCount({ groupSystem: formData.groupSystem, numberOfRounds: formData.numberOfRounds });
  const perRound = teams > 1 ? (teams * (teams - 1)) / 2 : 0;
  const matches = perRound * rounds;

  const clock = formData.startTime ?? formData.timeSlot;
  const start = parseClock(clock);
  if (start === null || clock === undefined || matches === 0) { return { matches, endTime: null, durationMinutes: null }; }

  const duration = plannedDuration(formData, teams, rounds, clock) ?? formulaDuration(formData, perRound, rounds);
  return { matches, endTime: clockOf(start + duration), durationMinutes: duration };
}
