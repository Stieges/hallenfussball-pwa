/**
 * Kopfzeile der Live-Folie (B-44a2): LIVE-Marke links, Feld/Spiel in der Mitte, Gruppe rechts.
 * Der Wachhalten-Hinweis steht nicht hier, sondern als Ecke der Monitor-Seite (B-48a, `WakeLockNotice`).
 */
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, displayFontSizes, displayLayout, type MonitorThemeColors } from '../../design-tokens';
import type { MatchStatus } from '../../hooks/useLiveMatches';
import { getStatusInfo } from './liveStatus';

const layout = displayLayout.scoreArea;

export interface LiveHeaderProps {
  status: MatchStatus;
  field: number;
  matchNumber: number | string;
  /** Gruppenname, falls vorhanden */
  group?: string;
  size: 'md' | 'lg' | 'xl';
  themeColors: MonitorThemeColors;
}

export function LiveHeader({ status, field, matchNumber, group, size, themeColors }: LiveHeaderProps) {
  const { t } = useTranslation('monitor');
  const statusInfo = getStatusInfo(status, themeColors);
  const isRunning = status === 'RUNNING';
  const xl = size === 'xl';

  // B-44a2: feste drei Spalten (Marke links, Feld/Spiel Mitte, Gruppe rechts), auch wenn eine Gruppe fehlt
  const headerStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr',
    alignItems: 'center',
    width: '100%',
    height: layout.header,
    marginBottom: layout.headerGap,
    flexShrink: 0,
  };
  const badgeStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: xl ? layout.badgeGap : cssVars.spacing.sm,
    padding: xl ? `${layout.badgePadY} ${layout.badgePadX}` : `${cssVars.spacing.sm} ${cssVars.spacing.xl}`,
    borderRadius: cssVars.borderRadius.md,
    backgroundColor: statusInfo.bgColor,
    color: statusInfo.color,
    fontSize: xl ? displayFontSizes.liveBadge : '16px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    // B-44a2: eine Marken-Gestaltung für alle Zustände, feste Mindestbreite
    width: layout.badgeWidth,
    justifyContent: 'center',
    justifySelf: 'start',
    animation: isRunning ? 'livePulse 1.5s ease-in-out infinite' : undefined,
  };
  const liveDotStyle: CSSProperties = {
    width: xl ? layout.badgeDot : '14px',
    height: xl ? layout.badgeDot : '14px',
    borderRadius: '50%',
    backgroundColor: statusInfo.dotColor,
    boxShadow: isRunning ? `0 0 8px ${statusInfo.dotColor}` : undefined,
    animation: isRunning ? 'liveDotPulse 1s ease-in-out infinite' : undefined,
  };
  const infoStyle: CSSProperties = {
    fontSize: xl ? displayFontSizes.liveInfo : '20px',
    fontWeight: 600,
    color: themeColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  };

  return (
    <div style={headerStyle} data-testid="live-header">
      <div style={badgeStyle} data-testid="live-badge">
        <span style={liveDotStyle} />
        {statusInfo.label}
      </div>
      <div style={infoStyle} data-testid="live-info">Feld {field} — Spiel {matchNumber}</div>
      <div style={{ ...infoStyle, color: themeColors.text, justifySelf: 'end' }} data-testid="live-group">
        {group ? t('liveMatch.group', { group }) : null}
      </div>
    </div>
  );
}
