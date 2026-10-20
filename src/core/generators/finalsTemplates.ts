/**
 * A-12a – Vorlagen der Finalrunde als Herkunfts-Plan (Record Turniermodi: @TM-002 Zeile 2×4, @TM-004, @TM-005, @TM-142).
 *
 * `buildFinalsTemplate(groupCount, teamsPerGroup, config)` ist der strenge Eingang des Spielplan-Generators: er prüft die
 * Einstellung und liefert die Spiele der Finalrunde mit Herkunft je Seite, Runde (`phase`) und Art (`finalType`). Die
 * Seiten nennen die Gruppe über ihren Platz in der Vorlage („group-a-1st“ = Erster der ersten Gruppe); die echten
 * Gruppen setzt `generatePlayoffSchedule` über `groupIds` ein (C-GENERATOR-HERKUNFT-GRUPPENNAMEN).
 *
 * Sichtbare Fehler statt stiller Annahmen (`FinalsTemplateError`):
 *  - fehlende oder unpassende Gruppenzahl (C-GENERATOR-GRUPPENZAHL-DEFAULT, früher still `?? 2`),
 *  - ab 3 Gruppen (Plan GA4 v2, Daniel E6 15.10.: MVP = 1 und 2 Gruppen). Der Text kündigt nichts an (@OB-003), er
 *    nennt, was geht,
 *  - Platzierungsspiele, die es nicht gibt (nur 3, 5, 7), ohne Halbfinale, Platz 5/7 ohne zweite Gruppe oder mit zu
 *    kleinen Gruppen.
 * `generatePlayoffMatches` selbst bleibt nachsichtig: der Assistent zählt damit Spiele auch für 3 und mehr Gruppen.
 *
 * `assertValidFinalsPlan` prüft die fertig geplante Finalrunde mit `validateFinalsPlan` (A-12b). Beides gilt nur beim
 * Erzeugen bzw. Anlegen; Lesepfade fangen den Fehler ab (siehe `generateFullSchedule`).
 */
import type { FinalsConfig } from '../../types/tournament';
import type { GroupSizeInfo } from './playoffGenerator';
import { generatePlayoffDefinitions, type PlayoffMatchDefinition } from './playoffScheduler';
import { formatFinalsPlanError, validateFinalsPlan, type FinalsPlanError, type FinalsPlanGroup, type FinalsPlanMatch } from './validateFinalsPlan';
import { getGroupLabel } from '../../utils/groupHelpers';

export type FinalsTemplateErrorCode =
  | 'GROUP_COUNT_MISSING'
  | 'GROUP_COUNT_MISMATCH'
  | 'GROUPS_NOT_SUPPORTED'
  | 'PLACEMENT_UNKNOWN'
  | 'PLACEMENT_NEEDS_SEMIFINALS'
  | 'PLACEMENT_NEEDS_TWO_GROUPS'
  | 'PLACEMENT_GROUP_TOO_SMALL'
  | 'GROUP_TOO_SMALL';

/** Die Einstellung der Finalrunde lässt sich so nicht erzeugen; `message` ist für Menschen (Stelle und Grund). */
export class FinalsTemplateError extends Error {
  readonly code: FinalsTemplateErrorCode;

  constructor(code: FinalsTemplateErrorCode, message: string) {
    super(message);
    this.name = 'FinalsTemplateError';
    this.code = code;
  }
}

/** Die fertig geplante Finalrunde hat eine fehlerhafte Herkunft (`validateFinalsPlan`, @TM-013/@TM-002). */
export class FinalsPlanInvalidError extends Error {
  readonly errors: readonly FinalsPlanError[];

  constructor(errors: readonly FinalsPlanError[]) {
    super(`Finalrunde fehlerhaft: ${errors.map(formatFinalsPlanError).join('; ')}`);
    this.name = 'FinalsPlanInvalidError';
    this.errors = errors;
  }
}

/** Plätze, die als Platzierungsspiel wählbar sind (@TM-004). */
export const SELECTABLE_PLACEMENTS: readonly number[] = [3, 5, 7];

/** Höchste Gruppenzahl, für die es heute eine Vorlage gibt (MVP: 1 und 2 Gruppen). */
const MAX_TEMPLATE_GROUPS = 2;

/** Teams je Gruppe, die ein Spiel um Platz 5 bzw. 7 braucht (Dritte bzw. Vierte beider Gruppen). */
const MIN_TEAMS_FOR_PLACE: Readonly<Record<number, number>> = { 5: 3, 7: 4 };

