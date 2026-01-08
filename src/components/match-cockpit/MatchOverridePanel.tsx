/**
 * MatchOverridePanel
 *
 * Per-match settings override panel shown in Match Cockpit.
 * Allows quick toggles for sound, warning, and auto-finish on a per-match basis.
 *
 * @see docs/concepts/MATCH-COCKPIT-PRO-KONZEPT.md Section 4.2
 */

import { CSSProperties, useCallback, useState } from 'react';
import { cssVars } from '../../design-tokens';
import type { MatchCockpitOverrides, MatchSoundPreset } from '../../types/tournament';

// =============================================================================
// Types
// =============================================================================

export interface MatchOverridePanelProps {
  /** Current overrides for this match */
  overrides: MatchCockpitOverrides | undefined;
  /** Tournament-level defaults for reference */
  defaults: {
    nettoWarningEnabled: boolean;
    autoFinishEnabled: boolean;
    soundEnabled: boolean;
    soundId: MatchSoundPreset | null;
    soundVolume: number;
  };
  /** Callback when overrides change */
  onChange: (overrides: MatchCockpitOverrides) => void;
  /** Whether the match is a final (shows golden goal option) */
  isFinalMatch?: boolean;
  /** Whether to show expanded view */
  expanded?: boolean;
  /** Callback to toggle expanded view */
  onToggleExpanded?: () => void;
}

// =============================================================================
// Component
// =============================================================================

