/**
 * Rundenname eines Finalrunden-Spiels (A-36c): aus der Ansicht („Halbfinale 1“, „Finale“, @ZM-141, W7);
 * ohne Bezeichnung nach Art des Finalspiels.
 */
import type { ScheduledMatch } from '../../core/generators';
import { matchHeading, type SideContext } from './matchSides';

/** Schlüssel der Rundennamen (`tournament:finals.labels.*`) */
type FinalsLabelKey = `finals.labels.${'final' | 'thirdPlace' | 'fifthSixth' | 'seventhEighth' | 'semifinal' | 'quarterfinal' | 'finalMatch'}`;

export function finalMatchLabel(match: ScheduledMatch, sides: SideContext, t: (key: FinalsLabelKey) => string): string {
  const heading = matchHeading(match, sides);
  if (heading !== undefined) { return heading; }
  if (match.finalType === 'final') { return t('finals.labels.final'); }
  if (match.finalType === 'thirdPlace') { return t('finals.labels.thirdPlace'); }
  if (match.finalType === 'fifthSixth') { return t('finals.labels.fifthSixth'); }
  if (match.finalType === 'seventhEighth') { return t('finals.labels.seventhEighth'); }
  if (match.phase === 'semifinal') { return t('finals.labels.semifinal'); }
  if (match.phase === 'quarterfinal') { return t('finals.labels.quarterfinal'); }
  return t('finals.labels.finalMatch');
}
