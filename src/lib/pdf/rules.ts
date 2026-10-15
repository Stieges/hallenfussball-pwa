/**
 * Regelzeilen des Spielplan-PDFs (B-28a3-3a, @DR-006, @DR-007, @DR-008, @DR-015, @DR-020).
 *
 * Rein: keine Zeichnung, keine React-Abhängigkeit, kein Import aus `features/`. Die Regeln kommen aus dem
 * Turnier (`pdfRulesFrom`), die K.-o.-Runden aus dem erzeugten Plan (`koSlots.ts`), die Wörter aus `t.rules`.
 */
import {
  DEFAULT_MATCH_COCKPIT_SETTINGS,
  type PointSystem,
  type TiebreakerMode,
  type Tournament,
} from '../../types/tournament';
import type { GeneratedSchedule } from '../../core/generators';
import { footballIndoorConfig } from '../../config/sports/football';
import { SECONDS_PER_MINUTE } from '../../utils/timeHelpers';
import type { PdfTexts } from './translations';
import { koModeFor, koSlotsFrom, type KoKey } from './koSlots';

/** Standard-Punktesystem der Hallensportart (3/1/0): nur davon weicht der Punkte-Zusatz ab. */
const STANDARD_POINTS = footballIndoorConfig.defaults.pointSystem;

/** Eingang der Regelzeilen: Auszug aus dem Turnier, Regelwerk und die K.-o.-Schlüssel des erzeugten Plans. */
export type PdfRules = Pick<
  Tournament,
  | 'groupSystem'
  | 'groupPhaseGameDuration'
  | 'finalRoundGameDuration'
  | 'placementLogic'
  | 'pointSystem'
  | 'finalsConfig'
  | 'matchCockpitSettings'
> & { rulebook?: string; koSlots: KoKey[] };

/** Adapter: Turnier und erzeugter Plan → Eingang. Solange `rulebook` am Turnier fehlt, liefert er `undefined`. */
export function pdfRulesFrom(tournament: Tournament, schedule: GeneratedSchedule): PdfRules {
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
    koSlots: koSlotsFrom(schedule.allMatches.filter(m => m.phase !== 'groupStage')),
  };
}

/** Regelzeilen des Kopfs in fester Reihenfolge: Modus, Platzierung, Spielzeit, Regelwerk (nur wenn nicht leer). */
export function pdfRuleLines(rules: PdfRules, t: PdfTexts): string[] {
  const { label } = t.rules;
  const lines = [`${label.mode}: ${modeText(rules, t)}`];
  const placement = placementLine(rules, t);
  if (placement !== '') {
    lines.push(placement);
  }
  lines.push(`${label.duration}: ${durationText(rules, t)}`);
  const rulebook = rules.rulebook?.trim() ?? '';
  if (rulebook !== '') {
    lines.push(`${label.rulebook}: ${rulebook}`);
  }
  return lines;
}

/** Zeile „Platzierung: Punkte – Tordifferenz …“; leer, wenn kein Kriterium und kein Punkte-Zusatz gilt. */
export function placementLine(rules: PdfRules, t: PdfTexts): string {
  const placement = placementText(rules, t);
  return placement === '' ? '' : `${t.rules.label.placement}: ${placement}`;
}

/**
 * K.-o.-Zeilen über der Finalrunde (@DR-015): je Regel eine Zeile, Runden mit gleicher Regel zusammen
 * („Halbfinale und Spiel um Platz 3: …“). Haben alle Runden dieselbe Regel, genau eine Zeile ohne Rundennamen.
 */
export function koLines(rules: PdfRules, t: PdfTexts): string[] {
  if (rules.koSlots.length === 0) {
    return [];
  }
  const shooters = t.rules.shooters(rules.matchCockpitSettings?.penaltyShootersPerTeam ?? DEFAULT_MATCH_COCKPIT_SETTINGS.penaltyShootersPerTeam);
  const groups: Array<{ labels: string[]; mode: TiebreakerMode }> = [];
  for (const key of rules.koSlots) {
    const mode = koModeFor(key, rules.finalsConfig);
    const label = t.rules.round(key);
    const group = groups.find(entry => entry.mode === mode);
    if (group) {
      group.labels.push(label);
    } else {
      groups.push({ labels: [label], mode });
    }
  }
  const [only] = groups;
  if (only && groups.length === 1) {
    return [t.rules.koAll(ruleText(only.mode, shooters, t))];
  }
  return groups.map(entry => t.rules.koRound(t.rules.startUpper(t.rules.joinList(entry.labels)), ruleText(entry.mode, shooters, t)));
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

/** Spielzeit: Gruppen- und Finalrunden-Dauer (Finalrunde nur, wenn es Finalspiele gibt), Zeitstrafe. */
function durationText(rules: PdfRules, t: PdfTexts): string {
  const groupMinutes = rules.groupPhaseGameDuration;
  const finalMinutes = rules.koSlots.length > 0 ? rules.finalRoundGameDuration : undefined;
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
