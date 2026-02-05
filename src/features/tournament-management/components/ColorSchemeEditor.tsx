/**
 * ColorSchemeEditor - Position color picker for Live-Score slides
 *
 * Allows tournament organizers to choose home/away colors from 5 presets
 * or pick custom colors via react-colorful. Includes a mini-preview
 * and an option to use actual team colors instead.
 *
 * @see MONITOR-LIVE-SCORE-REDESIGN.md Section 8
 */

import { CSSProperties, useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { HexColorPicker, HexColorInput } from 'react-colorful';
import { cssVars } from '../../../design-tokens';
import { monitorColorSchemes, getScoreTextColor } from '../../../design-tokens/display';
import type { LiveColorScheme, LiveColorPreset } from '../../../types/monitor';
import { DEFAULT_LIVE_COLOR_SCHEME } from '../../../types/monitor';

// =============================================================================
// TYPES
// =============================================================================

export interface ColorSchemeEditorProps {
  value: LiveColorScheme;
  onChange: (scheme: LiveColorScheme) => void;
  styles: Record<string, CSSProperties>;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const PRESET_META: Record<Exclude<LiveColorPreset, 'custom'>, { labelKey: string }> = {
  classic: { labelKey: 'colorScheme.presets.classic' },
  nature: { labelKey: 'colorScheme.presets.nature' },
  contrast: { labelKey: 'colorScheme.presets.contrast' },
  modern: { labelKey: 'colorScheme.presets.modern' },
  alternative: { labelKey: 'colorScheme.presets.alternative' },
};

const RECENT_COLORS_KEY = 'hallenfussball_recent_colors';
const MAX_RECENT = 6;

// =============================================================================
// HELPERS
// =============================================================================

function loadRecentColors(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_COLORS_KEY);
    return stored ? (JSON.parse(stored) as string[]).slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function saveRecentColor(color: string) {
  try {
    const recent = loadRecentColors().filter(c => c !== color);
    recent.unshift(color);
    localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
  } catch {
    // localStorage not available — silently ignore
  }
}

// =============================================================================
// STYLES
// =============================================================================

const sectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: cssVars.spacing.md,
};

const presetRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: cssVars.spacing.sm,
};

const customRowStyle: CSSProperties = {
  display: 'flex',
  gap: cssVars.spacing.lg,
  flexWrap: 'wrap',
};

const colorFieldStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: cssVars.spacing.xs,
  flex: '1 1 120px',
};

const swatchBtnBase: CSSProperties = {
  width: '40px',
  height: '40px',
  borderRadius: cssVars.borderRadius.sm,
  border: '2px solid transparent',
  cursor: 'pointer',
  padding: 0,
  position: 'relative',
};

const previewContainerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: cssVars.spacing.md,
  padding: cssVars.spacing.md,
  borderRadius: cssVars.borderRadius.md,
  background: 'rgba(0,0,0,0.05)',
};

const previewBlockStyle: CSSProperties = {
  width: '64px',
  height: '48px',
  borderRadius: cssVars.borderRadius.sm,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 700,
  fontSize: cssVars.fontSizes.lg,
};

const checkboxLabelStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: cssVars.spacing.sm,
  cursor: 'pointer',
  minHeight: cssVars.touchTargets.minimum,
};

const popoverStyle: CSSProperties = {
  position: 'absolute',
  zIndex: 100,
  top: '100%',
  left: 0,
  marginTop: cssVars.spacing.xs,
  padding: cssVars.spacing.md,
  background: cssVars.colors.surface,
  borderRadius: cssVars.borderRadius.md,
  boxShadow: cssVars.shadows.lg,
  border: `1px solid ${cssVars.colors.border}`,
  display: 'flex',
  flexDirection: 'column',
  gap: cssVars.spacing.sm,
};

const recentRowStyle: CSSProperties = {
  display: 'flex',
  gap: cssVars.spacing.xs,
  flexWrap: 'wrap',
};

const recentSwatchStyle: CSSProperties = {
  width: '28px',
  height: '28px',
  borderRadius: cssVars.borderRadius.sm,
  border: `1px solid ${cssVars.colors.border}`,
  cursor: 'pointer',
  padding: 0,
};

const hexInputStyle: CSSProperties = {
  width: '100%',
  padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
  border: `1px solid ${cssVars.colors.border}`,
  borderRadius: cssVars.borderRadius.sm,
  fontSize: cssVars.fontSizes.sm,
  fontFamily: cssVars.fontFamilies.mono,
};

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function ColorPresetButton({
  presetKey,
  home,
  away,
  isActive,
  onClick,
}: {
  presetKey: Exclude<LiveColorPreset, 'custom'>;
  home: string;
  away: string;
  isActive: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation('tournament');
  const meta = PRESET_META[presetKey];
  const label = t(meta.labelKey as never);

  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={t('colorScheme.schemaAria', { name: label })}
      aria-pressed={isActive}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: cssVars.spacing.xs,
        padding: cssVars.spacing.sm,
        borderRadius: cssVars.borderRadius.md,
        border: `2px solid ${isActive ? cssVars.colors.primary : cssVars.colors.border}`,
        background: isActive ? cssVars.colors.primaryLight : 'transparent',
        cursor: 'pointer',
        minWidth: '72px',
        minHeight: cssVars.touchTargets.minimum,
      }}
    >
      <div style={{ display: 'flex', gap: '2px' }}>
        <div style={{ width: '24px', height: '24px', borderRadius: '4px', backgroundColor: home }} />
        <div style={{ width: '24px', height: '24px', borderRadius: '4px', backgroundColor: away }} />
      </div>
      <span style={{ fontSize: cssVars.fontSizes.xs, color: cssVars.colors.textSecondary }}>
        {label}
      </span>
    </button>
  );
}

