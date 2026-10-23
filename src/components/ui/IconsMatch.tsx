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
  Ball: icon(<><circle cx="12" cy="12" r="9" /><path d="M12 7.5l4 3-1.5 4.5h-5L8 10.5z" /></>),
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
