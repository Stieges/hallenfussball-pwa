interface IconProps {
  size?: number;
  color?: string;
}

export const Icons = {
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

  X: ({ size = 20, color = 'currentColor' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M15 5L5 15M5 5l10 10" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),

  ChevronLeft: ({ size = 20, color = 'currentColor' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M12 15l-5-5 5-5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),

  ChevronRight: ({ size = 20, color = 'currentColor' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M8 5l5 5-5 5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),

  ArrowUp: ({ size = 20, color = 'currentColor' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M10 15V5m0 0L5 10m5-5l5 5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),

  ArrowDown: ({ size = 20, color = 'currentColor' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M10 5v10m0 0l5-5m-5 5l-5-5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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

  Settings: ({ size = 20, color = 'currentColor' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="3" stroke={color} strokeWidth="2" />
      <path d="M10 1v2m0 14v2M19 10h-2M3 10H1m15.364-6.364l-1.414 1.414M5.05 14.95l-1.414 1.414m12.728 0l-1.414-1.414M5.05 5.05L3.636 3.636" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),

  Refresh: ({ size = 20, color = 'currentColor' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M17 10a7 7 0 11-14 0 7 7 0 0114 0zM10 6v4l3 2" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),

  Eye: ({ size = 20, color = 'currentColor' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M1 10s3-6 9-6 9 6 9 6-3 6-9 6-9-6-9-6z" stroke={color} strokeWidth="2" />
      <circle cx="10" cy="10" r="3" stroke={color} strokeWidth="2" />
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

  Copy: ({ size = 20, color = 'currentColor' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <rect x="7" y="7" width="10" height="10" rx="2" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 13V5a2 2 0 012-2h8" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),

  Trophy: ({ size = 20, color = 'currentColor' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M6 9H2v4h4M14 9h4v4h-4M10 16v2M7 18h6M10 2v8a3 3 0 01-3 3 3 3 0 003 3 3 3 0 003-3 3 3 0 01-3-3V2" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),

  Play: ({ size = 20, color = 'currentColor' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M6 4l10 6-10 6V4z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),

  Calendar: ({ size = 20, color = 'currentColor' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <rect x="2" y="4" width="16" height="14" rx="2" stroke={color} strokeWidth="2" />
      <path d="M2 8h16M6 2v4M14 2v4" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),

  Save: ({ size = 20, color = 'currentColor' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M5 2h8l4 4v11a1 1 0 01-1 1H5a1 1 0 01-1-1V3a1 1 0 011-1z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 2v5h6V2M7 18v-5h6v5" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),

  Archive: ({ size = 20, color = 'currentColor' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <rect x="2" y="3" width="16" height="4" rx="1" stroke={color} strokeWidth="2" />
      <path d="M3 7v9a1 1 0 001 1h12a1 1 0 001-1V7" stroke={color} strokeWidth="2" />
      <path d="M8 11h4" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),

  // Bottom Navigation Icons
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

  // Auth Icons
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

  Restore: ({ size = 20, color = 'currentColor' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M3 10a7 7 0 0114 0 7 7 0 01-14 0z" stroke={color} strokeWidth="2" />
      <path d="M3 3v4h4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 7a7 7 0 0112.95 3.67" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),

  AlertTriangle: ({ size = 20, color = 'currentColor' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M10 2L1 18h18L10 2z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 7v4M10 14v1" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
};
