/**
 * Öffentliche API der gemeinsamen Turnier-Ansicht (A-36b, Teilplan A-36 § 2.2).
 */
export type * from './types';
export { buildTournamentView, currentOf, matchBoxes } from './tournamentView';
export { viewRules } from './visibility';
export {
  matchBadgeModel,
  badgeDetailFromLiveState,
  badgeDetailFromEngineState,
  engineDetailFromMatches,
  liveStateAnchorKey,
  MATCH_BADGE_WORD_KEY,
  type MatchBadgeModel,
  type MatchBadgeState,
  type MatchBadgeInput,
  type MatchBadgeEngineDetail,
} from './badge';
export { monitorUhrOf, monitorUhrMitSperre, type MonitorUhrModell, type MonitorUhrEingabe, type MonitorUhrText } from './monitorUhr';
export { zeitBalkenLaufend, zeitBalkenPause, BALKEN_TON_SCHLUSSPHASE, type ZeitBalkenModell, type ZeitBalkenTon } from './zeitBalken';
export { spectatorClockOf, spectatorClockForMatch, formatRemaining, type SpectatorClock, type SpectatorClockInput, type SpectatorSectionKey } from './spectatorClock';
export { viewStatus, viewStatusText, isLive, isUpcoming, isMatchInProgress } from './status';
export { sideView } from './sides';
export { placementView, groupPhaseOpen } from './placement';
export { localDateIso, toTournamentLocal, kickoffLocal, kickoffInstant, originalKickoffLocal, ORIGINAL_KICKOFF_MIN_DEVIATION_MINUTES, minutesBetween, clockKey, TOURNAMENT_TIME_ZONE } from './time';
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
export { effectiveGroupCount, effectiveFields, effectiveFieldCount, type EffectiveField, type TournamentFactsInput } from './tournamentFacts';

export { AGE_GROUPS, parseAgeClass, composeAgeClass, ageClassText, joinMeta, AGE_LEVELS, type AgeGroup, type AgeGroupId, type AgeLevel, type ParsedAgeClass } from './ageClass';
