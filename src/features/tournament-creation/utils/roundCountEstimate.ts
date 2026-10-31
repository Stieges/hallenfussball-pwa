/**
 * Spielzahl und voraussichtliches Ende bei mehreren Runden „Jeder gegen jeden“ (@TM-153). Rein, ohne React.
 * Ende wie im Spielplan: letztes Spiel = Beginn + (Zeitfenster − 1) · (Spiel + Pause) + Spiel.
 */
import type { Tournament } from '../../../types/tournament';
import { calculateTotalMatchDuration } from '../../../core/generators/scheduleHelpers';
import { effectiveRoundCount } from '../../../core/generators/repeatRounds';
import { DEFAULT_VALUES } from '../../../constants/tournamentOptions';

/** Ab dieser Uhrzeit (Minuten nach Mitternacht) am Turniertag gilt das Ende als „gegen Mitternacht“. */
export const LATE_END_FROM_MINUTES = 22 * 60;

export interface RoundCountEstimate {
  matches: number;
  /** Ende als „hh:mm“, null ohne gültigen Beginn. */
  endTime: string | null;
  /** Das Turnier endet gegen Mitternacht oder später (Hinweis, kein Sperren). */
  endsLate: boolean;
}

function parseClock(value: string | undefined): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(value?.trim() ?? '');
  if (match === null) { return null; }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
}

const pad = (value: number): string => String(value).padStart(2, '0');

export function estimateRoundRobinRounds(formData: Partial<Tournament>): RoundCountEstimate {
  const teams = formData.numberOfTeams ?? 0;
  const fields = Math.max(1, formData.numberOfFields ?? 1);
  const rounds = effectiveRoundCount({ groupSystem: formData.groupSystem ?? 'roundRobin', numberOfRounds: formData.numberOfRounds });
  const perRound = teams > 1 ? (teams * (teams - 1)) / 2 : 0;
  const matches = perRound * rounds;

  const start = parseClock(formData.startTime ?? formData.timeSlot);
  if (start === null || matches === 0) { return { matches, endTime: null, endsLate: false }; }

  const game = calculateTotalMatchDuration(
    formData.groupPhaseGameDuration ?? DEFAULT_VALUES.groupPhaseGameDuration,
    formData.gamePeriods ?? DEFAULT_VALUES.gamePeriods,
    formData.halftimeBreak ?? 0,
  );
  const pause = formData.groupPhaseBreakDuration ?? DEFAULT_VALUES.groupPhaseBreakDuration;
  const slots = Math.ceil(perRound / fields) * rounds;
  const end = start + (slots - 1) * (game + pause) + game;
  const clock = end % (24 * 60);
  return {
    matches,
    endTime: `${pad(Math.floor(clock / 60))}:${pad(clock % 60)}`,
    endsLate: end >= LATE_END_FROM_MINUTES,
  };
}
