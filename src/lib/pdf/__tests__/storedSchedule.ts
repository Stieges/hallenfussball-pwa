/**
 * Testhilfe (A-12a): Spielplan eines GESPEICHERTEN Turniers mit 3 und mehr Gruppen (Top 8, Top 16).
 *
 * Seit A-12a erzeugt der Generator beim Anlegen eine Finalrunde nur für 1 und 2 Gruppen (Plan GA4 v2, Daniel E6);
 * größere Turniere liegen nur noch als gespeicherte Daten vor (Altbestand bzw. nach dem MVP). Gedruckt werden sie über
 * den Lesepfad von `generateFullSchedule` (vorhandene Spiele). Diese Hilfe baut solche Spiele wie früher: Gruppenspiele
 * aus dem Generator, Finalrunde aus den Bausteinen der Vorlage (`generatePlayoffDefinitions` → `generatePlayoffSchedule`
 * mit den echten Gruppen) – ohne die Sperre des Anlegens. Reine Testdaten.
 */
import { generateFullSchedule, generatePlayoffDefinitions, generatePlayoffSchedule, type GeneratedSchedule } from '../../../core/generators';
import type { Match, Tournament } from '../../../types/tournament';
import { getGroupLabel, getUniqueGroups } from '../../../utils/groupHelpers';

/** Spiele eines gespeicherten Turniers (Gruppenphase + Finalrunde), so wie sie aus der Cloud kommen. */
export function storedMatches(tournament: Tournament): Match[] {
  const groupStage = generateFullSchedule({ ...tournament, matches: [], finalsConfig: { preset: 'none' } }).allMatches;
  const groupMatches: Match[] = groupStage.map((m, index) => ({
    id: m.id, round: index + 1, field: m.field, slot: m.slot, slotA: m.slotA, slotB: m.slotB, group: m.group,
    isFinal: false, phase: 'groupStage', matchNumber: m.matchNumber, scheduledTime: m.startTime,
    ...(m.referee === undefined ? {} : { referee: m.referee }),
  }));
  const groupIds = getUniqueGroups(tournament.teams);
  const sizes = Object.fromEntries(groupIds.map((id, i) => [getGroupLabel(i), tournament.teams.filter((t) => t.group === id).length]));
  const lastSlot = Math.max(...groupMatches.map((m) => m.slot ?? 0));
  const slotMinutes = tournament.groupPhaseGameDuration + (tournament.groupPhaseBreakDuration ?? 0);
  const last = groupStage[groupStage.length - 1];
  const finals = generatePlayoffSchedule({
    playoffDefinitions: generatePlayoffDefinitions(groupIds.length, tournament.finalsConfig ?? { preset: 'none' }, sizes),
    numberOfFields: tournament.numberOfFields,
    slotDurationMinutes: tournament.finalRoundGameDuration ?? tournament.groupPhaseGameDuration,
    breakBetweenSlotsMinutes: tournament.finalRoundBreakDuration ?? tournament.groupPhaseBreakDuration ?? 0,
    minRestSlotsPerTeam: 1,
    startSlot: 0,
    startTime: new Date(last.endTime.getTime() + (tournament.breakBetweenPhases ?? slotMinutes) * 60000),
    groupIds,
  }).map((m, index) => ({ ...m, slot: lastSlot + 2 + (m.slot ?? 0), round: groupMatches.length + index + 1 }));
  return [...groupMatches, ...finals];
}

/** Spielplan über den Lesepfad (vorhandene Spiele) – wie Public View, Export und Turnier-Manager ihn bauen. */
export function storedSchedule(tournament: Tournament, locale: 'de' | 'en' = 'de'): GeneratedSchedule {
  return generateFullSchedule({ ...tournament, matches: storedMatches(tournament) }, locale);
}
