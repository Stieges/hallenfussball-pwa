/**
 * MatchCockpitSettingsPanel
 *
 * Tournament-wide Match Cockpit Pro settings panel for Admin Center.
 * Manages timer direction, netto warning, sounds, haptics, and auto-advance.
 *
 * @see docs/concepts/MATCH-COCKPIT-PRO-KONZEPT.md Section 4
 */

import { CSSProperties, useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../design-tokens';
import type {
  MatchCockpitSettings,
  MatchSoundPreset,
  TimerDirection,
} from '../../types/tournament';
import { storeCustomSound, deleteCustomSound, MAX_SOUND_FILE_SIZE } from '../../utils/soundStorage';

// =============================================================================
// UI Constants
// =============================================================================

// Toggle dimensions (shared with SettingItem.tsx for consistency)
const TOGGLE_WIDTH = 52;
const TOGGLE_HEIGHT = 28;
const TOGGLE_THUMB_SIZE = 24;
const TOGGLE_THUMB_SPACING = 2;
const TOGGLE_THUMB_ON_POSITION = TOGGLE_WIDTH - TOGGLE_THUMB_SIZE - TOGGLE_THUMB_SPACING;

// Form element dimensions
const SELECT_MIN_WIDTH = 180;
const SELECT_HEIGHT = 40;
const SLIDER_WIDTH = 120;
const SLIDER_HEIGHT = 6;

// =============================================================================
// Types
// =============================================================================

export interface MatchCockpitSettingsPanelProps {
  /** Current settings */
  settings: MatchCockpitSettings;
  /** Callback when settings change */
  onChange: (settings: MatchCockpitSettings) => void;
  /** Tournament ID for custom sound storage */
  tournamentId: string;
  /** Callback to test sound playback */
  onTestSound?: () => void;
}

// =============================================================================
// Constants
// =============================================================================

// Options will be populated with translated labels inside the component

// =============================================================================
// Component
// =============================================================================

export function MatchCockpitSettingsPanel({
  settings,
  onChange,
  tournamentId,
  onTestSound,
}: MatchCockpitSettingsPanelProps): React.ReactNode {
  const { t } = useTranslation('cockpit');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Translated option arrays
  const TIMER_DIRECTION_OPTIONS: { value: TimerDirection; label: string }[] = [
    { value: 'countdown', label: t('settings.countdown') },
    { value: 'elapsed', label: t('settings.elapsed') },
  ];

  const SOUND_PRESET_OPTIONS: { value: MatchSoundPreset | 'none'; label: string }[] = [
    { value: 'none', label: t('settings.noSound') },
    { value: 'horn-1', label: t('settings.horn1') },
    { value: 'horn-2', label: t('settings.horn2') },
    { value: 'horn-3', label: t('settings.horn3') },
    { value: 'custom', label: t('settings.customSound') },
  ];

  const NETTO_WARNING_OPTIONS = [
    { value: '60', label: t('settings.oneMinute') },
    { value: '90', label: t('settings.oneThirtyMinutes') },
    { value: '120', label: t('settings.twoMinutes') },
    { value: '180', label: t('settings.threeMinutes') },
  ];

  const AUTO_ADVANCE_OPTIONS = [
    { value: '5', label: t('settings.fiveSeconds') },
    { value: '10', label: t('settings.tenSeconds') },
    { value: '15', label: t('settings.fifteenSeconds') },
    { value: '20', label: t('settings.twentySeconds') },
  ];

  // Update a single setting
  const updateSetting = useCallback(
    <K extends keyof MatchCockpitSettings>(key: K, value: MatchCockpitSettings[K]) => {
      onChange({ ...settings, [key]: value });
    },
    [settings, onChange]
  );

  // Handle sound preset change
  const handleSoundChange = useCallback(
    (value: string) => {
      if (value === 'none') {
        updateSetting('soundEnabled', false);
        updateSetting('soundId', null);
      } else {
        updateSetting('soundEnabled', true);
        updateSetting('soundId', value as MatchSoundPreset);
      }
    },
    [updateSetting]
  );

  // Handle custom sound upload
  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      setIsUploading(true);
      setUploadError(null);

      const result = await storeCustomSound(tournamentId, file);

      if (result.success) {
        updateSetting('hasCustomSound', true);
        updateSetting('soundId', 'custom');
        updateSetting('soundEnabled', true);
      } else {
        setUploadError(result.error ?? t('settings.uploadFailed'));
      }

      setIsUploading(false);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [tournamentId, updateSetting, t]
  );

  // Handle custom sound delete
  const handleDeleteCustomSound = useCallback(async () => {
    await deleteCustomSound(tournamentId);
    updateSetting('hasCustomSound', false);
    if (settings.soundId === 'custom') {
      updateSetting('soundId', 'horn-1');
    }
  }, [tournamentId, settings.soundId, updateSetting]);

  // Get current sound value for select
  const currentSoundValue = settings.soundEnabled && settings.soundId
    ? settings.soundId
    : 'none';

  return (
    <div style={styles.container}>
      {/* Timer Section */}
      <section style={styles.section}>
        <h3 style={styles.sectionTitle}>{t('settings.timer')}</h3>

        <SettingRow label={t('settings.timerDirection')} description={t('settings.timerDescription')}>
          <select
            value={settings.timerDirection}
            onChange={(e) => updateSetting('timerDirection', e.target.value as TimerDirection)}
            style={styles.select}
          >
            {TIMER_DIRECTION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </SettingRow>

        <SettingRow
          label={t('settings.netTimeWarning')}
          description={t('settings.netTimeWarningDesc')}
        >
          <Toggle
            checked={settings.nettoWarningEnabled}
            onChange={(v) => updateSetting('nettoWarningEnabled', v)}
            label={t('settings.enableNetTimeWarning')}
          />
        </SettingRow>

        {settings.nettoWarningEnabled && (
          <SettingRow label={t('settings.warningTime')} description={t('settings.warningTimeDesc')}>
            <select
              value={String(settings.nettoWarningSeconds)}
              onChange={(e) => updateSetting('nettoWarningSeconds', Number(e.target.value))}
              style={styles.select}
            >
              {NETTO_WARNING_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </SettingRow>
        )}
      </section>

      {/* Sound Section */}
      <section style={styles.section}>
        <h3 style={styles.sectionTitle}>{t('settings.sound')}</h3>

        <SettingRow label={t('settings.endSound')} description={t('settings.endSoundDesc')}>
          <div style={{ display: 'flex', gap: cssVars.spacing.sm, alignItems: 'center' }}>
            <select
              value={currentSoundValue}
              onChange={(e) => handleSoundChange(e.target.value)}
              style={styles.select}
            >
              {SOUND_PRESET_OPTIONS.map((opt) => (
                <option
                  key={opt.value}
                  value={opt.value}
                  disabled={opt.value === 'custom' && !settings.hasCustomSound}
                >
                  {opt.label}
                  {opt.value === 'custom' && !settings.hasCustomSound && ` (${t('settings.notUploaded')})`}
                </option>
              ))}
            </select>
            {onTestSound && (
              <button
                type="button"
                onClick={onTestSound}
                style={styles.testButton}
                title={t('settings.testSound')}
              >
                ▶
              </button>
            )}
          </div>
        </SettingRow>

        {settings.soundEnabled && (
          <SettingRow label={t('settings.volume')} description={t('settings.volumePercent', { percent: settings.soundVolume })}>
            <div style={styles.sliderContainer}>
              <input
                type="range"
                min="0"
                max="100"
                value={settings.soundVolume}
                onChange={(e) => updateSetting('soundVolume', Number(e.target.value))}
                style={styles.slider}
                aria-label={t('settings.volumeAria')}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={settings.soundVolume}
              />
              <button
                type="button"
                onClick={() => {
                  if (settings.soundVolume > 0) {
                    updateSetting('soundVolume', 0);
                  } else {
                    updateSetting('soundVolume', 50); // Restore to default/medium volume
                  }
                }}
                style={styles.testButton}
                title={settings.soundVolume > 0 ? t('settings.mute') : t('settings.unmute')}
              >
                {settings.soundVolume > 0 ? '🔊' : '🔇'}
              </button>
              {onTestSound && (
                <button type="button" onClick={onTestSound} style={styles.testButton}>
                  Test
                </button>
              )}
            </div>
          </SettingRow>
        )}

        {/* Custom Sound Upload */}
        <SettingRow label={t('settings.customSound')} description={t('settings.uploadHint', { maxKB: Math.round(MAX_SOUND_FILE_SIZE / 1024) })}>
          <div style={styles.uploadContainer}>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/mpeg,audio/mp3"
              onChange={(e) => void handleFileUpload(e)}
              style={{ display: 'none' }}
              id="custom-sound-upload"
            />
            <label htmlFor="custom-sound-upload" style={styles.uploadButton}>
              {isUploading ? t('settings.uploading') : t('settings.upload')}
            </label>
            {settings.hasCustomSound && (
              <button
                type="button"
                onClick={() => void handleDeleteCustomSound()}
                style={styles.deleteButton}
              >
                {t('settings.delete')}
              </button>
            )}
          </div>
        </SettingRow>
        {uploadError && <div style={styles.errorText}>{uploadError}</div>}
      </section>

      {/* Feedback Section */}
      <section style={styles.section}>
        <h3 style={styles.sectionTitle}>{t('settings.feedback')}</h3>

        <SettingRow label={t('settings.vibration')} description={t('settings.vibrationDesc')}>
          <Toggle
            checked={settings.hapticEnabled}
            onChange={(v) => updateSetting('hapticEnabled', v)}
            label={t('settings.enableVibration')}
          />
        </SettingRow>

        <SettingRow label={t('settings.keepScreenOn')} description={t('settings.keepScreenOnDesc')}>
          <Toggle
            checked={settings.wakeLockEnabled}
            onChange={(v) => updateSetting('wakeLockEnabled', v)}
            label={t('settings.enableKeepScreenOn')}
          />
        </SettingRow>
      </section>

      {/* Auto-Advance Section */}
      <section style={styles.section}>
        <h3 style={styles.sectionTitle}>{t('settings.afterMatch')}</h3>

        <SettingRow label={t('settings.autoEnd')} description={t('settings.autoEndDesc')}>
          <Toggle
            checked={settings.autoFinishEnabled}
            onChange={(v) => updateSetting('autoFinishEnabled', v)}
            label={t('settings.enableAutoEnd')}
          />
        </SettingRow>

        {settings.autoFinishEnabled && (
          <SettingRow label={t('settings.delay')} description={t('settings.delayDesc')}>
            <select
              value={String(settings.autoAdvanceSeconds)}
              onChange={(e) => updateSetting('autoAdvanceSeconds', Number(e.target.value))}
              style={styles.select}
            >
              {AUTO_ADVANCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </SettingRow>
        )}
      </section>
    </div>
  );
}

// =============================================================================
// Sub-Components
// =============================================================================

interface SettingRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

function SettingRow({ label, description, children }: SettingRowProps): React.ReactNode {
  return (
    <div style={styles.row}>
      <div style={styles.rowContent}>
        <span style={styles.rowLabel}>{label}</span>
        {description && <span style={styles.rowDescription}>{description}</span>}
      </div>
      <div style={styles.rowControl}>{children}</div>
    </div>
  );
}

interface ToggleProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  /** Accessible label for screen readers */
  label?: string;
}

function Toggle({ checked, onChange, disabled, label }: ToggleProps): React.ReactNode {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => !disabled && onChange(!checked)}
      style={{
        ...styles.toggle,
        ...(checked ? styles.toggleOn : styles.toggleOff),
        ...(disabled ? styles.toggleDisabled : {}),
      }}
      disabled={disabled}
    >
      <span
        style={{
          ...styles.toggleThumb,
          ...(checked ? styles.toggleThumbOn : styles.toggleThumbOff),
        }}
      />
    </button>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.lg,
  },
  section: {
    background: cssVars.colors.surface,
    borderRadius: cssVars.borderRadius.lg,
    padding: cssVars.spacing.md,
  },
  sectionTitle: {
    margin: 0,
    marginBottom: cssVars.spacing.md,
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
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
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.medium,
    color: cssVars.colors.textPrimary,
  },
  rowDescription: {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
  },
  rowControl: {
    flexShrink: 0,
  },

  // Select
  select: {
    minWidth: `${SELECT_MIN_WIDTH}px`,
    height: `${SELECT_HEIGHT}px`,
    padding: `0 ${cssVars.spacing.lg} 0 ${cssVars.spacing.sm}`,
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textPrimary,
    background: cssVars.colors.surfaceSolid,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    cursor: 'pointer',
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23A3B8D4' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 8px center',
    backgroundSize: '16px',
  },

  // Toggle
  toggle: {
    position: 'relative',
    width: `${TOGGLE_WIDTH}px`,
    height: `${TOGGLE_HEIGHT}px`,
    borderRadius: cssVars.borderRadius.full,
    border: 'none',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
    padding: 0,
  },
  toggleOff: {
    background: cssVars.colors.surfaceLight,
  },
  toggleOn: {
    background: cssVars.colors.primary,
  },
  toggleDisabled: {
    cursor: 'not-allowed',
    opacity: 0.5,
  },
  toggleThumb: {
    position: 'absolute',
    top: `${TOGGLE_THUMB_SPACING}px`,
    width: `${TOGGLE_THUMB_SIZE}px`,
    height: `${TOGGLE_THUMB_SIZE}px`,
    borderRadius: cssVars.borderRadius.full,
    background: cssVars.colors.textPrimary,
    transition: 'left 0.2s ease',
    boxShadow: cssVars.shadows.sm,
  },
  toggleThumbOff: {
    left: `${TOGGLE_THUMB_SPACING}px`,
  },
  toggleThumbOn: {
    left: `${TOGGLE_THUMB_ON_POSITION}px`,
  },

  // Slider
  sliderContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
  },
  slider: {
    width: `${SLIDER_WIDTH}px`,
    height: `${SLIDER_HEIGHT}px`,
    appearance: 'none',
    background: cssVars.colors.surfaceLight,
    borderRadius: cssVars.borderRadius.full,
    cursor: 'pointer',
  },
  testButton: {
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.primary,
    background: cssVars.colors.primaryLight,
    border: 'none',
    borderRadius: cssVars.borderRadius.md,
    cursor: 'pointer',
  },

  // Upload
  uploadContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
  },
  uploadButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.md}`,
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.medium,
    color: cssVars.colors.primary,
    background: cssVars.colors.primaryLight,
    border: 'none',
    borderRadius: cssVars.borderRadius.md,
    cursor: 'pointer',
  },
  deleteButton: {
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.error,
    background: 'transparent',
    border: `1px solid ${cssVars.colors.error}`,
    borderRadius: cssVars.borderRadius.md,
    cursor: 'pointer',
  },
  errorText: {
    marginTop: cssVars.spacing.sm,
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.error,
  },
};

export default MatchCockpitSettingsPanel;
