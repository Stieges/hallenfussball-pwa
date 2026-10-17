/**
 * Zähl-Helfer des Wächters für Bedien-Ränder (B-51, @OB-055, @OB-057).
 *
 * Ein Bedienelement (Knopf, Eingabefeld, Auswahl, Chip, Schalter …) zeichnet seinen Rand mit
 * `colors.borderControl`. Die Trennlinien-Tokens (`border`, `borderDefault`, `borderMedium`,
 * `borderSolid`, `borderSubtle`) liegen unter 3 : 1 und gehören nur an dekorative Ränder.
 * Reine Textfunktionen, damit die Erkennung mit Gegenbeispielen geprüft werden kann.
 */

/** Trennlinien-Tokens (dekorativ, bewusst unter 3 : 1). */
export const DIVIDER_TOKEN = /colors\.(?:border|borderDefault|borderMedium|borderSolid|borderSubtle)\b(?!\w)/;

/** Namen von Stil-Objekten, die ein Bedienelement beschreiben. */
const CONTROL_NAME = /(input|select|textarea|button|btn|chip|toggle|option|segment|swatch|dropzone|trigger|radio|stepper|reset|slidetype)/i;

const CONTROL_TAG = /<(?:button|input|select|textarea)\b/;

export interface BorderHit {
  line: number;
  head: string;
  text: string;
}

/** Zeile des öffnenden `{` des Blocks, in dem Zeile `index` liegt (höchstens 40 Zeilen zurück). */
function blockStart(lines: string[], index: number): number {
  let depth = 0;
  for (let k = index; k >= Math.max(0, index - 40); k -= 1) {
    const opens = (lines[k].match(/\{/g) ?? []).length;
    const closes = (lines[k].match(/\}/g) ?? []).length;
    depth += closes - opens;
    if (k < index && depth < 0) {return k;}
  }
  return index;
}

/** Ein Bedien-Element mit Trennlinien-Token als Rand: Treffer je Zeile. */
export function findControlDividerBorders(source: string): BorderHit[] {
  const lines = source.split('\n');
  const hits: BorderHit[] = [];
  lines.forEach((text, i) => {
    if (!DIVIDER_TOKEN.test(text)) {return;}
    // Nur Ränder: Zeilen für Hintergrund/Verlauf/Scrollbar sind keine Randzeichnung.
    if (/background|gradient|webkit|boxShadow/i.test(text) && !/border[A-Za-z]*\s*[:=]/.test(text)) {return;}
    const start = blockStart(lines, i);
    const head = lines[start].trim();
    const near = lines.slice(Math.max(0, start - 8), i + 1).join('\n');
    const sameLineTag = CONTROL_TAG.test(text);
    const inlineStyle = /^(?:<\w+\s+)?style=\{\{|onBlur|onMouse|onFocus/.test(head) || /^<\w+\s+style=\{\{/.test(head);
    const byName = !inlineStyle && CONTROL_NAME.test(head);
    const byTag = (inlineStyle || sameLineTag) && CONTROL_TAG.test(near);
    if (byName || byTag || sameLineTag) {hits.push({ line: i + 1, head: head.slice(0, 60), text: text.trim().slice(0, 100) });}
  });
  return hits;
}

/** Feste Farbwerte (Hex, rgb/rgba) in einer Randzeile eines Bedien-Elements. Nur Token-Namen sind erlaubt. */
export function findLiteralControlBorders(source: string): BorderHit[] {
  const lines = source.split('\n');
  const hits: BorderHit[] = [];
  lines.forEach((text, i) => {
    if (!/border(?:Color|Top|Bottom|Left|Right)?\s*:/.test(text) || !/(#[0-9a-fA-F]{3,8}\b|rgba?\()/.test(text)) {return;}
    const start = blockStart(lines, i);
    const head = lines[start].trim();
    const near = lines.slice(Math.max(0, start - 8), i + 1).join('\n');
    if (CONTROL_NAME.test(head) || CONTROL_TAG.test(near) || CONTROL_TAG.test(text)) {
      hits.push({ line: i + 1, head: head.slice(0, 60), text: text.trim().slice(0, 100) });
    }
  });
  return hits;
}
