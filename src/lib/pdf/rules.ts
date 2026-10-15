/**
 * Regelzeilen des Spielplan-PDFs (B-28a3-3a, @DR-006, @DR-007, @DR-008, @DR-015, @DR-020).
 *
 * Rein: keine Zeichnung, keine React-Abhängigkeit, kein Import aus `features/`. Die Regeln kommen aus dem
 * Turnier (`pdfRulesFrom`), die Wörter aus `t.rules` (`tournament:pdf.rules.*`).
 */
import {
  DEFAULT_MATCH_COCKPIT_SETTINGS,
  type PointSystem,
  type TiebreakerMode,
  type Tournament,
} from '../../types/tournament';
import { knockoutRoundsForPreset, presetHasPlacementGames, resolveTiebreakMode } from '../../core/match/tiebreakDecision';
import { footballIndoorConfig } from '../../config/sports/football';
import { SECONDS_PER_MINUTE } from '../../utils/timeHelpers';
import type { PdfTexts } from './translations';

/** Standard-Punktesystem der Hallensportart (3/1/0): nur davon weicht der Punkte-Zusatz ab. */
const STANDARD_POINTS = footballIndoorConfig.defaults.pointSystem;

/** Eingang der Regelzeilen: Auszug aus dem Turnier plus Regelwerk (Feld kommt mit w1, bis dahin optional). */
export type PdfRules = Pick<
  Tournament,
  | 'groupSystem'
  | 'groupPhaseGameDuration'
  | 'finalRoundGameDuration'
  | 'placementLogic'
  | 'pointSystem'
  | 'finalsConfig'
  | 'matchCockpitSettings'
> & { rulebook?: string };

/** Adapter: Turnier → Eingang. Solange `rulebook` am Turnier fehlt, liefert er `undefined`. */
export function pdfRulesFrom(tournament: Tournament): PdfRules {
  const rulebook = 'rulebook' in tournament && typeof tournament.rulebook === 'string' ? tournament.rulebook : undefined;
  return {
    groupSystem: tournament.groupSystem,
    groupPhaseGameDuration: tournament.groupPhaseGameDuration,
    finalRoundGameDuration: tournament.finalRoundGameDuration,
    placementLogic: tournament.placementLogic,
    pointSystem: tournament.pointSystem,
    finalsConfig: tournament.finalsConfig,
    matchCockpitSettings: tournament.matchCockpitSettings,
    rulebook,
  };
}

/** Regelzeilen des Kopfs in fester Reihenfolge: Modus, Platzierung, Spielzeit, Regelwerk (nur wenn nicht leer). */
export function pdfRuleLines(rules: PdfRules, t: PdfTexts): string[] {
  const { label } = t.rules;
  const lines = [`${label.mode}: ${modeText(rules, t)}`];
  const placement = placementText(rules, t);
  if (placement !== '') {
    lines.push(`${label.placement}: ${placement}`);
  }
  lines.push(`${label.duration}: ${durationText(rules, t)}`);
  const rulebook = rules.rulebook?.trim() ?? '';
  if (rulebook !== '') {
    lines.push(`${label.rulebook}: ${rulebook}`);
  }
  return lines;
}

/**
 * K.-o.-Zeilen über der Finalrunde (@DR-015): je Runde mit eigener Regel eine Zeile, Runden mit gleicher Regel
 * zusammen („Halbfinale und Platzierungsspiele: …“). Haben alle Runden dieselbe Regel, genau eine Zeile ohne Rundennamen.
 * Reihenfolge wie im Turnierablauf: Platzierungsspiele vor dem Finale. Die Platzierungsregel folgt ohne eigene
 * Vorgabe dem Finale (@W2A-039, `resolveTiebreakMode`).
 */
