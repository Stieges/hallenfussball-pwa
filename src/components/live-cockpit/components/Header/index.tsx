/**
 * Header - Live Cockpit Header Component
 *
 * Contains:
 * - Back button
 * - Match info (number, field)
 * - Status badge (LIVE pulsing with CSS animation)
 * - Undo button (except in focus mode)
 * - Mode switcher
 * - Overflow menu
 */

import { type CSSProperties } from 'react';
import { colors, spacing, fontSizes, fontWeights, borderRadius } from '../../../../design-tokens';
import type { Breakpoint } from '../../../../hooks';
import type { MatchStatus, MatchPlayPhase, LiveCockpitMode } from '../../types';
import { Button } from '../../../ui';
import styles from '../../LiveCockpit.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HeaderProps {
  matchNumber: number;
  fieldName?: string;
  status: MatchStatus;
  playPhase?: MatchPlayPhase;
  mode: LiveCockpitMode;
  onModeChange: (mode: LiveCockpitMode) => void;
  onBack?: () => void;
  onUndo?: () => void;
  showUndo?: boolean;
  onMenuOpen?: () => void;
  breakpoint?: Breakpoint;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const Header: React.FC<HeaderProps> = ({
  matchNumber,
  fieldName,
  status,
  playPhase,
  mode,
  onModeChange,
  onBack,
  onUndo,
  showUndo = true,
  onMenuOpen,
  breakpoint = 'desktop',
}) => {
  const isMobile = breakpoint === 'mobile';

  // ---------------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------------

  const headerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: isMobile ? `${spacing.xs} ${spacing.sm}` : `${spacing.sm} ${spacing.md}`,
    background: colors.surfaceSolid,
    borderBottom: `1px solid ${colors.border}`,
    gap: spacing.sm,
  };

  const leftSectionStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.md,
  };

  const centerSectionStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    justifyContent: 'center',
  };

  const rightSectionStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
  };

  const matchInfoStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  };

  const matchNumberStyle: CSSProperties = {
    fontSize: isMobile ? fontSizes.md : fontSizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
  };

  const fieldNameStyle: CSSProperties = {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <header style={headerStyle}>
      {/* Left: Back button */}
      <div style={leftSectionStyle}>
        {onBack && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            aria-label="Zurück"
          >
            ← Zurück
          </Button>
        )}
      </div>

      {/* Center: Match info and status */}
      <div style={centerSectionStyle}>
        <div style={matchInfoStyle}>
          <span style={matchNumberStyle}>Spiel {matchNumber}</span>
          {fieldName && <span style={fieldNameStyle}>{fieldName}</span>}
        </div>
        <StatusBadge status={status} playPhase={playPhase} />
      </div>

      {/* Right: Undo, Mode, Menu */}
      <div style={rightSectionStyle}>
        {showUndo && onUndo && (
          <button
            className={styles.undoButton}
            onClick={onUndo}
            aria-label="Letzte Aktion rückgängig"
            type="button"
            style={{
              background: 'transparent',
              border: 'none',
              padding: spacing.sm,
              fontSize: fontSizes.xl,
              color: colors.textSecondary,
              cursor: 'pointer',
            }}
          >
            ↶
          </button>
        )}

        {/* Mode switch - always visible */}
        <ModeSwitch mode={mode} onChange={onModeChange} compact={isMobile} />

        {onMenuOpen && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onMenuOpen}
            aria-label="Menü öffnen"
          >
            ⋮
          </Button>
        )}
      </div>
    </header>
  );
};

// ---------------------------------------------------------------------------
// Sub-Components
// ---------------------------------------------------------------------------

interface StatusBadgeProps {
  status: MatchStatus;
  playPhase?: MatchPlayPhase;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, playPhase }) => {
  const isLive = status === 'RUNNING';

  const getLabel = () => {
    if (status === 'NOT_STARTED') {return 'BEREIT';}
    if (status === 'PAUSED') {return 'PAUSE';}
    if (status === 'FINISHED') {return 'BEENDET';}
    if (playPhase === 'overtime') {return 'VERLÄNGERUNG';}
    if (playPhase === 'goldenGoal') {return 'GOLDEN GOAL';}
    if (playPhase === 'penalty') {return 'ELFMETERSCHIESSEN';}
    return 'LIVE';
  };

  const badgeStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: `4px ${spacing.sm}`,
    borderRadius: borderRadius.full,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    background: isLive ? colors.liveBadgeBg : colors.neutralBadgeBg,
    color: isLive ? colors.liveBadge : colors.textSecondary,
    border: `1px solid ${isLive ? colors.liveBadge : colors.border}`,
  };

  const dotStyle: CSSProperties = {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: colors.liveBadge,
  };

  return (
    <span style={badgeStyle}>
      {isLive && (
        <span
          style={dotStyle}
          className={styles.liveBadgeDot}
          aria-hidden="true"
        />
      )}
      {getLabel()}
    </span>
  );
};

interface ModeSwitchProps {
  mode: LiveCockpitMode;
  onChange: (mode: LiveCockpitMode) => void;
  compact?: boolean;
}

const ModeSwitch: React.FC<ModeSwitchProps> = ({ mode, onChange, compact = false }) => {
  const modes: { value: LiveCockpitMode; label: string; icon: string }[] = [
    { value: 'focus', label: 'Fokus', icon: '◉' },
    { value: 'standard', label: 'Standard', icon: '◎' },
    { value: 'extended', label: 'Erweitert', icon: '⊕' },
  ];

  const containerStyle: CSSProperties = {
    display: 'flex',
    background: colors.surfaceDark,
    borderRadius: borderRadius.md,
    padding: '2px',
  };

  const optionStyle = (isActive: boolean): CSSProperties => ({
    padding: compact ? `6px ${spacing.sm}` : `4px ${spacing.sm}`,
    borderRadius: borderRadius.sm,
    fontSize: compact ? fontSizes.sm : fontSizes.xs,
    fontWeight: isActive ? fontWeights.semibold : fontWeights.normal,
    color: isActive ? colors.textPrimary : colors.textSecondary,
    background: isActive ? colors.surface : 'transparent',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    minWidth: compact ? '44px' : 'auto', // Touch target
    minHeight: compact ? '36px' : 'auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  });

  return (
    <div style={containerStyle} role="radiogroup" aria-label="Anzeigemodus">
      {modes.map(({ value, label, icon }) => (
        <button
          key={value}
          style={optionStyle(mode === value)}
          onClick={() => onChange(value)}
          role="radio"
          aria-checked={mode === value}
          aria-label={label}
          title={label}
        >
          {compact ? icon : label}
        </button>
      ))}
    </div>
  );
};

export default Header;