function ColorPickerField({
  label,
  color,
  onChange,
}: {
  label: string;
  color: string;
  onChange: (color: string) => void;
}) {
  const { t } = useTranslation('tournament');
  const [isOpen, setIsOpen] = useState(false);
  const [recentColors] = useState(loadRecentColors);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const handleChange = useCallback(
    (newColor: string) => {
      onChange(newColor);
    },
    [onChange],
  );

  const handleClose = useCallback(() => {
    saveRecentColor(color);
    setIsOpen(false);
  }, [color]);

  return (
    <div style={colorFieldStyle}>
      <span style={{ fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary }}>
        {label}
      </span>
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-label={t('colorScheme.pickColorAria', { label, color })}
          style={{
            ...swatchBtnBase,
            backgroundColor: color,
            border: `2px solid ${cssVars.colors.border}`,
            width: '100%',
            height: '40px',
          }}
        />
        {isOpen && (
          <div ref={popoverRef} style={popoverStyle}>
            <HexColorPicker color={color} onChange={handleChange} />
            <HexColorInput
              color={color}
              onChange={handleChange}
              prefixed
              style={hexInputStyle}
              aria-label={t('colorScheme.hexValueAria', { label })}
            />
            {recentColors.length > 0 && (
              <>
                <span style={{ fontSize: cssVars.fontSizes.xs, color: cssVars.colors.textMuted }}>
                  {t('colorScheme.recentlyUsed')}
                </span>
                <div style={recentRowStyle}>
                  {recentColors.map((c) => (
                    <button
                      key={c}
                      type="button"
                      style={{ ...recentSwatchStyle, backgroundColor: c }}
                      onClick={() => handleChange(c)}
                      aria-label={t('colorScheme.useColorAria', { color: c })}
                    />
                  ))}
                </div>
              </>
            )}
            <button
              type="button"
              onClick={handleClose}
              style={{
                padding: `${cssVars.spacing.xs} ${cssVars.spacing.md}`,
                borderRadius: cssVars.borderRadius.sm,
                border: `1px solid ${cssVars.colors.border}`,
                background: cssVars.colors.surface,
                cursor: 'pointer',
                fontSize: cssVars.fontSizes.sm,
                minHeight: cssVars.touchTargets.minimum,
              }}
            >
              {t('colorScheme.done')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ColorSchemePreview({
  homeColor,
  awayColor,
}: {
  homeColor: string;
  awayColor: string;
}) {
  return (
    <div style={previewContainerStyle}>
      <div style={{ ...previewBlockStyle, backgroundColor: homeColor, color: getScoreTextColor(homeColor) }}>
        02
      </div>
      <span style={{ fontWeight: 700, fontSize: cssVars.fontSizes.lg, color: cssVars.colors.textSecondary }}>
        :
      </span>
      <div style={{ ...previewBlockStyle, backgroundColor: awayColor, color: getScoreTextColor(awayColor) }}>
        01
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function ColorSchemeEditor({ value, onChange, styles }: ColorSchemeEditorProps) {
  const { t } = useTranslation('tournament');
  const scheme = value ?? DEFAULT_LIVE_COLOR_SCHEME;

  const handlePresetSelect = useCallback(
    (presetKey: Exclude<LiveColorPreset, 'custom'>) => {
      const preset = monitorColorSchemes.presets[presetKey];
      onChange({
        preset: presetKey,
        homeColor: preset.home,
        awayColor: preset.away,
        useTeamColors: scheme.useTeamColors,
      });
    },
    [onChange, scheme.useTeamColors],
  );

  const handleHomeColorChange = useCallback(
    (color: string) => {
      onChange({ ...scheme, preset: 'custom', homeColor: color });
    },
    [onChange, scheme],
  );

  const handleAwayColorChange = useCallback(
    (color: string) => {
      onChange({ ...scheme, preset: 'custom', awayColor: color });
    },
    [onChange, scheme],
  );

  const handleUseTeamColorsToggle = useCallback(
    (checked: boolean) => {
      onChange({ ...scheme, useTeamColors: checked });
    },
    [onChange, scheme],
  );

  return (
    <div style={{ ...styles.inputGroupStyle, marginTop: cssVars.spacing.sm }}>
      <span style={styles.labelStyle}>{t('colorScheme.scoreColors')}</span>

      <div style={sectionStyle}>
        {/* Presets */}
        <div style={presetRowStyle}>
          {(Object.keys(monitorColorSchemes.presets) as Exclude<LiveColorPreset, 'custom'>[]).map(
            (key) => (
              <ColorPresetButton
                key={key}
                presetKey={key}
                home={monitorColorSchemes.presets[key].home}
                away={monitorColorSchemes.presets[key].away}
                isActive={scheme.preset === key}
                onClick={() => handlePresetSelect(key)}
              />
            ),
          )}
        </div>

        {/* Custom color pickers */}
        <div style={customRowStyle}>
          <ColorPickerField
            label={t('colorScheme.homeColor')}
            color={scheme.homeColor}
            onChange={handleHomeColorChange}
          />
          <ColorPickerField
            label={t('colorScheme.awayColor')}
            color={scheme.awayColor}
            onChange={handleAwayColorChange}
          />
        </div>

        {/* Team colors toggle */}
        <label style={checkboxLabelStyle}>
          <input
            type="checkbox"
            checked={scheme.useTeamColors}
            onChange={(e) => handleUseTeamColorsToggle(e.target.checked)}
          />
          <span style={styles.labelStyle}>{t('colorScheme.useTeamColors')}</span>
        </label>

        {/* Mini Preview */}
        <ColorSchemePreview homeColor={scheme.homeColor} awayColor={scheme.awayColor} />
      </div>
    </div>
  );
}