export function koLines(rules: PdfRules, t: PdfTexts): string[] {
  const finalsConfig = rules.finalsConfig;
  const preset = finalsConfig?.preset ?? 'none';
  const rounds = knockoutRoundsForPreset(preset);
  if (rounds.length === 0) {
    return [];
  }
  const shooters = t.rules.shooters(rules.matchCockpitSettings?.penaltyShootersPerTeam ?? DEFAULT_MATCH_COCKPIT_SETTINGS.penaltyShootersPerTeam);
  const knockout = rounds.map(round => ({
    label: t.rules.round(round),
    mode: resolveTiebreakMode(finalsConfig, round) ?? 'shootout',
  }));
  // Die Finalrunde endet immer mit dem Finale (letzte Runde); Platzierungsspiele liegen davor.
  const placement = presetHasPlacementGames(preset)
    ? [{ label: t.rules.round('placement'), mode: resolveTiebreakMode(finalsConfig, null, 'thirdPlace') ?? 'shootout' }]
    : [];
  const slots = [...knockout.slice(0, -1), ...placement, ...knockout.slice(-1)];

  const groups: Array<{ labels: string[]; mode: TiebreakerMode }> = [];
  for (const slot of slots) {
    const group = groups.find(entry => entry.mode === slot.mode);
    if (group) {
      group.labels.push(slot.label);
    } else {
      groups.push({ labels: [slot.label], mode: slot.mode });
    }
  }
  const [only] = groups;
  if (only && groups.length === 1) {
    return [t.rules.koAll(ruleText(only.mode, shooters, t))];
  }
  return groups.map(entry => t.rules.koRound(entry.labels.join(t.rules.roundsJoin), ruleText(entry.mode, shooters, t)));
}

function modeText(rules: PdfRules, t: PdfTexts): string {
  return rules.groupSystem === 'groupsAndFinals' ? t.modeGroupsAndFinals : t.rules.modeRoundRobin;
}

function placementText(rules: PdfRules, t: PdfTexts): string {
  const criteria = rules.placementLogic
    .filter(criterion => criterion.enabled)
    .map(criterion => t.rules.criterion(criterion.id, criterion.label ?? criterion.id))
    .join(t.rules.criteriaJoin);
  return [pointsText(rules.pointSystem, t), criteria].filter(part => part !== '').join(t.rules.join);
}

/** Punkte-Zusatz nur bei Abweichung von Sieg 3, Unentschieden 1, Niederlage 0. */
function pointsText(points: PointSystem, t: PdfTexts): string {
  if (points.win === STANDARD_POINTS.win && points.draw === STANDARD_POINTS.draw && points.loss === STANDARD_POINTS.loss) {
    return '';
  }
  const loss = points.loss === 0 ? '' : t.rules.pointsLoss(points.loss);
  return `${t.rules.pointsLine(points.win, points.draw)}${loss}`;
}

function durationText(rules: PdfRules, t: PdfTexts): string {
  const groupMinutes = rules.groupPhaseGameDuration;
  const hasFinals = knockoutRoundsForPreset(rules.finalsConfig?.preset ?? 'none').length > 0;
  const finalMinutes = hasFinals ? rules.finalRoundGameDuration : undefined;
  const parts =
    finalMinutes !== undefined && finalMinutes !== groupMinutes
      ? [t.rules.groupDuration(t.durationMinutes(groupMinutes)), t.rules.finalDuration(t.durationMinutes(finalMinutes))]
      : [t.durationMinutes(groupMinutes)];
  const penaltySeconds =
    rules.matchCockpitSettings?.timePenaltyDurationSeconds ?? DEFAULT_MATCH_COCKPIT_SETTINGS.timePenaltyDurationSeconds;
  if (penaltySeconds > 0) {
    parts.push(t.rules.penalty(penaltyText(penaltySeconds, t)));
  }
  return parts.join(t.rules.join);
}

function penaltyText(seconds: number, t: PdfTexts): string {
  return seconds % SECONDS_PER_MINUTE === 0 ? t.durationMinutes(seconds / SECONDS_PER_MINUTE) : t.rules.seconds(seconds);
}

function ruleText(mode: TiebreakerMode, shooters: string, t: PdfTexts): string {
  if (mode === 'goldenGoal') {
    return t.rules.ruleGoldenGoal;
  }
  if (mode === 'overtime-then-shootout') {
    return t.rules.ruleOvertimeThenShootout(shooters);
  }
  return t.rules.ruleShootout(shooters);
}
