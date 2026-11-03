/**
 * Kopf von Seite 1 als Seitenmodell (@DR-006, @DR-020, @DR-023, @DR-024, @DR-031, @DR-003, @DR-038): Grafiken, Titelband
 * ohne Lücke, Kopflinie, Eckdaten im hellen Block, Regelzeile und Zuschauer-QR mit Beschriftung. Rein: gemessen wird über
 * `TextMeasure`. Alle Maße in mm, Tokens in `print-sheet.ts` und `print-header.ts`.
 */
import { printHeader } from '../../../design-tokens/print-header';
import { printRule, printSheetHead } from '../../../design-tokens/print-sheet';
import type { TextMeasure } from './measure';
import { wrapName } from './nameLines';
import { advanceMm, ascent, centeredBaseline, descent, flowWords, run, type Word } from './text';
import type { FactCell, FactKey, HeaderBlock, ImagePlace, QrPlace, Rect, TextRun } from './types';

/** Zuschauer-QR im Kopf: Adresse, Kantenlänge in Modulen und Beschriftung (@DR-010). */
export interface HeaderQrInput { url: string; modules: number; caption: string }

/** Eine Regelzeile des Kopfs: Art und fertiger Text („Modus: Zwei Gruppen …“). */
export interface RuleInput { kind: 'mode' | 'tiebreak' | 'playOut' | 'rulebook'; line: string }

/** Alles, was der Kopf zeigt, fertig übersetzt. Fehlende Angaben bleiben leer; ihr Feld entfällt dann (@DR-031). */
export interface HeaderInput {
  title: string;
  subtitle: string;
  labels: Record<FactKey, string>;
  /** „Samstag, 14.11.2026“; leer ohne Datum. */
  date: string;
  /** „Beginn 10:00“ und „Ende ca. 15:45“. */
  begin: string;
  end: string;
  /** Trenner zwischen Beginn und Ende („ · “). */
  join: string;
  hall: string;
  address: string;
  duration: string;
  flow: string;
  rules: RuleInput[];
  qr?: HeaderQrInput;
  /** Seitenverhältnis (Breite ÷ Höhe) der hinterlegten, ladbaren Grafiken (@DR-024). */
  graphicsAspect: { left?: number; right?: number };
}

export interface HeaderFrame { left: number; top: number; width: number }

/** Platz einer Grafik: höchstens 20 mm hoch und 40 mm breit, Seitenverhältnis erhalten (@DR-023). */
function imageSize(aspect: number): { w: number; h: number } {
  const h = Math.min(printHeader.logoMaxHeight, printHeader.logoMaxWidth / aspect);
  return { w: h * aspect, h };
}

/** Kantenlänge der weißen Fläche (Symbol plus Ruhezone) bei `modules` Modulen und Symbolkante `edge`. */
export function qrBoxSide(modules: number, edge: number): number {
  return edge + (2 * printHeader.qrQuietModules * edge) / modules;
}

/** Teilt eine Zeile, die auch allein nicht in `width` passt, zeichenweise (nur wenn kein Umbruch an Leerzeichen, „-“ oder „/“ reicht). */
function splitHard(line: string, width: number, pt: number, measure: TextMeasure): string[] {
  const out: string[] = [];
  let current = '';
  for (const char of line) {
    if (current !== '' && measure.width(current + char, pt, 'bold') > width) {
      out.push(current);
      current = char;
    } else {
      current += char;
    }
  }
  return current === '' ? out : [...out, current];
}

/**
 * Titel: erst die Schrift schrittweise bis `titleMinPt` verkleinern, solange er nicht in `titleMaxLines` Zeilen und die
 * Breite passt (@BM-021); passt ein einzelnes Wort auch dann nicht, wird es zeichenweise geteilt, damit nichts über den Rand
 * läuft (@DR-001) und nichts gekürzt wird.
 */
function titleOf(title: string, width: number, measure: TextMeasure): { lines: string[]; pt: number } {
  let pt: number = printSheetHead.titlePt;
  for (;;) {
    const lines = wrapName(title, width, pt, measure, 'bold');
    const tooWide = lines.some(line => measure.width(line, pt, 'bold') > width);
    if ((lines.length <= printSheetHead.titleMaxLines && !tooWide) || pt - printSheetHead.titleStepPt < printSheetHead.titleMinPt) {
      return { lines: lines.flatMap(line => (measure.width(line, pt, 'bold') > width ? splitHard(line, width, pt, measure) : [line])), pt };
    }
    pt -= printSheetHead.titleStepPt;
  }
}

/** Breite der Zeile „Beginn 10:00 · Ende ca. 15:40“: Beginn fett, der Rest normal. */
function timesWidth(h: HeaderInput, measure: TextMeasure): number {
  return measure.width(h.begin, printSheetHead.factBigPt, 'bold') + measure.width(`${h.join}${h.end}`, printSheetHead.factBigPt, 'normal');
}

