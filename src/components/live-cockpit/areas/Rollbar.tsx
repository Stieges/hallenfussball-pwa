/**
 * Rollbar – eine Fläche des Cockpits, die bei zu wenig Höhe rollt, ist mit der Tastatur erreichbar (axe `scrollable-region-focusable`, WCAG 2.1.1):
 * nur solange sie wirklich rollt, bekommt sie einen Tabstopp (`tabIndex=0`), sonst bleibt die Tab-Reihenfolge wie bisher. Hintergrund: die Leibchen-Karte
 * macht den Inhalt höher (Karte über „Anpfeifen“ bzw. „Weiter“), dort rollt die Fläche in engen Fenstern.
 */
import { createElement, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';

/** Ab so vielen Bildpunkten Überhang (halber Text am Rand) endet die Fläche unten mit einer weichen Kante (`data-rollt-viel`), darunter genügt der Tabstopp. */
const UEBERHANG_VIEL = 8;

export interface RollbarProps {
  /** Ausgabe-Element */
  als: 'main' | 'div';
  className?: string;
  children?: ReactNode;
  testId?: string;
}

export function Rollbar({ als, className, children, testId }: RollbarProps): ReactElement {
  const ref = useRef<HTMLElement>(null);
  const [rollt, setRollt] = useState(false);
  const [viel, setViel] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el === null) { return undefined; }
    const messen = (): void => { setRollt(el.scrollHeight > el.clientHeight + 1); setViel(el.scrollHeight > el.clientHeight + UEBERHANG_VIEL); };
    messen();
    const groesse = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(messen);
    groesse?.observe(el);
    const inhalt = typeof MutationObserver === 'undefined' ? null : new MutationObserver(messen);
    inhalt?.observe(el, { childList: true, subtree: true, attributes: true });
    return () => { groesse?.disconnect(); inhalt?.disconnect(); };
  }, []);
  return createElement(als, { ref, className, 'data-testid': testId, 'data-rollt': rollt ? 'true' : undefined, 'data-rollt-viel': viel ? 'true' : undefined, tabIndex: rollt ? 0 : undefined }, children);
}
