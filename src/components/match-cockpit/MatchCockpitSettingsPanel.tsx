/**
 * MatchCockpitSettingsPanel
 *
 * Tournament-wide Match Cockpit Pro settings panel for Admin Center.
 * Manages timer direction, netto warning, sounds, haptics, and auto-advance.
 *
 * @see docs/concepts/MATCH-COCKPIT-PRO-KONZEPT.md Section 4
 */

import { CSSProperties, useCallback, useRef, useState } from 'react';
import { cssVars } from '../../design-tokens';
import type {
  MatchCockpitSettings,
  MatchSoundPreset,
  TimerDirection,
} from '../../types/tournament';
import { storeCustomSound, deleteCustomSound } from '../../utils/soundStorage';

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

const TIMER_DIRECTION_OPTIONS: { value: TimerDirection; label: string }[] = [
  { value: 'countdown', label: 'Countdown (5:00 → 0:00)' },
  { value: 'elapsed', label: 'Elapsed (0:00 → 5:00)' },
];

const SOUND_PRESET_OPTIONS: { value: MatchSoundPreset | 'none'; label: string }[] = [
  { value: 'none', label: 'Kein Sound' },
  { value: 'horn-1', label: 'Horn 1 (Klassisch)' },
  { value: 'horn-2', label: 'Horn 2 (Modern)' },
  { value: 'horn-3', label: 'Horn 3 (Tief)' },
  { value: 'custom', label: 'Eigener Sound' },
];

const NETTO_WARNING_OPTIONS = [
  { value: '60', label: '1 Minute' },
  { value: '90', label: '1:30 Minuten' },
  { value: '120', label: '2 Minuten' },
  { value: '180', label: '3 Minuten' },
];

const AUTO_ADVANCE_OPTIONS = [
  { value: '5', label: '5 Sekunden' },
  { value: '10', label: '10 Sekunden' },
  { value: '15', label: '15 Sekunden' },
  { value: '20', label: '20 Sekunden' },
];

// =============================================================================
// Component
// =============================================================================

export function MatchCockpitSettingsPanel({
  settings,
  onChange,
  tournamentId,
  onTestSound,
}: MatchCockpitSettingsPanelProps): JSX.Element {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        setUploadError(result.error ?? 'Upload fehlgeschlagen');
      }

      setIsUploading(false);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [tournamentId, updateSetting]
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
        <h3 style={styles.sectionTitle}>Timer</h3>

        <SettingRow label="Timer-Richtung" description="Wie soll der Timer angezeigt werden?">
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
          label="Netto-Zeit Warnung"
          description="Warnung wenn Nachspielzeit erreicht wird"
        >
          <Toggle
            checked={settings.nettoWarningEnabled}
            onChange={(v) => updateSetting('nettoWarningEnabled', v)}
          />
        </SettingRow>

        {settings.nettoWarningEnabled && (
          <SettingRow label="Warnzeit" description="Warnung bei verbleibender Zeit">
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
        <h3 style={styles.sectionTitle}>Sound</h3>

        <SettingRow label="Spielende-Sound" description="Akustisches Signal bei Spielende">
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
                {opt.value === 'custom' && !settings.hasCustomSound && ' (nicht hochgeladen)'}
              </option>
            ))}
          </select>
        </SettingRow>

        {settings.soundEnabled && (
          <SettingRow label="Lautstärke" description={`${settings.soundVolume}%`}>
            <div style={styles.sliderContainer}>
              <input
                type="range"
                min="0"
                max="100"
                value={settings.soundVolume}
                onChange={(e) => updateSetting('soundVolume', Number(e.target.value))}
                style={styles.slider}
              />
              {onTestSound && (
                <button type="button" onClick={onTestSound} style={styles.testButton}>
                  Test
                </button>
              )}
            </div>
          </SettingRow>
        )}

        {/* Custom Sound Upload */}
        <SettingRow label="Eigener Sound" description="MP3-Datei hochladen (max 2MB)">
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
              {isUploading ? 'Wird hochgeladen...' : 'Hochladen'}
            </label>
            {settings.hasCustomSound && (
              <button
                type="button"
                onClick={() => void handleDeleteCustomSound()}
                style={styles.deleteButton}
              >
                Löschen
              </button>
            )}
          </div>
        </SettingRow>
        {uploadError && <div style={styles.errorText}>{uploadError}</div>}
      </section>

      {/* Feedback Section */}
      <section style={styles.section}>
        <h3 style={styles.sectionTitle}>Feedback</h3>

        <SettingRow label="Vibration" description="Haptisches Feedback bei Tor und Spielende">
          <Toggle
            checked={settings.hapticEnabled}
            onChange={(v) => updateSetting('hapticEnabled', v)}
          />
        </SettingRow>

        <SettingRow label="Bildschirm aktiv halten" description="Verhindert Dimmen während Spiel">
          <Toggle
            checked={settings.wakeLockEnabled}
            onChange={(v) => updateSetting('wakeLockEnabled', v)}
          />
        </SettingRow>
      </section>

      {/* Auto-Advance Section */}
      <section style={styles.section}>
        <h3 style={styles.sectionTitle}>Nach Spielende</h3>

        <SettingRow label="Auto-Beenden" description="Spiel automatisch bei 0:00 beenden">
          <Toggle
            checked={settings.autoFinishEnabled}
            onChange={(v) => updateSetting('autoFinishEnabled', v)}
          />
        </SettingRow>

        {settings.autoFinishEnabled && (
          <SettingRow label="Verzögerung" description="Zeit bis zum nächsten Spiel">
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

function SettingRow({ label, description, children }: SettingRowProps): JSX.Element {
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
}

function Toggle({ checked, onChange, disabled }: ToggleProps): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
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
    minWidth: '180px',
    height: '40px',
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
    width: '52px',
    height: '28px',
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
    top: '2px',
    width: '24px',
    height: '24px',
    borderRadius: cssVars.borderRadius.full,
    background: cssVars.colors.textPrimary,
    transition: 'left 0.2s ease',
    boxShadow: cssVars.shadows.sm,
  },
  toggleThumbOff: {
    left: '2px',
  },
  toggleThumbOn: {
    left: '26px',
  },

  // Slider
  sliderContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
  },
  slider: {
    width: '120px',
    height: '6px',
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
