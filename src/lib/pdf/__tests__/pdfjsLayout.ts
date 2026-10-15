/**
 * Maß-Werkzeug (B-28a3-1): liest Text mit Position und Größe sowie Rechtecke und Linien mit Farbe aus einem
 * fertigen PDF (pdfjs-dist, echtes Dokument). Alle Maße in mm, Ursprung oben links, Größe der Schrift in pt.
 * Nur für Tests. Ein Fehler in der Umrechnung (pt → mm) würde jeden Maßtest falsch machen; der Selbsttest
 * `pdfjsLayout.test.ts` prüft deshalb ein Mini-PDF mit bekannten Maßen.
 */
import { fileURLToPath } from 'node:url';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const MM_PER_PT = 25.4 / 72;
/** Standardschriften von pdfjs (Helvetica ist im Mini-PDF nicht eingebettet). */
const STANDARD_FONTS = fileURLToPath(new URL('../../../../node_modules/pdfjs-dist/standard_fonts/', import.meta.url));
const OPS = pdfjs.OPS;

export interface LayoutText {
  str: string; x: number; y: number; size: number; bold: boolean; /** Breite des Textstücks in mm. */ w: number;
  /** Kennung der Schrift in pdfjs. Die eingebetteten Schnitte tragen denselben Namen; `bold` trifft sie nicht, die Kennung unterscheidet sie. */
  font: string;
}
export interface LayoutRect { x: number; y: number; w: number; h: number; fill?: string; stroke?: string }
export interface LayoutLine { x1: number; y1: number; x2: number; y2: number; width: number; color: string }
/** Eine Seite: Text, Rechtecke, Linien und alle im Inhalt gesetzten Farben (hex, auch für Text). */
export interface LayoutPage { texts: LayoutText[]; rects: LayoutRect[]; lines: LayoutLine[]; colors: string[] }
export interface Box { x: number; y: number; w: number; h: number }

type Matrix = [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

function mul(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[1] * n[2], m[0] * n[1] + m[1] * n[3],
    m[2] * n[0] + m[3] * n[2], m[2] * n[1] + m[3] * n[3],
    m[4] * n[0] + m[5] * n[2] + n[4], m[4] * n[1] + m[5] * n[3] + n[5],
  ];
}

