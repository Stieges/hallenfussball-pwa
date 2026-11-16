/**
 * Angaben der Zusammenfassung vor dem Festlegen (@W1-039). Datum, Dauer, Modus und Regelzeilen kommen aus denselben
 * Quellen wie der Kopf des Spielplan-PDFs (`lib/pdf`): gleiche Texte, gleiche Wortlaute, nichts ein zweites Mal gebaut.
 */
import { generateFullSchedule, type GeneratedSchedule } from '../../../core/generators';
import type { Tournament } from '../../../types/tournament';
import { dayWithWeekday } from '../../../lib/pdf/headerFacts';
import { modeText, pdfRuleEntries, pdfRulesFrom, type PdfRuleKind } from '../../../lib/pdf/rules';
import type { PdfTexts } from '../../../lib/pdf/translations';
import { hostSummary, planForHostSummary, type HostSummary } from './hostOpeningSummary';

/** Regelzeilen, die die Zusammenfassung unverändert aus dem PDF-Kopf übernimmt (Modus und Spielzeit stehen als eigene Felder da). */
const SUMMARY_RULE_KINDS: readonly PdfRuleKind[] = ['tiebreak', 'playOut', 'rulebook'];

export interface SummaryFacts {
  /** „Samstag, 28.11.2026“. */
  day: string;
  /** „Jeder gegen jeden“ / „Gruppen + Finalrunde“. */
  mode: string;
  /** Anzahl der Spiele des erzeugten Plans; `undefined`, wenn sich der Plan noch nicht erzeugen lässt. */
  matchCount: number | undefined;
  /** „10 Min.“ */
  gameDuration: string;
  /** „2 Min.“; `undefined`, wenn keine Pause eingestellt ist. */
  breakDuration: string | undefined;
  /** „1 Feld“. */
  fields: string;
  /** Regelzeilen wie im Kopf des Spielplan-PDFs (Wertung, Gleichstand, Regelwerk). */
  ruleLines: string[];
  /** Mannschaften des Veranstalters und Eröffnung (@W4-034, @W4-048, @W4-050); `undefined`, wenn keine markiert ist. */
  host: HostSummary | undefined;
}

/** Plan wie in der Vorschau; lässt er sich noch nicht erzeugen, bleibt die Zusammenfassung ohne Spielzahl. */
function planOf(draft: Tournament): GeneratedSchedule | undefined {
  try {
    return generateFullSchedule(draft);
  } catch {
    return undefined;
  }
}

/** Bearbeiten (vorhandene Spiele) oder entfernte Teams: der neue Plan zählt, nicht der bestehende bzw. einer mit den entfernten Teams. */
function needsOwnPlan(draft: Tournament): boolean {
  return draft.matches.length > 0 || draft.teams.some(team => team.isRemoved);
}

export function summaryFacts(draft: Tournament, t: PdfTexts): SummaryFacts {
  const schedule = planOf(draft);
  const rules = pdfRulesFrom(draft, schedule);
  const pause = draft.groupPhaseBreakDuration ?? 0;
  return {
    day: dayWithWeekday(draft.date, t),
    mode: modeText(rules, t),
    matchCount: schedule?.allMatches.length,
    gameDuration: t.durationMinutes(draft.groupPhaseGameDuration),
    breakDuration: pause > 0 ? t.durationMinutes(pause) : undefined,
    fields: t.fields(draft.numberOfFields),
    ruleLines: pdfRuleEntries(rules, t)
      .filter(entry => SUMMARY_RULE_KINDS.includes(entry.kind))
      .map(entry => entry.line),
    host: hostSummary(draft, needsOwnPlan(draft) ? planForHostSummary(draft) : schedule ?? null),
  };
}
