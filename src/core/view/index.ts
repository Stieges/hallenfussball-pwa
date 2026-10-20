/**
 * Öffentliche API der gemeinsamen Turnier-Ansicht (A-36b, Teilplan A-36 § 2.2).
 */
export type * from './types';
export { buildTournamentView, currentOf } from './tournamentView';
export { viewRules } from './visibility';
export {
  matchBadgeModel,
  badgeDetailFromLiveState,
  badgeDetailFromEngineState,
  engineDetailFromMatches,
  MATCH_BADGE_WORD_KEY,
  type MatchBadgeModel,
  type MatchBadgeState,
  type MatchBadgeInput,
  type MatchBadgeEngineDetail,
} from './badge';
export { spectatorClockOf, spectatorClockForMatch, formatRemaining, type SpectatorClock, type SpectatorClockInput, type SpectatorSectionKey } from './spectatorClock';
export { viewStatus, viewStatusText, isLive, isUpcoming } from './status';
export { sideView } from './sides';
export { placementView, groupPhaseOpen } from './placement';
export { toTournamentLocal, kickoffLocal, minutesBetween, TOURNAMENT_TIME_ZONE } from './time';
export { matchFinalScore, finalGoals, type FinalScore, type FinalDecision } from './finalScore';
export {
  originText,
  describeOrigin,
  slotLabel,
  matchLabelText,
  describeAwaiting,
  awaitingLabel,
  teamDisplayName,
  type SlotKey,
} from './originText';
