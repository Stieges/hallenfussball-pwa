/** Symbole der Gruppe „Zustand und Hinweis“ (aus `Icons.tsx` aufgeteilt, Form und Name unverändert). */
import type { IconProps } from './iconProps';

export const iconsStatus = {
  AlertTriangle: ({ size = 20, color = 'currentColor' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M10 2L1 18h18L10 2z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 7v4M10 14v1" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),

  Info: ({ size = 20, color = 'currentColor' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="8" stroke={color} strokeWidth="2" />
      <path d="M10 9v5M10 6v1" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),

  WifiOff: ({ size = 20, color = 'currentColor' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M2 2l16 16M5 8.5a8 8 0 013-1.8M15 8.5a8 8 0 00-3.5-2M7.5 12a4 4 0 015 0" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <circle cx="10" cy="16" r="1" fill={color} />
    </svg>
  ),
};
