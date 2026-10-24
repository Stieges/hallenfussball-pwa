/**
 * ClockDigits – die Uhr „m:ss“ mit dem Doppelpunkt auf einer festen Achse (@SL-179, Entscheidung Daniel 24.10.: „Doppelpunkte in einer
 * vertikalen Linie“). Die Minuten stehen rechtsbündig links vom Doppelpunkt, die Sekunden linksbündig rechts davon; der Doppelpunkt liegt
 * damit immer in der Mitte der Breite, auch bei „9:26“ und „12:05“. Steht der Baustein unter den beiden Ergebniskästen über deren ganze
 * Breite, liegt sein Doppelpunkt senkrecht unter dem Doppelpunkt zwischen den Kästen. Ziffern gleich breit; Größe, Farbe und Schrift erbt
 * oder setzt der Aufrufer (`style`). Trägt `data-ziffern="uhr"` für die Messung `cockpit.ziffern`. Texte ohne „m:ss“ erscheinen unverändert.
 */
import type { CSSProperties, ReactElement } from 'react';

export interface ClockDigitsProps {
  /** „9:26“ oder „12:05“ */
  text: string;
  testId?: string;
  style?: CSSProperties;
}

const MINUTEN_SEKUNDEN = /^(\d+):(\d+)$/;

export function ClockDigits({ text, testId, style }: ClockDigitsProps): ReactElement {
  const treffer = MINUTEN_SEKUNDEN.exec(text);
  if (treffer === null) {
    return <div data-testid={testId} data-ziffern="uhr" style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', ...style }}>{text}</div>;
  }
  return (
    <div
      data-testid={testId} data-ziffern="uhr" data-uhr-achse=""
      style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)', alignItems: 'baseline', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', ...style }}
    >
      <span style={{ justifySelf: 'end' }}>{treffer[1]}</span>
      <span data-testid={testId === undefined ? undefined : `${testId}-colon`}>:</span>
      <span style={{ justifySelf: 'start' }}>{treffer[2]}</span>
    </div>
  );
}
