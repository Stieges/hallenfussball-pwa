/**
 * Seitenmodell des Spielplans (T6): aus dem aufgelösten PDF-Eingang, den Texten und einer Messfunktion entstehen Seite 1
 * (Kopf, Spaltenkopf, Gruppenspiele) und die Folgeseiten der Gruppenspiele. Rein, ohne jsPDF. Tabellen, Finalrunde und
 * Platzierung zeichnet bis T7b der Bestand (`render/finalsTables.ts` u. a.); ihre Seiten hängt `schedulePdf.ts` an.
 *
 * Immer A4 hoch (@DR-026): `PdfInput.orientation` ändert am Modell nichts (Querformat = MVP+, Lücke L3).
 */
import { getLocationAddressLine } from '../../../utils/locationHelpers';
import { getGroupDisplayName, getGroupShortCode } from '../../../utils/displayNames';
import { dayWithWeekday } from '../headerFacts';
import { resultState } from '../matchResult';
import { sideLabel } from '../matchSides';
import { refereeLabelFor } from '../refereeLabel';
import { pdfRuleEntries, pdfRulesFrom } from '../rules';
import type { StatefulMatch } from '../tournamentState';
import { pdfContentRules } from '../visibility';
import { printMatchTable, printSheetHead } from '../../../design-tokens/print-sheet';
import { roundEndTime } from './endTime';
import { buildHeader, type HeaderInput } from './headerModel';
import type { TextMeasure } from './measure';
import type { RowSource, RowTexts } from './matchRows';
import { planRows, type RowsPlan } from './pagePlan';
import { ascent, descent } from './text';
import type { ColumnKey, HeaderBlock, LinkArea, MatchRowsBlock, PageModel, ScheduleModel, ScheduleModelSource } from './types';

/** Geschütztes Leerzeichen: hält PLZ und Ort zusammen. */
const NBSP = '\u00a0';
/** Toleranz beim Vergleich von Höhen in mm. */
const FLOW_EPS = 0.01;
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
  // Gruppenzeichen wechseln je Gruppe nach dem Buchstaben, nicht nach dem ersten Anstoß: A eckig, B rund, C eckig … (@DR-001)
  const groupOrder = [...groups].sort();
  const multipleGroups = groups.length > 1;
  const stateOf = (match: StatefulMatch): ReturnType<typeof resultState> => {
    // „ausgefallen“ steht auch bei ausgeblendeten Ergebnissen; leere Linien statt „ausgefallen“ hat nur die Fassung ohne Ergebnisse (@DR-019)
    if (edition !== 'blank' && match.matchStatus === 'skipped') { return { kind: 'skipped' }; }
    return resultState(match, { edition, results: includeScores });
  };
  const rows: RowSource[] = groupMatches.map(match => {
    const state = stateOf(match);
    const group = multipleGroups && match.group !== undefined
      ? { code: getGroupShortCode(match.group, schedule.tournament), shape: groupOrder.indexOf(match.group) % 2 === 0 ? ('square' as const) : ('circle' as const) }
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
  const rowTexts: RowTexts = { skipped: t.skipped, overtime: t.afterOvertime, shootout: t.shootout };
  const labels: Partial<Record<ColumnKey, string>> = { nr: t.nr, time: t.timeHeader, field: t.field, group: t.group, home: t.home, result: t.result, away: t.away, referee: t.referee };

  // Kopf (Eckdaten ohne Halle oder Datum lassen die Angabe ganz weg, @DR-031)
  const sheet = t.sheet;
  const upper = (text: string): string => text.toLocaleUpperCase(input.locale);
  const duration = entries.find(e => e.kind === 'duration')?.line ?? '';
  // „Ablauf“: Zahl der Spiele, mit Finalrunde „28 Spiele, davon 8 Finalspiele“ (@DR-031)
  const flowText = finalCount > 0 ? sheet.flowWithFinals(groupMatches.length + finalCount, finalCount) : sheet.flowMatches(groupMatches.length);
  // Adresse der Halle: „Straße Nr., PLZ Ort“ in eigenen Zeilen unter der Halle (@DR-031); PLZ und Ort mit geschütztem Leerzeichen zusammen
  const address = getLocationAddressLine(schedule.tournament).replace(/, ([^,]*)$/, (_all, place: string) => `, ${place.replace(/ /g, NBSP)}`);
  const headerInput: HeaderInput = {
    title: schedule.tournament.title,
    subtitle: [sheet.titleSuffix, schedule.tournament.ageClass?.trim() ?? '', input.organizerName].filter(part => part !== '').join(t.rules.join),
    // Bezeichnungen in Versalien (die Texte in tournament.json bleiben normal geschrieben), in der Sprache des Dokuments
    labels: { when: upper(sheet.when), where: upper(sheet.where), duration: upper(sheet.duration), flow: upper(sheet.flow) },
    date: schedule.tournament.date ? dayWithWeekday(schedule.tournament.date, t) : '',
    begin: sheet.begin(t.formatClock(schedule.startTime)),
    end: sheet.endApprox(roundEndTime(t.formatClock(schedule.endTime))),
    join: t.rules.join,
    hall: input.hallName.trim(),
    address,
    duration: duration.includes(': ') ? duration.slice(duration.indexOf(': ') + 2) : duration,
    flow: groupMatches.length + finalCount > 0 ? flowText : '',
    rules: entries.filter((e): e is typeof e & { kind: 'mode' | 'tiebreak' | 'playOut' | 'rulebook' } => e.kind !== 'duration'),
    graphicsAspect: source.graphicsAspect,
    ...(source.qr ? { qr: { url: source.qr.url, modules: source.qr.modules, caption: input.wish.viewerResultsHidden || !content.results ? t.qrCaption.plan : t.qrCaption.results } } : {}),
  };
  // Breite der Spalte „SR“: breitester Eintrag oder Kopf, mit Rand; Teamnamen („Teams pfeifen“) füllen den Token (@DR-032, @DR-033)
  const refEntries = rows.map(r => r.referee).filter(label => label !== '');
  const refereeWidth = refEntries.length === 0 ? undefined
    : Math.max(...refEntries.map(label => measure.width(label, printMatchTable.refPt, 'normal')), measure.width(labels.referee ?? '', printMatchTable.headPt, 'bold')) + 2 * printMatchTable.refInset;
  const frameOf = { left: geo.left, top: geo.top, width: geo.contentWidth };
  const layoutWith = (input: HeaderInput): { header: HeaderBlock; plan: RowsPlan } => {
    const built = buildHeader(input, frameOf, measure);
    const planned = planRows({
      sources: rows,
      flags: { field: schedule.numberOfFields > 1, group: multipleGroups, referee: rows.some(r => r.referee !== ''), smallPairs: 0, ...(refereeWidth === undefined ? {} : { refereeWidth }) },
      texts: rowTexts,
      labels,
      frame: { left: geo.left, width: geo.contentWidth, bottom: geo.bottom, continuationTop: geo.top + geo.shortHeadHeight },
      firstTop: built.top + built.height + printSheetHead.belowHead,
      measure,
    });
    return { header: built, plan: planned };
  };
  // „Ablauf“ (@DR-031) steht nur, wenn er den Block nicht höher macht. Ein Spiel von Seite 1 kann er nur über einen höheren Kopf
  // verdrängen, und der Kopf wächst nur mit dem Block; die Höhe des Blocks ist darum die ganze Bedingung.
  let { header, plan } = layoutWith(headerInput);
  if (headerInput.flow !== '') {
    const lean = layoutWith({ ...headerInput, flow: '' });
    if (header.facts.fill.h > lean.header.facts.fill.h + FLOW_EPS) {
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
