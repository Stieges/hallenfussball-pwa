/**
 * Teamnamen umbrechen nur an Leerzeichen und nach einem Schrägstrich, nie mitten im Wort (Messregel `titel.wortbruch`,
 * VISUAL-DESIGN § 2, @ZM-207, @OB-025): Wörter mit Bindestrich („Rot-Weiß“) stehen in einem Element mit `white-space: nowrap`,
 * nach einem Schrägstrich („SG Taching/Tengling“) steht eine Umbruchstelle (`<wbr>`; Chrome bricht von sich aus nicht nach „/“
 * zwischen Buchstaben und bräche dann „Ten-gling“ mitten im Wort). Der Text selbst bleibt unverändert – Kopieren, Suchen und
 * Bildschirmleser sehen den Originalnamen (`<wbr>` trägt keinen Text). Ein einzelnes Wort, das länger ist als die Zeile, bricht
 * über `overflow-wrap` des Aufrufers weiter an beliebiger Stelle um, statt überzulaufen.
 * Ein Baustein für alle Seiten (Spielplan, Tabelle, Monitor, Cockpit, Editor, Abschluss); `TeamName` trägt zusätzlich die
 * Markierung `data-teamname` für `npm run visual:metrics`.
 */
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { splitAfterSlash } from './teamNameBreaks';

const NOWRAP: CSSProperties = { whiteSpace: 'nowrap' };
const WITH_HYPHEN = /\p{L}-\p{L}/u;

/**
 * Knoten eines Namens: Text bleibt ein einziger Textknoten, solange nichts Besonderes passiert (wie vorher, Tests und Suche lesen ihn
 * zusammenhängend); nur nach einem Schrägstrich steht `<wbr>`, und ein Teil, für den `keep` gilt, steht in einem nowrap-Element.
 */
function nameNodes(text: string, keep: (piece: string) => boolean): ReactNode[] {
  const out: ReactNode[] = [];
  let buffer = '';
  const flush = () => {
    if (buffer !== '') { out.push(buffer); buffer = ''; }
  };
  text.split(/(\s+)/).forEach((part) => {
    if (part === '') { return; }
    if (/^\s+$/.test(part)) { buffer += part; return; }
    splitAfterSlash(part).forEach((piece, index) => {
      if (index > 0) { flush(); out.push(<wbr key={`wbr-${String(out.length)}`} />); }
      if (keep(piece)) { flush(); out.push(<span key={`keep-${String(out.length)}`} style={NOWRAP}>{piece}</span>); } else { buffer += piece; }
    });
  });
  flush();
  return out;
}

/** Nur die Umbruchstelle nach „/“ (für Monitor-Namen, die ihre Bindestrich-Wörter selbst steuern; `keep` wählt Teile ohne Umbruch): Text unverändert. */
export function SlashBreaks({ text, keep }: { text: string; keep?: (piece: string) => boolean }): ReactElement {
  return <>{nameNodes(text, keep ?? (() => false))}</>;
}

const keepHyphenWord = (piece: string): boolean => WITH_HYPHEN.test(piece);

/** Text eines Teamnamens (oder eines anderen Namens) mit den Umbruchregeln oben, ohne Markierung. */
export function HyphenSafe({ text }: { text: string }): ReactElement {
  return <SlashBreaks text={text} keep={keepHyphenWord} />;
}

/** Ein Teamname: Markierung `data-teamname` für die Messung, Umbruch wie oben. */
export function TeamName({ name }: { name: string }): ReactElement {
  return <span data-teamname><HyphenSafe text={name} /></span>;
}
