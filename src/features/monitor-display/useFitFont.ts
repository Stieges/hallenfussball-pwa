/**
 * Passt die Zeilenschrift einer Tabelle nach dem Zeichnen an die freie Bildhöhe an (@ZM-125, @ZM-129, @ZM-087): Das Höhenmodell
 * (`standingsFit.ts`) liefert den Startwert aus den Namen der Daten; ragt die gezeichnete Tabelle trotzdem unter den Bildrand (längerer Inhalt,
 * Umbruch anders als gerechnet), wird die Schrift nach dem Verhältnis von freier zu benötigter Höhe verkleinert (wenige Schritte), höchstens bis zur harten Untergrenze von 3 % der Bildhöhe.
 * Sie wächst nie über den Startwert (kein Hin und Her). Ändert sich der Startwert (andere Daten), beginnt die Anpassung von vorn.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { RefObject } from 'react';

/** Sicherheitsfaktor beim Verkleinern nach Verhältnis (die Höhe wächst nicht ganz linear mit der Schrift). */
const SAFETY = 0.97;
/** Kleinster Schritt in vh, damit die Schleife sicher endet. */
const MIN_STEP_VH = 0.1;
/** Toleranz in Bildpunkten (Rundung). */
const TOLERANCE_PX = 0.5;

interface FitFont {
  ref: RefObject<HTMLDivElement | null>;
  /** Zeilenschrift als CSS-Wert in vh */
  fontSize: string;
}

export function useFitFont(startVh: number, minVh: number, overscanPercent: number): FitFont {
  const ref = useRef<HTMLDivElement>(null);
  const [fitted, setFitted] = useState({ start: startVh, font: startVh });
  const font = fitted.start === startVh ? fitted.font : startVh;

  const check = useCallback((sofort: boolean) => {
    const element = ref.current;
    if (element === null) { return; }
    const limit = window.innerHeight * (1 - overscanPercent / 100);
    const box = element.getBoundingClientRect();
    if (box.bottom > limit + TOLERANCE_PX && font > minVh) {
      // Die Höhe wächst fast linear mit der Schrift: nach Verhältnis verkleinern, so endet die Anpassung in wenigen Schritten
      const ratio = Math.max(0, (limit - box.top) / box.height);
      const next = { start: startVh, font: Math.max(minVh, Math.min(font - MIN_STEP_VH, font * ratio * SAFETY)) };
      // aus dem Beobachter heraus sofort zeichnen: sonst steht die zu große Tabelle noch einen Takt im Bild
      if (sofort) { flushSync(() => { setFitted(next); }); } else { setFitted(next); }
    }
  }, [font, minVh, overscanPercent, startVh]);

  // nach jedem Zeichnen prüfen (die Schleife endet, sobald die Tabelle passt oder die Untergrenze erreicht ist)
  useLayoutEffect(() => { check(false); });

  // auch wenn sich die Größe später ändert (Schrift geladen, Inhalt geändert)
  useEffect(() => {
    const element = ref.current;
    if (element === null || typeof ResizeObserver === 'undefined') { return undefined; }
    const observer = new ResizeObserver(() => { check(true); });
    observer.observe(element);
    return () => { observer.disconnect(); };
  }, [check]);

  return { ref, fontSize: `${String(Math.round(font * 100) / 100)}vh` };
}