function colorOf(args: unknown[]): string {
  if (typeof args[0] === 'string') {return args[0];}
  const [r, g, b] = args as number[];
  const hex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

interface PathSeg { op: 'm' | 'l' | 'c' | 'z'; pts: number[] }

/** pdfjs v6 Pfadformat: Code 0 = moveTo, 1 = lineTo (je 2 Werte), 2 = curveTo (6), 3 = quadratisch (4), 4 = close. */
function parsePath(raw: ArrayLike<number> | Record<number, number>): PathSeg[] {
  // pdfjs liefert die Daten als Objekt mit numerischen Schlüsseln (ohne length); Object.values behält die Reihenfolge.
  const data = Object.values(raw);
  const out: PathSeg[] = [];
  let i = 0;
  while (i < data.length) {
    const code = data[i++];
    if (code === 0 || code === 1) {
      out.push({ op: code === 0 ? 'm' : 'l', pts: [data[i] ?? 0, data[i + 1] ?? 0] });
      i += 2;
    } else if (code === 2) {
      out.push({ op: 'c', pts: [data[i + 4] ?? 0, data[i + 5] ?? 0] });
      i += 6;
    } else if (code === 3) {
      out.push({ op: 'c', pts: [data[i + 2] ?? 0, data[i + 3] ?? 0] });
      i += 4;
    } else if (code === 4) {
      out.push({ op: 'z', pts: [] });
    } else {
      break;
    }
  }
  return out;
}

/** Eine Seite lesen: Text aus `getTextContent`, Pfade aus `getOperatorList` mit CTM-Verfolgung (Stapel für save/restore). */
async function readPage(page: pdfjs.PDFPageProxy): Promise<LayoutPage> {
  const viewport = page.getViewport({ scale: 1 });
  const h = viewport.height;
  const toMm = (x: number, y: number) => ({ x: x * MM_PER_PT, y: (h - y) * MM_PER_PT });
  const ops = await page.getOperatorList();
  const rects: LayoutRect[] = [];
  const lines: LayoutLine[] = [];
  const colors = new Set<string>();
  const stack: Array<{ ctm: Matrix; fill: string; stroke: string; lw: number }> = [];
  let ctm: Matrix = IDENTITY;
  let fill = '#000000';
  let stroke = '#000000';
  let lw = 1;
  let path: PathSeg[] = [];

  const apply = (x: number, y: number): [number, number] => [ctm[0] * x + ctm[2] * y + ctm[4], ctm[1] * x + ctm[3] * y + ctm[5]];

  /** Malt den aktuellen Pfad (Füllung als Rechteck über die Umrandung, Strich als Linien) und leert ihn. */
  const paintPath = (paintOp: number): void => {
    const paint = paintOp;
    const filled = [OPS.fill, OPS.eoFill, OPS.fillStroke, OPS.eoFillStroke, OPS.closeFillStroke].includes(paint);
    const stroked = [OPS.stroke, OPS.fillStroke, OPS.eoFillStroke, OPS.closeFillStroke, OPS.closeStroke].includes(paint);
    const pts = path.filter(seg => seg.op !== 'z').map(seg => apply(seg.pts[0], seg.pts[1]));
    if (filled && pts.length > 0) {
      const xs = pts.map(q => q[0]);
      const ys = pts.map(q => q[1]);
      const a = toMm(Math.min(...xs), Math.max(...ys));
      const b = toMm(Math.max(...xs), Math.min(...ys));
      rects.push({ x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y, fill });
    }
    if (stroked) {
      path.forEach((seg, k) => {
        if (seg.op === 'l' && k > 0 && path[k - 1]?.op !== 'z') {
          const [ax, ay] = apply(path[k - 1].pts[0], path[k - 1].pts[1]);
          const [bx, by] = apply(seg.pts[0], seg.pts[1]);
          const p = toMm(ax, ay);
          const q = toMm(bx, by);
          lines.push({ x1: p.x, y1: p.y, x2: q.x, y2: q.y, width: lw * Math.hypot(ctm[0], ctm[1]) * MM_PER_PT, color: stroke });
        }
      });
    }
    path = [];
  };

  ops.fnArray.forEach((fn, i) => {
    const args = ops.argsArray[i] as unknown[];
    switch (fn) {
      case OPS.save: stack.push({ ctm, fill, stroke, lw }); break;
      case OPS.restore: { const s = stack.pop(); if (s) {({ ctm, fill, stroke, lw } = s);} break; }
      case OPS.transform: ctm = mul(args as Matrix, ctm); break;
      case OPS.setFillRGBColor: fill = colorOf(args); colors.add(fill); break;
      case OPS.setStrokeRGBColor: stroke = colorOf(args); colors.add(stroke); break;
      case OPS.setLineWidth: lw = args[0] as number; break;
      case OPS.constructPath: {
        // pdfjs v6: [paintOp, [pathData], [bbox]]
        path = parsePath((args[1] as Array<Record<number, number>>)[0] ?? {});
        paintPath(args[0] as number);
        break;
      }
      case OPS.fill: case OPS.eoFill: case OPS.fillStroke: case OPS.eoFillStroke: case OPS.closeFillStroke:
      case OPS.stroke: case OPS.closeStroke: case OPS.endPath:
        paintPath(fn);
        break;
      default: break;
    }
  });

  const content = await page.getTextContent();
  const texts: LayoutText[] = [];
  for (const item of content.items) {
    if (!('str' in item) || item.str === '') {continue;}
    const t = item.transform;
    const p = toMm(t[4], t[5]);
    const name = (page.commonObjs.has(item.fontName) ? page.commonObjs.get(item.fontName)?.name : '') ?? '';
    texts.push({ str: item.str, x: p.x, y: p.y, size: Math.hypot(t[0], t[1]), bold: /bold/i.test(name), w: item.width * MM_PER_PT, font: item.fontName });
  }
  return { texts, rects, lines, colors: [...colors].sort() };
}

/** Alle Seiten eines PDFs (Bytes). Die Bytes werden kopiert, pdfjs übergibt sie an den Worker. */
export async function readLayout(bytes: Uint8Array): Promise<LayoutPage[]> {
  const doc = await pdfjs.getDocument({ data: bytes.slice(), useSystemFonts: false, standardFontDataUrl: STANDARD_FONTS }).promise;
  const pages: LayoutPage[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    pages.push(await readPage(await doc.getPage(n)));
  }
  return pages;
}

const inside = (b: Box, r: Box, tol = 0.05): boolean =>
  b.x >= r.x - tol && b.y >= r.y - tol && b.x + b.w <= r.x + r.w + tol && b.y + b.h <= r.y + r.h + tol;

/** Textstücke, deren Ursprung in `box` liegt. */
export function textIn(page: LayoutPage, box: Box): LayoutText[] {
  return page.texts.filter(t => t.x >= box.x && t.x <= box.x + box.w && t.y >= box.y && t.y <= box.y + box.h);
}

/** Rechtecke, die ganz in `box` liegen. */
export function rectsIn(page: LayoutPage, box: Box): LayoutRect[] {
  return page.rects.filter(r => inside(r, box));
}

/** Alle verwendeten Füll- und Strichfarben einer Seite (hex). */
export function colorsUsed(page: LayoutPage): string[] {
  const set = new Set<string>();
  page.rects.forEach(r => { if (r.fill) {set.add(r.fill.toLowerCase());} });
  page.lines.forEach(l => set.add(l.color.toLowerCase()));
  return [...set].sort();
}
