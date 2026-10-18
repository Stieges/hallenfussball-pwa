/**
 * Symbole der Anzeigetafel (Cockpit 2.4): Sperre, Ton aus, Pause.
 * Eigene Datei, weil `Icons.tsx` an der Zeilengrenze steht; die Match-Symbole der Daumenleiste (Aufgabe 3.1)
 * kommen in `IconsMatch.tsx`. Stil wie `Icons` (Linien in `currentColor`).
 */
interface IconProps {
  size?: number | string;
}

export const TafelIcons = {
  Lock: ({ size = 20 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 018 0v3" />
    </svg>
  ),
  VolumeOff: ({ size = 20 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 9v6h4l5 4V5L8 9H4z" />
      <path d="M17 9l4 6M21 9l-4 6" />
    </svg>
  ),
  Pause: ({ size = 20 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M8 5v14M16 5v14" />
    </svg>
  ),
} as const;
