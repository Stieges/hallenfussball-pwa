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
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../../design-tokens'
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
  const { t } = useTranslation('cockpit');
  const isMobile = breakpoint === 'mobile';

  // ---------------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------------

  const headerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: isMobile ? `${cssVars.spacing.xs} ${cssVars.spacing.sm}` : `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
    background: cssVars.colors.surfaceSolid,
    borderBottom: `1px solid ${cssVars.colors.border}`,
    gap: cssVars.spacing.sm,
  };

  const leftSectionStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.md,
  };

  const centerSectionStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    flex: 1,
    justifyContent: 'center',
  };

  const rightSectionStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
  };

  const matchInfoStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  };

  const matchNumberStyle: CSSProperties = {
    fontSize: isMobile ? cssVars.fontSizes.md : cssVars.fontSizes.lg,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textPrimary,
  };

  const fieldNameStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.xs,
    color: cssVars.colors.textSecondary,
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
            aria-label={t('header.back')}
          >
            ← {t('header.back')}
          </Button>
        )}
      </div>

      {/* Center: Match info and status */}
      <div style={centerSectionStyle}>
        <div style={matchInfoStyle}>
          <span style={matchNumberStyle}>{t('header.matchNumber', { number: matchNumber })}</span>
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
            aria-label={t('header.undoLast')}
            type="button"
            style={{
              background: 'transparent',
              border: 'none',
              padding: cssVars.spacing.sm,
              fontSize: cssVars.fontSizes.xl,
              color: cssVars.colors.textSecondary,
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
            aria-label={t('header.openMenu')}
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
  const { t } = useTranslation('cockpit');
  const isLive = status === 'RUNNING';

  const getLabel = () => {
    if (status === 'NOT_STARTED') {return t('status.ready');}
    if (status === 'PAUSED') {return t('status.pause');}
    if (status === 'FINISHED') {return t('status.finished');}
    if (playPhase === 'overtime') {return t('status.overtime');}
    if (playPhase === 'goldenGoal') {return t('status.goldenGoal');}
    if (playPhase === 'penalty') {return t('status.penaltyShootout');}
    return t('status.live');
  };

  const badgeStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: `4px ${cssVars.spacing.sm}`,
    borderRadius: cssVars.borderRadius.full,
    fontSize: cssVars.fontSizes.xs,
    fontWeight: cssVars.fontWeights.bold,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    background: isLive ? cssVars.colors.liveBadgeBg : cssVars.colors.neutralBadgeBg,
    color: isLive ? cssVars.colors.liveBadge : cssVars.colors.textSecondary,
    border: `1px solid ${isLive ? cssVars.colors.liveBadge : cssVars.colors.border}`,
  };

  const dotStyle: CSSProperties = {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: cssVars.colors.liveBadge,
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
  const { t } = useTranslation('cockpit');
  const modes: { value: LiveCockpitMode; label: string; icon: string }[] = [
    { value: 'focus', label: t('header.modeFocus'), icon: '◉' },
    { value: 'standard', label: t('header.modeStandard'), icon: '◎' },
    { value: 'extended', label: t('header.modeExtended'), icon: '⊕' },
  ];

  const containerStyle: CSSProperties = {
    display: 'flex',
    background: cssVars.colors.surfaceDark,
    borderRadius: cssVars.borderRadius.md,
    padding: '2px',
  };

  const optionStyle = (isActive: boolean): CSSProperties => ({
    padding: compact ? `6px ${cssVars.spacing.sm}` : `4px ${cssVars.spacing.sm}`,
    borderRadius: cssVars.borderRadius.sm,
    fontSize: compact ? cssVars.fontSizes.sm : cssVars.fontSizes.xs,
    fontWeight: isActive ? cssVars.fontWeights.semibold : cssVars.fontWeights.normal,
    color: isActive ? cssVars.colors.textPrimary : cssVars.colors.textSecondary,
    background: isActive ? cssVars.colors.surface : 'transparent',
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
    <div style={containerStyle} role="radiogroup" aria-label={t('header.displayMode')}>
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
