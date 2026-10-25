/**
 * Wörter mit Bindestrich („Rot-Weiß“, „Kleinstadt-Neudorf“) brechen in Tasten und Überschriften nie auf zwei Zeilen um (Grenzwert
 * `titel.wortbruch`, VISUAL-DESIGN § 2): jedes solche Wort steht in einem Element mit `white-space: nowrap`, Leerzeichen bleiben
 * Umbruchstellen. Der Text selbst bleibt unverändert – Kopieren, Suchen und Bildschirmleser sehen den Originalnamen (Review #395 m-1/C2).
 * Gilt zunächst nur im Abschluss-Bereich; Zuschauer-Seite und Monitor brauchen es mit R3-6/R3-7 ebenfalls.
 */
import type { CSSProperties } from 'react';

const NOWRAP: CSSProperties = { whiteSpace: 'nowrap' };
const WITH_HYPHEN = /\p{L}-\p{L}/u;

export function HyphenSafe({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\s+)/).map((part, index) => (WITH_HYPHEN.test(part) ? <span key={index} style={NOWRAP}>{part}</span> : part))}
    </>
  );
}

/** Ein Teamname: Markierung `data-teamname` für die Messung, Bindestrich-Wörter beisammen. */
export function TeamName({ name }: { name: string }) {
  return <span data-teamname><HyphenSafe text={name} /></span>;
}
