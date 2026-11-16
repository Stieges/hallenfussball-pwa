/**
 * Symbole für den Hallenmonitor (@OB-038). Anders als die Linien-Symbole der Oberfläche gefüllt und kräftig,
 * weil sie aus der Hallentiefe gelesen werden (Monitor: gefüllt und kräftig, weil aus der Hallentiefe gelesen). Sie erben die Textfarbe,
 * viewBox 24, dekorativ (`aria-hidden`).
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
} as const;