export function MatchOverridePanel({
  overrides = {},
  defaults,
  onChange,
  isFinalMatch = false,
  expanded = false,
  onToggleExpanded,
}: MatchOverridePanelProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(expanded);

  // Get effective value (override or default)
  const getEffective = <K extends keyof typeof defaults>(
    key: K,
    overrideKey: keyof MatchCockpitOverrides
  ): (typeof defaults)[K] => {
    const override = overrides[overrideKey];
    return override !== undefined ? (override as (typeof defaults)[K]) : defaults[key];
  };

  // Update an override
  const updateOverride = useCallback(
    <K extends keyof MatchCockpitOverrides>(key: K, value: MatchCockpitOverrides[K]) => {
      onChange({ ...overrides, [key]: value });
    },
    [overrides, onChange]
  );

  // Reset an override to default
  const resetOverride = useCallback(
    (key: keyof MatchCockpitOverrides) => {
      // Filter out the key to remove it without dynamic delete
      const newOverrides = Object.fromEntries(
        Object.entries(overrides).filter(([k]) => k !== key)
      ) as MatchCockpitOverrides;
      onChange(newOverrides);
    },
    [overrides, onChange]
  );

  // Check if any overrides are active
  const hasOverrides = Object.keys(overrides).length > 0;

  // Handle toggle click
  const handleToggle = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    onToggleExpanded?.();
  };

  return (
    <div style={styles.container}>
      {/* Header with toggle */}
      <button
        type="button"
        onClick={handleToggle}
        style={styles.header}
        aria-expanded={isOpen}
      >
        <span style={styles.headerIcon}>
          {hasOverrides ? '⚙️' : '⚙️'}
        </span>
        <span style={styles.headerTitle}>
          Spiel-Einstellungen
          {hasOverrides && (
            <span style={styles.overrideIndicator}>
              ({Object.keys(overrides).length} angepasst)
            </span>
          )}
        </span>
        <span style={styles.chevron}>{isOpen ? '▲' : '▼'}</span>
      </button>

      {/* Expandable content */}
      {isOpen && (
        <div style={styles.content}>
          {/* Sound Override */}
          <OverrideRow
            label="Sound"
            isOverridden={overrides.soundEnabled !== undefined}
            onReset={() => resetOverride('soundEnabled')}
          >
            <QuickToggle
              checked={getEffective('soundEnabled', 'soundEnabled')}
              onChange={(v) => updateOverride('soundEnabled', v)}
              labelOn="An"
              labelOff="Aus"
            />
          </OverrideRow>

          {/* Netto Warning Override */}
          <OverrideRow
            label="Netto-Warnung"
            isOverridden={overrides.nettoWarningEnabled !== undefined}
            onReset={() => resetOverride('nettoWarningEnabled')}
          >
            <QuickToggle
              checked={getEffective('nettoWarningEnabled', 'nettoWarningEnabled')}
              onChange={(v) => updateOverride('nettoWarningEnabled', v)}
              labelOn="An"
              labelOff="Aus"
            />
          </OverrideRow>

          {/* Auto-Finish Override */}
          <OverrideRow
            label="Auto-Beenden"
            isOverridden={overrides.autoFinishEnabled !== undefined}
            onReset={() => resetOverride('autoFinishEnabled')}
          >
            <QuickToggle
              checked={getEffective('autoFinishEnabled', 'autoFinishEnabled')}
              onChange={(v) => updateOverride('autoFinishEnabled', v)}
              labelOn="An"
              labelOff="Aus"
            />
          </OverrideRow>

          {/* Volume Override */}
          {getEffective('soundEnabled', 'soundEnabled') && (
            <OverrideRow
              label="Lautstärke"
              isOverridden={overrides.soundVolume !== undefined}
              onReset={() => resetOverride('soundVolume')}
            >
              <div style={styles.volumeControl}>
                <button
                  type="button"
                  onClick={() => {
                    const currentVol = overrides.soundVolume ?? defaults.soundVolume;
                    if (currentVol === 0) {
                      // Unmute: Restore to default or 50 if default is 0
                      updateOverride('soundVolume', defaults.soundVolume || 50);
                    } else {
                      // Mute: Set to 0
                      updateOverride('soundVolume', 0);
                    }
                  }}
                  style={{
                    ...styles.muteButton,
                    opacity: (overrides.soundVolume ?? defaults.soundVolume) === 0 ? 0.5 : 1
                  }}
                  title={(overrides.soundVolume ?? defaults.soundVolume) === 0 ? "Unmute" : "Mute"}
                >
                  {(overrides.soundVolume ?? defaults.soundVolume) === 0 ? '🔇' : '🔊'}
                </button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={overrides.soundVolume ?? defaults.soundVolume}
                  onChange={(e) => updateOverride('soundVolume', Number(e.target.value))}
                  style={{
                    ...styles.volumeSlider,
                    opacity: (overrides.soundVolume ?? defaults.soundVolume) === 0 ? 0.5 : 1
                  }}
                />
                <span style={styles.volumeValue}>
                  {overrides.soundVolume ?? defaults.soundVolume}%
                </span>
              </div>
            </OverrideRow>
          )}

          {/* Golden Goal (finals only) */}
          {isFinalMatch && (
            <OverrideRow
              label="Golden Goal"
              description="Bei Unentschieden weiter bis Tor"
              isOverridden={overrides.goldenGoalEnabled !== undefined}
              onReset={() => resetOverride('goldenGoalEnabled')}
            >
              <QuickToggle
                checked={overrides.goldenGoalEnabled ?? false}
                onChange={(v) => updateOverride('goldenGoalEnabled', v)}
                labelOn="An"
                labelOff="Aus"
              />
            </OverrideRow>
          )}

          {/* Reset All */}
          {hasOverrides && (
            <button
              type="button"
              onClick={() => onChange({})}
              style={styles.resetAllButton}
            >
              Alle zurücksetzen
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Sub-Components
// =============================================================================

interface OverrideRowProps {
  label: string;
  description?: string;
  isOverridden: boolean;
  onReset: () => void;
  children: React.ReactNode;
}

function OverrideRow({
  label,
  description,
  isOverridden,
  onReset,
  children,
}: OverrideRowProps): JSX.Element {
  return (
    <div style={styles.row}>
      <div style={styles.rowContent}>
        <span style={styles.rowLabel}>
          {label}
          {isOverridden && (
            <span style={styles.overrideBadge} title="Angepasst für dieses Spiel">
              *
            </span>
          )}
        </span>
        {description && <span style={styles.rowDescription}>{description}</span>}
      </div>
      <div style={styles.rowControl}>
        {children}
        {isOverridden && (
          <button
            type="button"
            onClick={onReset}
            style={styles.resetButton}
            title="Auf Standard zurücksetzen"
            aria-label={`${label} zurücksetzen`}
          >
            ↺
          </button>
        )}
      </div>
    </div>
  );
}

interface QuickToggleProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  labelOn: string;
  labelOff: string;
}

function QuickToggle({ checked, onChange, labelOn, labelOff }: QuickToggleProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        ...styles.quickToggle,
        ...(checked ? styles.quickToggleOn : styles.quickToggleOff),
      }}
    >
      {checked ? labelOn : labelOff}
    </button>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles: Record<string, CSSProperties> = {
  container: {
    background: cssVars.colors.surface,
    borderRadius: cssVars.borderRadius.lg,
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    width: '100%',
    padding: cssVars.spacing.md,
    background: 'transparent',
    border: 'none',
    color: cssVars.colors.textPrimary,
    cursor: 'pointer',
    textAlign: 'left',
  },
  headerIcon: {
    fontSize: cssVars.fontSizes.lg,
  },
  headerTitle: {
    flex: 1,
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.medium,
  },
  overrideIndicator: {
    marginLeft: cssVars.spacing.xs,
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.primary,
  },
  chevron: {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
  },
  content: {
    padding: `0 ${cssVars.spacing.md} ${cssVars.spacing.md}`,
    borderTop: `1px solid ${cssVars.colors.border}`,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: cssVars.spacing.md,
    padding: `${cssVars.spacing.sm} 0`,
    borderBottom: `1px solid ${cssVars.colors.border}`,
  },
  rowContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    flex: 1,
    minWidth: 0,
  },
  rowLabel: {
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.medium,
    color: cssVars.colors.textPrimary,
  },
  rowDescription: {
    fontSize: cssVars.fontSizes.xs,
    color: cssVars.colors.textSecondary,
  },
  rowControl: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.xs,
    flexShrink: 0,
  },
  overrideBadge: {
    marginLeft: '4px',
    color: cssVars.colors.primary,
    fontWeight: cssVars.fontWeights.bold,
  },
  quickToggle: {
    minWidth: '48px',
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.medium,
    border: 'none',
    borderRadius: cssVars.borderRadius.md,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  quickToggleOn: {
    background: cssVars.colors.primary,
    color: cssVars.colors.onPrimary,
  },
  quickToggleOff: {
    background: cssVars.colors.surfaceLight,
    color: cssVars.colors.textSecondary,
  },
  resetButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    padding: 0,
    fontSize: cssVars.fontSizes.sm,
    background: 'transparent',
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    color: cssVars.colors.textSecondary,
    cursor: 'pointer',
  },
  resetAllButton: {
    width: '100%',
    marginTop: cssVars.spacing.md,
    padding: cssVars.spacing.sm,
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
    background: 'transparent',
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    cursor: 'pointer',
  },
  volumeControl: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.xs,
  },
  volumeSlider: {
    width: '80px',
    height: '6px',
    appearance: 'none',
    background: cssVars.colors.surfaceLight,
    borderRadius: cssVars.borderRadius.full,
    cursor: 'pointer',
  },
  volumeValue: {
    minWidth: '36px',
    fontSize: cssVars.fontSizes.xs,
    color: cssVars.colors.textSecondary,
    textAlign: 'right',
  },
  muteButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    fontSize: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};

export default MatchOverridePanel;
