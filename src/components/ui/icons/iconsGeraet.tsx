/**
 * Symbole für Lautsprecher, Geräte und Zustände des Hallentons (H4-4). Stil wie `IconsMatch.tsx`: Linien, viewBox 24, Strichstärke 2,
 * dekorativ (`aria-hidden`); die Formen stammen aus dem freigegebenen Mockup „Hallenton“. Eigene Zeichen statt Emoji (🔈), weil
 * Emoji je Betriebssystem anders aussehen und die Farbe des Tons nicht annehmen.
 * `SpeakerOff` ähnelt `TafelIcons.VolumeOff` (IconsTafel.tsx, Anzeigetafel): das ist ein zweites Symbol, weil dieses hier zum Stil der Verwaltung gehört
 * (24er-Linien, nimmt `color`, passt zu den übrigen Zeichen dieser Datei); Tafel-Symbole bleiben der Tafel. Bitte kein drittes bauen.
 * Eine Uhr gibt es schon als `Icons.Clock`, Pfeile zum Wechseln als `Icons.ArrowRightLeft` (hier nur `Swap`, zwei Pfeile im Kreislauf).
 */
import type { ReactElement, ReactNode } from 'react';
import type { IconProps } from './iconProps';

function zeichen(inhalt: ReactNode) {
  const Zeichen = ({ size = 20, color = 'currentColor' }: IconProps): ReactElement => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {inhalt}
    </svg>
  );
  return Zeichen;
}

const KORPUS = <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />;
const FRAGE = <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />;

export const iconsGeraet = {
  /** Lautsprecher mit Schallwellen (bereit) */
  Speaker: zeichen(<>{KORPUS}<path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /></>),
  /** Lautsprecher mit einer Welle (leise: das Zeichen 🔈 aus „🔈? Prüfen“) */
  SpeakerLow: zeichen(<>{KORPUS}<path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></>),
  /** Lautsprecher durchgestrichen (nicht bereit) */
  SpeakerOff: zeichen(<>{KORPUS}<line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></>),
  /** Handy (Gerät, das als Hallen-Lautsprecher dient; Laptop und Monitor: `Laptop`, `Icons.Monitor`) */
  Phone: zeichen(<><rect x="5" y="2" width="14" height="20" rx="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></>),
  /** Lautsprecher mit „?“ an der Stelle der Wellen: ein Zeichen für „🔈? Prüfen“ (Ausgang eventuell geändert, @HT-047) */
  SpeakerQuestion: zeichen(<>{KORPUS}<path d="M14.5 9a3.5 3.5 0 0 1 6.8 1.2c0 2.3-3.4 2.8-3.4 5" /><line x1="17.9" y1="19" x2="17.91" y2="19" /></>),
  /** Haken im Kreis (bereit) */
  CheckCircle: zeichen(<><circle cx="12" cy="12" r="10" /><polyline points="8 12.5 11 15.5 16 9" /></>),
  /** Minus im Kreis (kein Hallen-Lautsprecher, neutral) */
  MinusCircle: zeichen(<><circle cx="12" cy="12" r="10" /><line x1="8" y1="12" x2="16" y2="12" /></>),
  Laptop: zeichen(<><rect x="3" y="4" width="18" height="12" rx="2" /><line x1="2" y1="20" x2="22" y2="20" /></>),
  /** Mond (der Browser hat den Lautsprecher schlafen gelegt) */
  Moon: zeichen(<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />),
  /** Fragezeichen ohne Kreis (zum Zusammensetzen, z. B. mit `SpeakerLow`) */
  QuestionMark: zeichen(<>{FRAGE}<line x1="12" y1="17" x2="12.01" y2="17" /></>),
  /** Fragezeichen im Kreis (Status unbekannt) */
  HelpCircle: zeichen(<><circle cx="12" cy="12" r="10" />{FRAGE}<line x1="12" y1="17" x2="12.01" y2="17" /></>),
  /** Zwei Pfeile im Kreislauf (von einem anderen Gerät übernommen) */
  Swap: zeichen(<><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></>),
};
