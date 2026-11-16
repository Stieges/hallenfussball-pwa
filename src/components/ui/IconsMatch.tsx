import type { ReactElement, ReactNode } from 'react';

/**
 * Symbole des Live-Cockpits (Plan Scheibe 3, Aufgabe 3.1): Daumenleiste, Spalten, Blätter.
 * Eigene Datei wie `IconsTafel.tsx`, weil `Icons.tsx` an der Zeilengrenze steht. Stil wie dort:
 * Linien in `currentColor`, viewBox 0 0 24 24, dekorativ (`aria-hidden`). Die Formen stammen aus den
 * `<symbol>`-Definitionen des freigegebenen Laptop-Mockups.
 */
interface IconProps {
  size?: number | string;
}

const DEFAULT_SIZE = 20;

function icon(inhalt: ReactNode, strichBreite = 2) {
  const Symbol = ({ size = DEFAULT_SIZE }: IconProps): ReactElement => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strichBreite}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {inhalt}
    </svg>
  );
  return Symbol;
}

export const MatchIcons = {
  /** Ball „G“ (freigegeben 16.11.): Kreis mit Strich plus gefüllte Felder (Mittelfeld und fünf Randfelder, am Kreis r 8,2 beschnitten, ohne Nähte) –
   *  bewusst teilweise gefüllt, die dritte Ausnahme vom reinen Linienstil neben Karte und Live-Punkt. Die Randfelder sind fertige Pfade (kein
   *  clipPath), damit das Symbol mehrfach auf einer Seite stehen kann, ohne doppelte Kennungen. */
  Ball: icon(<><circle cx="12" cy="12" r="9" /><path d="M12 8.7L15.14 10.98L13.94 14.67L10.06 14.67L8.86 10.98zM12 3.8L12.43 3.81L12.86 3.84L13.28 3.9L13.7 3.98L14.12 4.08L14.53 4.2L14.68 4.25L12 6.2L9.32 4.25L9.47 4.2L9.88 4.08L10.3 3.98L10.72 3.9L11.14 3.84L11.57 3.81zM18.63 7.18L18.88 7.53L19.1 7.9L19.31 8.28L19.49 8.66L19.66 9.06L19.8 9.47L19.92 9.88L20.02 10.3L20.1 10.72L20.16 11.14L20.19 11.57L20.2 12L20.2 12.16L17.52 10.21L18.54 7.05zM16.47 18.88L16.1 19.1L15.72 19.31L15.34 19.49L14.94 19.66L14.53 19.8L14.39 19.84L15.41 16.69L18.72 16.69L18.63 16.82L18.37 17.16L18.09 17.49L17.8 17.8L17.49 18.09L17.16 18.37L16.82 18.63zM6.84 18.37L6.51 18.09L6.2 17.8L5.91 17.49L5.63 17.16L5.37 16.82L5.28 16.69L8.59 16.69L9.61 19.84L9.47 19.8L9.06 19.66L8.66 19.49L8.28 19.31L7.9 19.1L7.53 18.88L7.18 18.63zM4.34 9.06L4.51 8.66L4.69 8.28L4.9 7.9L5.12 7.53L5.37 7.18L5.46 7.05L6.48 10.21L3.8 12.16L3.8 12L3.81 11.57L3.84 11.14L3.9 10.72L3.98 10.3L4.08 9.88L4.2 9.47z" fill="currentColor" stroke="none" /></>),
  Flag: icon(<path d="M5 21V4M5 4h11l-2 4 2 4H5" />),
  Stopwatch: icon(<><circle cx="12" cy="13.5" r="7.5" /><path d="M12 9.5v4l2.5 1.5M9.5 3h5" /></>),
  Card: icon(<rect x="7" y="3" width="10" height="18" rx="2" />),
  Undo: icon(<path d="M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3" />),
  Pause: icon(<path d="M8 5v14M16 5v14" />),
  Play: icon(<path d="M7 4.5l12 7.5-12 7.5z" />),
  Whistle: icon(<><circle cx="8" cy="15" r="5" /><path d="M12 11.5L21 9v4.5l-6 1.5M8 10V6" /></>),
  More: icon(<path d="M5 12h.01M12 12h.01M19 12h.01" />, 3.5),
  List: icon(<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />, 2.5),
  Edit: icon(<path d="M4 20l4-1 11-11-3-3L5 16z" />),
  Check: icon(<path d="M5 13l4 4L19 7" />),
  Shirt: icon(<path d="M8 3L3 7l3 3 2-1v12h8V9l2 1 3-3-5-4a4 4 0 01-8 0z" />),
  Calendar: icon(<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>),
} as const;