function checkGroupCount(groupCount: number | undefined, teamsPerGroup: readonly number[]): number {
  if (groupCount === undefined) {
    throw new FinalsTemplateError('GROUP_COUNT_MISSING', 'Die Gruppenzahl fehlt – die Finalrunde lässt sich nicht erzeugen.');
  }
  if (groupCount !== teamsPerGroup.length) {
    throw new FinalsTemplateError(
      'GROUP_COUNT_MISMATCH',
      `Die Gruppenzahl (${groupCount}) passt nicht zu den Gruppen der Teams (${teamsPerGroup.length}).`,
    );
  }
  if (groupCount > MAX_TEMPLATE_GROUPS) {
    throw new FinalsTemplateError(
      'GROUPS_NOT_SUPPORTED',
      `Eine Finalrunde gibt es nur für 1 oder 2 Gruppen (eingestellt: ${groupCount}).`,
    );
  }
  return groupCount;
}

function checkPlacements(config: FinalsConfig, groupCount: number, teamsPerGroup: readonly number[]): void {
  const placements = config.placements;
  if (placements === undefined || placements.length === 0) {
    return;
  }
  const unknown = placements.find((place) => !SELECTABLE_PLACEMENTS.includes(place));
  if (unknown !== undefined) {
    throw new FinalsTemplateError('PLACEMENT_UNKNOWN', `Ein Spiel um Platz ${unknown} gibt es nicht (wählbar: 3, 5, 7).`);
  }
  if (config.preset === 'final-only') {
    throw new FinalsTemplateError('PLACEMENT_NEEDS_SEMIFINALS', 'Spiele um Platz 3, 5 oder 7 brauchen ein Halbfinale.');
  }
  const smallest = Math.min(...teamsPerGroup);
  for (const place of [7, 5]) {
    if (!placements.includes(place)) { continue; }
    if (groupCount !== 2) {
      throw new FinalsTemplateError('PLACEMENT_NEEDS_TWO_GROUPS', `Ein Spiel um Platz ${place} gibt es nur bei 2 Gruppen.`);
    }
    if (smallest < MIN_TEAMS_FOR_PLACE[place]) {
      throw new FinalsTemplateError(
        'PLACEMENT_GROUP_TOO_SMALL',
        `Spiel um Platz ${place}: jede Gruppe braucht mindestens ${MIN_TEAMS_FOR_PLACE[place]} Teams (kleinste Gruppe: ${smallest}).`,
      );
    }
  }
}

/**
 * Herkunfts-Plan der Finalrunde für `groupCount` Gruppen mit `teamsPerGroup` Teams (Reihenfolge der Gruppen = Vorlage:
 * erste Gruppe = „a“). `config.placements` wählt die Platzierungsspiele; fehlt es, belegt die Vorlage vor.
 */
export function buildFinalsTemplate(
  groupCount: number | undefined,
  teamsPerGroup: readonly number[],
  config: FinalsConfig,
): PlayoffMatchDefinition[] {
  if (config.preset === 'none') {
    return [];
  }
  const groups = checkGroupCount(groupCount, teamsPerGroup);
  checkPlacements(config, groups, teamsPerGroup);
  // @TM-142: „Top 4“ mit einer Gruppe braucht vier Teams (C-TOP4-ZU-WENIG-TEAMS)
  if (groups === 1 && config.preset === 'top-4' && teamsPerGroup[0] < 4) {
    throw new FinalsTemplateError('GROUP_TOO_SMALL', `Top 4 mit einer Gruppe braucht mindestens 4 Teams (die Gruppe hat ${teamsPerGroup[0]}).`);
  }
  const sizes: GroupSizeInfo = Object.fromEntries(teamsPerGroup.map((size, index) => [getGroupLabel(index), size]));
  return generatePlayoffDefinitions(groups, config, sizes);
}

/** Fehler einer nicht erzeugbaren Finalrunde (Einstellung oder Herkunft) – nur diese fängt der Lesepfad ab. */
export function isFinalsPlanError(error: unknown): error is FinalsTemplateError | FinalsPlanInvalidError {
  return error instanceof FinalsTemplateError || error instanceof FinalsPlanInvalidError;
}

/** Prüft die geplante Finalrunde (A-12b `validateFinalsPlan`); wirft `FinalsPlanInvalidError` mit allen Stellen. */
export function assertValidFinalsPlan(matches: readonly FinalsPlanMatch[], groups: readonly FinalsPlanGroup[]): void {
  const result = validateFinalsPlan(matches, groups);
  if (!result.ok) {
    throw new FinalsPlanInvalidError(result.errors);
  }
}
