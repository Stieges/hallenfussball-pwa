/**
 * Seitenmodell des Spielplans (T6): aus dem aufgelösten PDF-Eingang, den Texten und einer Messfunktion entstehen Seite 1
 * (Kopf, Spaltenkopf, Gruppenspiele) und die Folgeseiten der Gruppenspiele. Rein, ohne jsPDF. Tabellen, Finalrunde und
 * Platzierung zeichnet bis T7b der Bestand (`render/finalsTables.ts` u. a.); ihre Seiten hängt `schedulePdf.ts` an.
 *
 * Immer A4 hoch (@DR-026): `PdfInput.orientation` ändert am Modell nichts (Querformat = MVP+, Lücke L3).
 */
import { getGroupDisplayName, getGroupShortCode } from '../../../utils/displayNames';
import { getLocationAddressLine } from '../../../utils/locationHelpers';
import { dayWithWeekday } from '../headerFacts';
import { resultState } from '../matchResult';
import { sideLabel } from '../matchSides';
import { refereeLabelFor } from '../refereeLabel';
import { pdfRuleEntries, pdfRulesFrom } from '../rules';
import type { StatefulMatch } from '../tournamentState';
import { pdfContentRules } from '../visibility';
import { printSheetHead } from '../../../design-tokens/print-sheet';
import { roundEndTime } from './endTime';
import { buildHeader, type HeaderInput } from './headerModel';
import type { TextMeasure } from './measure';
import type { RowSource, RowTexts } from './matchRows';
import { planRows, type RowsPlan } from './pagePlan';
import { ascent, descent } from './text';
import type { ColumnKey, FitStep, HeaderBlock, LinkArea, MatchRowsBlock, PageModel, ScheduleModel, ScheduleModelSource } from './types';

/** Toleranz beim Vergleich von Höhen in mm. */
const FLOW_EPS = 0.01;
/** Stufen der Reserve-Regel (@DR-033) in der Reihenfolge ihrer Schwere. */
const FIT_RANK: Record<FitStep, number> = { normal: 0, shortNames: 1, tight: 2, nextPage: 3 };

/** Anstoßzeit, dann Feld, dann Nummer: die Tabelle liest sich nach der Uhr, auch wenn der Plan anders geordnet ist. */
function inKickoffOrder(matches: StatefulMatch[]): StatefulMatch[] {
  return [...matches].sort((a, b) => a.startTime.getTime() - b.startTime.getTime() || a.field - b.field || a.matchNumber - b.matchNumber);
}

/** Titel der Datei (@DR-039): „<Turnier> – <Spielplan>“ in der Sprache des Dokuments. */
export function documentTitle(title: string, suffix: string): string {
  return `${title} – ${suffix}`;
}

