/** Symbole der Gruppe „Aktionen und Bearbeiten“ (aus `Icons.tsx` aufgeteilt, Form und Name unverändert). */
import type { IconProps } from './iconProps';

export const iconsAktion = {
  Plus: ({ size = 20, color = 'currentColor' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M10 4v12m-6-6h12" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),

  Edit: ({ size = 20, color = 'currentColor' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M14 2l4 4-10 10H4v-4L14 2z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),

  Trash: ({ size = 20, color = 'currentColor' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M3 5h14M8 5V3h4v2m-5 4v6m4-6v6M5 5l1 11h8l1-11" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),

  Check: ({ size = 20, color = 'currentColor' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M16 6L8 14l-4-4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),

  /** B-26: Minus (eine Minute weniger) */
  Minus: ({ size = 20, color = 'currentColor' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M4 10h12" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),

  X: ({ size = 20, color = 'currentColor' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M15 5L5 15M5 5l10 10" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),

  Copy: ({ size = 20, color = 'currentColor' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <rect x="7" y="7" width="10" height="10" rx="2" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 13V5a2 2 0 012-2h8" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),

  Save: ({ size = 20, color = 'currentColor' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M5 2h8l4 4v11a1 1 0 01-1 1H5a1 1 0 01-1-1V3a1 1 0 011-1z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 2v5h6V2M7 18v-5h6v5" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),

  Download: ({ size = 20, color = 'currentColor' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M10 3v10m0 0l-4-4m4 4l4-4M3 17h14" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),

  Upload: ({ size = 20, color = 'currentColor' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M10 13V3m0 0L6 7m4-4l4 4M3 17h14" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),

  Share: ({ size = 20, color = 'currentColor' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <circle cx="15" cy="5" r="3" stroke={color} strokeWidth="2" />
      <circle cx="5" cy="10" r="3" stroke={color} strokeWidth="2" />
      <circle cx="15" cy="15" r="3" stroke={color} strokeWidth="2" />
      <path d="M7.5 11.5l5 2M7.5 8.5l5-2" stroke={color} strokeWidth="2" />
    </svg>
  ),

  /** Aktualisieren: offener Kreisbogen mit Pfeilspitze am Ende (Form wie „rotate-cw“ aus Feather, MIT); ersetzt die frühere Uhr (@OB-038). */
  Refresh: ({ size = 20, color = 'currentColor' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
      <path d="M23 4v6h-6" />
    </svg>
  ),

  Restore: ({ size = 20, color = 'currentColor' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M3 10a7 7 0 0114 0 7 7 0 01-14 0z" stroke={color} strokeWidth="2" />
      <path d="M3 3v4h4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 7a7 7 0 0112.95 3.67" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),

  Archive: ({ size = 20, color = 'currentColor' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <rect x="2" y="3" width="16" height="4" rx="1" stroke={color} strokeWidth="2" />
      <path d="M3 7v9a1 1 0 001 1h12a1 1 0 001-1V7" stroke={color} strokeWidth="2" />
      <path d="M8 11h4" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),

  /** B-26: Drucker (Neu drucken) */
  Printer: ({ size = 20, color = 'currentColor' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M6 7V3h8v4M6 14H4a1 1 0 01-1-1V8a1 1 0 011-1h12a1 1 0 011 1v5a1 1 0 01-1 1h-2M6 12h8v5H6z" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  ),

  Search: ({ size = 20, color = 'currentColor' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <circle cx="9" cy="9" r="6" stroke={color} strokeWidth="2" />
      <path d="M13.5 13.5L17 17" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),

  Filter: ({ size = 20, color = 'currentColor' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M2 4h16M5 10h10M8 16h4" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),

  /** Einstellungen: Zahnrad mit 8 breiten, flachen Zähnen und Loch in der Mitte (ersetzt den Strahlenkranz, der wie eine Sonne wirkte, @OB-038). */
  Settings: ({ size = 20, color = 'currentColor' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.47 5.37L10.56 2.91L13.44 2.91L13.53 5.37L15.60 6.23L17.41 4.56L19.44 6.59L17.77 8.40L18.63 10.47L21.09 10.56L21.09 13.44L18.63 13.53L17.77 15.60L19.44 17.41L17.41 19.44L15.60 17.77L13.53 18.63L13.44 21.09L10.56 21.09L10.47 18.63L8.40 17.77L6.59 19.44L4.56 17.41L6.23 15.60L5.37 13.53L2.91 13.44L2.91 10.56L5.37 10.47L6.23 8.40L4.56 6.59L6.59 4.56L8.40 6.23z" />
      <circle cx="12" cy="12" r="2.8" />
    </svg>
  ),

  Eye: ({ size = 20, color = 'currentColor' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M1 10s3-6 9-6 9 6 9 6-3 6-9 6-9-6-9-6z" stroke={color} strokeWidth="2" />
      <circle cx="10" cy="10" r="3" stroke={color} strokeWidth="2" />
    </svg>
  ),

  /** B-26: Schloss (gesperrte Einstellung, @ZP-095) */
  Lock: ({ size = 20, color = 'currentColor' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <rect x="4" y="9" width="12" height="8" rx="1.5" stroke={color} strokeWidth="2" />
      <path d="M7 9V6.5a3 3 0 016 0V9" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
};