/** Bricht nur an der Trennstelle „ · “, nie innerhalb einer Angabe (ein Teil, der allein nicht passt, bricht an Leerzeichen). */
function wrapAtJoin(text: string, join: string, width: number, pt: number, measure: TextMeasure): string[] {
  const lines: string[] = [];
  let current = '';
  for (const part of text.split(join)) {
    const joined = current === '' ? part : `${current}${join}${part}`;
    if (current !== '' && measure.width(joined, pt, 'normal') > width) {
      lines.push(`${current}${join.trimEnd()}`);
      current = part;
    } else {
      current = joined;
    }
  }
  return [...lines, ...(current === '' ? [] : [current])].flatMap(line => (measure.width(line, pt, 'normal') > width ? wrapName(line, width, pt, measure) : [line]));
}

function factCell(key: FactKey, h: HeaderInput, x: number, top: number, width: number, measure: TextMeasure): { cell: FactCell; height: number } {
  const s = printSheetHead;
  const runs: TextRun[] = [];
  let y = top;
  const line = (text: string, pt: number, weight: 'normal' | 'bold'): void => {
    const adv = advanceMm(pt, s.factLineHeight);
    runs.push(run(text, x, centeredBaseline(y + adv / 2, pt), pt, weight));
    y += adv;
  };
  line(h.labels[key], s.factLabelPt, 'bold');
  if (key === 'when') {
    if (h.date !== '') { line(h.date, s.factBigPt, 'bold'); }
    if (timesWidth(h, measure) <= width) {
      const adv = advanceMm(s.factBigPt, s.factLineHeight);
      const base = centeredBaseline(y + adv / 2, s.factBigPt);
      runs.push(run(h.begin, x, base, s.factBigPt, 'bold'));
      runs.push(run(`${h.join}${h.end}`, x + measure.width(h.begin, s.factBigPt, 'bold'), base, s.factBigPt, 'normal'));
      y += adv;
    } else {
      line(h.begin, s.factBigPt, 'bold');
      line(h.end, s.factBigPt, 'normal');
    }
  } else if (key === 'where') {
    // Halle und Adresse brechen an Leerzeichen oder Bindestrich um und werden nie gekürzt; die Zelle wird dafür höher (@DR-031)
    wrapName(h.hall, width, s.factBigPt, measure, 'bold').forEach(text => line(text, s.factBigPt, 'bold'));
    if (h.address !== '') { wrapName(h.address, width, s.factMidPt, measure).forEach(text => line(text, s.factMidPt, 'normal')); }
  } else {
    for (const text of wrapAtJoin(key === 'duration' ? h.duration : h.flow, h.join, width, s.factMidPt, measure)) {
      line(text, s.factMidPt, 'normal');
    }
  }
  return { cell: { key, runs }, height: y - top };
}

function ruleWords(rules: RuleInput[]): Word[] {
  const words: Word[] = [];
  rules.forEach((rule, index) => {
    if (index > 0) { words.push({ text: '·', weight: 'normal' }); }
    const cut = rule.kind === 'playOut' ? -1 : rule.line.indexOf(': ');
    if (cut >= 0) { words.push({ text: rule.line.slice(0, cut + 1), weight: 'bold' }); }
    for (const w of (cut >= 0 ? rule.line.slice(cut + 2) : rule.line).split(' ')) {
      if (w !== '') { words.push({ text: w, weight: 'normal' }); }
    }
  });
  return words;
}

