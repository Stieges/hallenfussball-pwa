/**
 * Symbole für den Hallenmonitor (@OB-038, @ZM-215). Kräftiger als die Linien-Symbole der Oberfläche, weil sie aus der Hallentiefe gelesen werden:
 * die Pause aus zwei gefüllten Balken, die Zustands-Symbole der Live-Sichten (halber Kreis, Pfeife, Kreis mit Plus, Uhr, Spielfeld) als Linien der Stärke 2,6.
 * Sie erben die Textfarbe, viewBox 24, dekorativ (`aria-hidden`).
 */
interface IconProps {
  size?: number | string;
}

export const MonitorIcons = {
  /** Pause: zwei breite, gefüllte Balken mit runden Ecken (wie auf einer Fernbedienung), ohne Kreis */
  Pause: ({ size = 20 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">
      <rect x="4.5" y="3.5" width="6" height="17" rx="2.2" />
      <rect x="13.5" y="3.5" width="6" height="17" rx="2.2" />
    </svg>
  ),
  /** Halbzeitpause (@ZM-215): Kreis, rechte Hälfte gefüllt */
  HalfCircle: ({ size = 20 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.6" />
      <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" />
    </svg>
  ),
  /** Pfeife (@ZM-215): Zeit abgelaufen, Abpfiff fällig */
  Whistle: ({ size = 20 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 10h11a5 5 0 1 1-4.9 6H5a3 3 0 0 1-3-3z" />
      <path d="M13 10V6h8" />
      <circle cx="13" cy="15" r="1.5" fill="currentColor" />
    </svg>
  ),
  /** Verlängerung (@ZM-215): Kreis mit Plus */
  PlusCircle: ({ size = 20 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v9M7.5 12h9" />
    </svg>
  ),
  /** Uhr (@ZM-215): Anstoßzeit vor dem Anpfiff */
  Clock: ({ size = 20 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  /** Spielfeld von oben (@ZM-215): Feld in der Kopfzeile bzw. im Uhrband */
  Pitch: ({ size = 20 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true">
      <rect x="2" y="5" width="20" height="14" rx="1.5" />
      <path d="M12 5v14" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  ),
} as const;