/** Baut das Seitenmodell der Gruppenspiele mit Kopf. */
export function buildScheduleModel(source: ScheduleModelSource, measure: TextMeasure): ScheduleModel {
  const { input, t, geo } = source;
  const { schedule, tournament, edition } = input;
  const content = pdfContentRules(tournament, input.audience, input.viewerBaseUrl);
  const includeScores = input.wish.scores && content.results;
  const rules = pdfRulesFrom(tournament, schedule);
  const entries = pdfRuleEntries(rules, t);
  const refLabel = refereeLabelFor(schedule);
  const sideCtx = {
    t,
    isTeam: (name: string) => schedule.teams.some(team => team.name === name),
    groupName: (id: string) => t.groupLabel(id, getGroupDisplayName(id, schedule.tournament)),
    hidePendingOrigin: content.hidePendingOrigin,
    originOnly: edition === 'blank',
    matches: schedule.allMatches,
  };

  const groupPhase = schedule.phases.find(p => p.name === 'groupStage');
  const finalCount = schedule.phases.filter(p => p.name !== 'groupStage').reduce((n, p) => n + p.matches.length, 0);
  const groupMatches = inKickoffOrder((groupPhase?.matches ?? []));
  const groups = [...new Set(groupMatches.map(m => m.group).filter((g): g is string => g !== undefined && g !== ''))];
  const multipleGroups = groups.length > 1;
  const stateOf = (match: StatefulMatch): ReturnType<typeof resultState> => {
    // „ausgefallen“ steht auch bei ausgeblendeten Ergebnissen; leere Linien statt „ausgefallen“ hat nur die Fassung ohne Ergebnisse (@DR-019)
    if (edition !== 'blank' && match.matchStatus === 'skipped') { return { kind: 'skipped' }; }
    return resultState(match, { edition, results: includeScores });
  };
  const rows: RowSource[] = groupMatches.map(match => {
    const state = stateOf(match);
    const group = multipleGroups && match.group !== undefined
      ? { code: getGroupShortCode(match.group, schedule.tournament), shape: groups.indexOf(match.group) % 2 === 0 ? ('square' as const) : ('circle' as const) }
      : undefined;
    return {
      matchId: match.id,
      number: match.matchNumber,
      time: match.time,
      hour: match.startTime.getHours(),
      ...(schedule.numberOfFields > 1 ? { field: String(match.field) } : {}),
      ...(group ? { group } : {}),
      home: sideLabel(match, 'A', sideCtx),
      away: sideLabel(match, 'B', sideCtx),
      state,
      ...(state.kind === 'final' && state.mark ? { markText: t.corrected(t.formatClock(state.mark.at)) } : {}),
      referee: refLabel(match),
      small: [],
    };
  });
  const rowTexts: RowTexts = { live: t.live, skipped: t.skipped, overtime: t.afterOvertime, shootout: t.shootout };
  const labels: Partial<Record<ColumnKey, string>> = { nr: t.nr, time: t.timeHeader, field: t.field, group: t.group, home: t.home, result: t.result, away: t.away, referee: t.referee };

  // Kopf (Eckdaten ohne Halle oder Datum lassen die Angabe ganz weg, @DR-031)
  const sheet = t.sheet;
  const duration = entries.find(e => e.kind === 'duration')?.line ?? '';
  const flowParts = rules.groupSystem === 'roundRobin'
    ? [sheet.flowMatches(groupMatches.length)]
    : [...(groupMatches.length > 0 ? [sheet.flowGroup(groupMatches.length)] : []), ...(finalCount > 0 ? [sheet.flowFinals(finalCount)] : [])];
  const address = getLocationAddressLine(schedule.tournament);
  const headerInput: HeaderInput = {
    title: schedule.tournament.title,
    subtitle: [schedule.tournament.ageClass?.trim() ?? '', input.organizerName].filter(part => part !== '').join(t.rules.join),
    labels: { when: sheet.when, where: sheet.where, duration: sheet.duration, flow: sheet.flow },
    date: schedule.tournament.date ? dayWithWeekday(schedule.tournament.date, t) : '',
    begin: sheet.begin(t.formatClock(schedule.startTime)),
    end: sheet.endApprox(roundEndTime(t.formatClock(schedule.endTime))),
    join: t.rules.join,
    hall: input.hallName.trim(),
    address: address ?? '',
    duration: duration.includes(': ') ? duration.slice(duration.indexOf(': ') + 2) : duration,
    flow: flowParts.join(t.rules.join),
    rules: entries.filter((e): e is typeof e & { kind: 'mode' | 'tiebreak' | 'playOut' | 'rulebook' } => e.kind !== 'duration'),
    graphicsAspect: source.graphicsAspect,
    ...(source.qr ? { qr: { url: source.qr.url, modules: source.qr.modules, caption: input.wish.viewerResultsHidden || !content.results ? t.qrCaption.plan : t.qrCaption.results } } : {}),
  };
  const frameOf = { left: geo.left, top: geo.top, width: geo.contentWidth };
  const layoutWith = (input: HeaderInput): { header: HeaderBlock; plan: RowsPlan } => {
    const built = buildHeader(input, frameOf, measure);
    const planned = planRows({
      sources: rows,
      flags: { field: schedule.numberOfFields > 1, group: multipleGroups, referee: rows.some(r => r.referee !== ''), smallPairs: 0 },
      texts: rowTexts,
      labels,
      frame: { left: geo.left, width: geo.contentWidth, bottom: geo.bottom, continuationTop: geo.top + geo.shortHeadHeight },
      firstTop: built.top + built.height + printSheetHead.belowHead,
      measure,
    });
    return { header: built, plan: planned };
  };
  // „Ablauf“ (@DR-031): nur, wenn er den Block nicht höher macht und kein Spiel von Seite 1 verdrängt; sonst fällt die Angabe weg
  let { header, plan } = layoutWith(headerInput);
  if (headerInput.flow !== '') {
    const lean = layoutWith({ ...headerInput, flow: '' });
    const rowsOnFirst = (p: RowsPlan): number => p.blocks[0]?.rows.length ?? 0;
    if (header.facts.fill.h > lean.header.facts.fill.h + FLOW_EPS || rowsOnFirst(plan) < rowsOnFirst(lean.plan) || plan.blocks.length > lean.plan.blocks.length || FIT_RANK[plan.fit] > FIT_RANK[lean.plan.fit]) {
      ({ header, plan } = lean);
    }
  }

  const links: LinkArea[] = [];
  if (header.qr && header.qrCaption) {
    const cap = header.qrCaption;
    const underline = cap.underline;
    links.push({ url: header.qr.url, ...header.qr.box });
    if (underline) {
      links.push({ url: header.qr.url, x: underline.x1, y: cap.y - ascent(cap.pt), w: underline.x2 - underline.x1, h: ascent(cap.pt) + descent(cap.pt) });
    }
  }
  const blocks: MatchRowsBlock[] = plan.blocks;
  const pages: PageModel[] = blocks.length === 0
    ? [{ number: 1, blocks: [header], qr: header.qr ? 'large' : null, links }]
    : blocks.map((block, index) => ({
      number: index + 1,
      blocks: index === 0 ? [header, block] : [block],
      qr: source.qr ? (index === 0 ? 'large' : 'small') : null,
      links: index === 0 ? links : [],
    }));
  return {
    meta: { title: documentTitle(schedule.tournament.title, sheet.titleSuffix), lang: input.locale },
    format: 'a4-portrait',
    fit: plan.fit,
    pages,
  };
}