/** Baut den Kopf von Seite 1. */
export function buildHeader(h: HeaderInput, frame: HeaderFrame, measure: TextMeasure): HeaderBlock {
  const s = printSheetHead;
  const { left, top, width } = frame;
  const right = left + width;

  // Grafiken und Titelband: der Titel nutzt den frei gebliebenen Platz, wo keine Grafik ist, bleibt keine Lücke (@DR-024)
  const images: ImagePlace[] = [];
  const leftSize = h.graphicsAspect.left === undefined ? undefined : imageSize(h.graphicsAspect.left);
  const rightSize = h.graphicsAspect.right === undefined ? undefined : imageSize(h.graphicsAspect.right);
  if (leftSize) { images.push({ side: 'left', x: left, y: top, ...leftSize }); }
  if (rightSize) { images.push({ side: 'right', x: right - rightSize.w, y: top, ...rightSize }); }
  const titleLeft = left + (leftSize ? leftSize.w + printHeader.logoGap : 0);
  const titleRight = right - (rightSize ? rightSize.w + printHeader.logoGap : 0);
  const title = titleOf(h.title, titleRight - titleLeft, measure);
  const titleAdv = advanceMm(title.pt, s.titleLineHeight);
  const titleRuns = title.lines.map((text, i) => run(text, titleLeft, top + ascent(title.pt) + i * titleAdv, title.pt, 'bold'));
  let textBottom = top + ascent(title.pt) + (title.lines.length - 1) * titleAdv + descent(title.pt);
  if (h.subtitle !== '') {
    const base = textBottom + s.subtitleGap + ascent(s.subtitlePt);
    titleRuns.push(...wrapName(h.subtitle, titleRight - titleLeft, s.subtitlePt, measure).map((text, i) => run(text, titleLeft, base + i * advanceMm(s.subtitlePt, s.factLineHeight), s.subtitlePt, 'normal')));
    textBottom = titleRuns[titleRuns.length - 1].y + descent(s.subtitlePt);
  }
  const imagesBottom = top + Math.max(leftSize?.h ?? 0, rightSize?.h ?? 0);
  const ruleY = Math.max(textBottom, imagesBottom) + s.bandPadBottom + printRule.head / 2;

  // QR rechts, Eckdaten und Regelzeile links daneben
  const factsTop = ruleY + printRule.head / 2 + s.belowRule;
  let qr: QrPlace | undefined;
  let qrCaption: TextRun | undefined;
  let qrBottom = 0;
  let qrWidth = 0;
  if (h.qr) {
    const side = qrBoxSide(h.qr.modules, printHeader.qrEdge);
    const box: Rect = { x: right - side, y: factsTop, w: side, h: side };
    const quiet = (printHeader.qrQuietModules * printHeader.qrEdge) / h.qr.modules;
    qr = { url: h.qr.url, box, symbol: { x: box.x + quiet, y: box.y + quiet, w: printHeader.qrEdge, h: printHeader.qrEdge } };
    const base = box.y + side + s.qrCaptionGap + ascent(s.qrCaptionPt);
    const capWidth = measure.width(h.qr.caption, s.qrCaptionPt, 'bold');
    const cx = box.x + side / 2;
    qrCaption = { ...run(h.qr.caption, cx, base, s.qrCaptionPt, 'bold', 'center'), underline: { x1: cx - capWidth / 2, x2: cx + capWidth / 2, y: base + s.underlineDrop } };
    qrBottom = base + descent(s.qrCaptionPt);
    qrWidth = side + s.qrGap;
  }
  const blockW = width - qrWidth;
  const innerW = blockW - 2 * s.factsPadH;
  // Erste Spalte so breit wie Datum und Uhrzeiten (14 pt, eine Zeile), (Mockup 72 mm); die zweite behält mindestens ihre Mindestbreite
  const needed = Math.max(timesWidth(h, measure), measure.width(h.date, s.factBigPt, 'bold')) + s.factsFirstColReserve;
  const col1 = Math.min(needed, innerW - s.factsColGap - s.factsSecondColMin);
  const widths = [col1, innerW - s.factsColGap - col1];
  const present: FactKey[] = [
    'when',
    ...(h.hall !== '' ? (['where'] as const) : []),
    ...(h.duration !== '' ? (['duration'] as const) : []),
    ...(h.flow !== '' ? (['flow'] as const) : []),
  ];
  const cells: FactCell[] = [];
  let y = factsTop + s.factsPadV;
  for (let i = 0; i < present.length; i += 2) {
    const built = present.slice(i, i + 2).map((key, j) => factCell(key, h, left + s.factsPadH + (j === 0 ? 0 : widths[0] + s.factsColGap), y, widths[j], measure));
    cells.push(...built.map(b => b.cell));
    y += Math.max(...built.map(b => b.height)) + s.factsRowGap;
  }
  const factsH = y - s.factsRowGap + s.factsPadV - factsTop;
  const fill = { kind: 'facts' as const, x: left, y: factsTop, w: blockW, h: factsH };

  // Regelzeile unter den Eckdaten (@DR-006): Modus, Wertung, Regelwerk; die Spielzeit steht bei den Eckdaten
  const ruleAdv = advanceMm(s.rulePt, s.ruleLineHeight);
  const ruleTop = factsTop + factsH + s.ruleGap;
  const rules = flowWords(ruleWords(h.rules), left, centeredBaseline(ruleTop + ruleAdv / 2, s.rulePt), blockW, s.rulePt, ruleAdv, measure);
  const rulesBottom = rules.length === 0 ? factsTop + factsH : Math.max(...rules.map(r => r.y)) + descent(s.rulePt);

  const bottom = Math.max(rulesBottom, qrBottom);
  const block: HeaderBlock = {
    kind: 'header', top, height: bottom - top, images, title: titleRuns, facts: { fill, cells }, rules,
    rule: { kind: 'head', x1: left, x2: right, y: ruleY },
  };
  if (qr) { block.qr = qr; }
  if (qrCaption) { block.qrCaption = qrCaption; }
  return block;
}
