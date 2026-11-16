import type { Tournament } from '../../../types/tournament';
import { effectiveRoundCount } from '../../../core/generators/repeatRounds';
import { effectiveHostTeamIds } from '../../../core/models/hostTeams';

/** E2 + Controller-Ruling Fixrunde 2: Struktur = alles, was die Generatoren
 *  außer Metadaten lesen — Teams, Felder, Modus, Gruppen, Finalrunde,
 *  Startzeit und Datum. Übrige Metadaten (Name, Ort, Texte) zählen nicht. */
export function hasStructuralChanges(current: Tournament, next: Tournament): boolean {
  const teamSignature = (t: Tournament): string =>
    [...t.teams]
      .map((team) => `${team.id}:${team.isRemoved ? 1 : 0}`)
      .sort()
      .join('|');
  return (
    teamSignature(current) !== teamSignature(next) ||
    current.numberOfFields !== next.numberOfFields ||
    current.mode !== next.mode ||
    current.tournamentType !== next.tournamentType ||
    current.groupSystem !== next.groupSystem ||
    current.groupPhaseGameDuration !== next.groupPhaseGameDuration ||
    current.groupPhaseBreakDuration !== next.groupPhaseBreakDuration ||
    current.finalRoundGameDuration !== next.finalRoundGameDuration ||
    current.finalRoundBreakDuration !== next.finalRoundBreakDuration ||
    current.breakBetweenPhases !== next.breakBetweenPhases ||
    current.numberOfGroups !== next.numberOfGroups ||
    current.date !== next.date ||
    current.timeSlot !== next.timeSlot ||
    current.startTime !== next.startTime ||
    current.gamePeriods !== next.gamePeriods ||
    current.halftimeBreak !== next.halftimeBreak ||
    current.minRestSlots !== next.minRestSlots ||
    effectiveRoundCount(current) !== effectiveRoundCount(next) || // @TM-152: Rundenzahl legt die Spielzahl fest
    // @W4-049: Markierung und Eröffnung legen den Plan fest, auch im veröffentlichten Turnier
    JSON.stringify(effectiveHostTeamIds(current.hostTeamIds, current.teams)) !== JSON.stringify(effectiveHostTeamIds(next.hostTeamIds, next.teams)) ||
    (current.openingMode ?? '') !== (next.openingMode ?? '') ||
    current.useDFBKeys !== next.useDFBKeys ||
    current.dfbKeyPattern !== next.dfbKeyPattern ||
    JSON.stringify(current.groups) !== JSON.stringify(next.groups) ||
    JSON.stringify(current.finalsConfig) !== JSON.stringify(next.finalsConfig) ||
    JSON.stringify(current.finals) !== JSON.stringify(next.finals) ||
    JSON.stringify(current.refereeConfig) !== JSON.stringify(next.refereeConfig)
  );
}
