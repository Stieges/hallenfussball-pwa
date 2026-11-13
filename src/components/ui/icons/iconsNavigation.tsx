/** Symbole der Gruppe „Navigation, Konto und Ansichten“ (aus `Icons.tsx` aufgeteilt, Form und Name unverändert). */
import type { IconProps } from './iconProps';

export const iconsNavigation = {
  List: ({ size = 20, color = 'currentColor' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M3 5h14M3 10h14M3 15h10" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),

  BarChart: ({ size = 20, color = 'currentColor' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M3 17V9M8 17V5M13 17v-4M18 17V3" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),

  MoreHorizontal: ({ size = 20, color = 'currentColor' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <circle cx="4" cy="10" r="2" fill={color} />
      <circle cx="10" cy="10" r="2" fill={color} />
      <circle cx="16" cy="10" r="2" fill={color} />
    </svg>
  ),

  MoreVertical: ({ size = 20, color = 'currentColor' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="4" r="2" fill={color} />
      <circle cx="10" cy="10" r="2" fill={color} />
      <circle cx="10" cy="16" r="2" fill={color} />
    </svg>
  ),

  Users: ({ size = 20, color = 'currentColor' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <circle cx="7" cy="6" r="3" stroke={color} strokeWidth="2" />
      <path d="M1 17c0-3 2.5-5 6-5s6 2 6 5" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <circle cx="14" cy="6" r="2" stroke={color} strokeWidth="2" />
      <path d="M16 11c2 0 3 1.5 3 3" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),

  Monitor: ({ size = 20, color = 'currentColor' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <rect x="2" y="3" width="16" height="11" rx="2" stroke={color} strokeWidth="2" />
      <path d="M7 17h6M10 14v3" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),

  User: ({ size = 20, color = 'currentColor' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="6" r="4" stroke={color} strokeWidth="2" />
      <path d="M2 18c0-4 3-6 8-6s8 2 8 6" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),

  UserPlus: ({ size = 20, color = 'currentColor' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <circle cx="8" cy="6" r="3" stroke={color} strokeWidth="2" />
      <path d="M1 18c0-4 3-5 7-5s7 1 7 5" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d="M16 5v4M14 7h4" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),

  LogOut: ({ size = 20, color = 'currentColor' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M7 17H4a2 2 0 01-2-2V5a2 2 0 012-2h3M13 14l4-4-4-4M17 10H7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),

  Calendar: ({ size = 20, color = 'currentColor' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <rect x="2" y="4" width="16" height="14" rx="2" stroke={color} strokeWidth="2" />
      <path d="M2 8h16M6 2v4M14 2v4" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),

  QrCode: ({ size = 20, color = 'currentColor' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <rect x="2" y="2" width="6" height="6" rx="1" stroke={color} strokeWidth="2" />
      <rect x="12" y="2" width="6" height="6" rx="1" stroke={color} strokeWidth="2" />
      <rect x="2" y="12" width="6" height="6" rx="1" stroke={color} strokeWidth="2" />
      <path d="M12 12h2v2h-2zM16 12h2v6h-4M12 16v2" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  ),

  Play: ({ size = 20, color = 'currentColor' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M6 4l10 6-10 6V4z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),

  /** Pokal (Lucide „trophy“, wie im Mockup K5g); viewBox 24, Strichstärke 2 (Monitor-Pokal-Kreis: 2,4) */
  Trophy: ({ size = 20, color = 'currentColor', strokeWidth = 2 }: IconProps & { strokeWidth?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" data-icon="trophy">
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),

  /** B-26: Uhr (Zeiten verschieben) */
  Clock: ({ size = 20, color = 'currentColor' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="7.5" stroke={color} strokeWidth="2" />
      <path d="M10 6v4l2.5 2" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};
