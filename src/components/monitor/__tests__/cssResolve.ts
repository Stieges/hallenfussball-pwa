/**
 * Testhilfe: löst die einfachen CSS-Ausdrücke der Anzeige-Tokens (px, vw, vh, cqw, cqh, %, clamp, min) in Pixel auf.
 * So rechnen die Layout-Tests pro Auflösung mit den echten Token-Werten, nicht mit Testwerten.
 */
export interface CssContext { vw: number; vh: number; cqw?: number; cqh?: number; percentOf?: number }

function splitTop(args: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of args) {
    if (ch === '(') { depth++; }
    if (ch === ')') { depth--; }
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else { cur += ch; }
  }
  out.push(cur.trim());
  return out;
}

export function resolveCss(expr: string, ctx: CssContext): number {
  const e = expr.trim();
  const fn = /^(clamp|min|max)\((.*)\)$/.exec(e);
  if (fn) {
    const a = splitTop(fn[2]).map(x => resolveCss(x, ctx));
    if (fn[1] === 'min') { return Math.min(...a); }
    if (fn[1] === 'max') { return Math.max(...a); }
    return Math.min(Math.max(a[1], a[0]), a[2]);
  }
  const m = /^(-?[\d.]+)(px|vw|vh|cqw|cqh|%)$/.exec(e);
  if (!m) { throw new Error(`nicht auflösbar: ${expr}`); }
  const n = parseFloat(m[1]);
  switch (m[2]) {
    case 'px': return n;
    case 'vw': return (n / 100) * ctx.vw;
    case 'vh': return (n / 100) * ctx.vh;
    case 'cqw': return (n / 100) * (ctx.cqw ?? ctx.vw);
    case 'cqh': return (n / 100) * (ctx.cqh ?? ctx.vh);
    default: return (n / 100) * (ctx.percentOf ?? 0);
  }
}

export const RESOLUTIONS = [
  { w: 1280, h: 720 }, { w: 1920, h: 1080 }, { w: 2560, h: 1440 }, { w: 3840, h: 2160 },
] as const;
