/**
 * MatchCockpitSettingsPanel
 *
 * Tournament-wide Match Cockpit Pro settings panel for Admin Center.
 * Manages timer direction, netto warning, sounds, haptics, and auto-advance.
 *
 * @see docs/concepts/MATCH-COCKPIT-PRO-KONZEPT.md Section 4
 */

import { CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../design-tokens';
import { Input, Button } from '../ui';
import { useRulesLocked } from './RulesLockContext';
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
const SLIDER_WIDTH = 120;

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
  /** Task R2 Fixrunde 3 (Review-Befund M/Regel 2): die Settings zeigen echte, synchronisierte
   *  Werte (kein Lokalzustand wie beim Strafstoßschießen) — "Ansehen bleibt erlaubt" gilt also
   *  wörtlich. Unter readOnly bleibt das Panel sichtbar, alle Eingaben werden aber über ein
   *  natives `<fieldset disabled>` gesperrt (kein einzelner Callback mehr auslösbar). */
  readOnly?: boolean;
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
  readOnly = false,
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

  // Spielregel Zeitstrafe (@W2A-029): die Turnierleitung stellt die Dauer ein
  // (60/120/300 s; die Spielsteuerung bietet keine Dauer an, sie nimmt die Regel des Spiels, @W2A-016).
  const TIME_PENALTY_OPTIONS: { value: number; label: string }[] = [
    { value: 60, label: t('timePenalty.oneMin') },
    { value: 120, label: t('timePenalty.twoMin') },
    { value: 300, label: t('timePenalty.fiveMin') },
  ];

  // Update a single setting
  const updateSetting = useCallback(
    <K extends keyof MatchCockpitSettings>(key: K, value: MatchCockpitSettings[K]) => {
      onChange({ ...settings, [key]: value });
    },
    [settings, onChange]
  );

  // Regelfelder sind für Nicht-Turnierleitung gesperrt (@W2A-030)
  const rulesLocked = useRulesLocked();

  // Spielregel Schützenzahl (@W2A-034): ungültige Werte (z. B. 0 Schützen) werden
  // beim Verlassen des Feldes abgelehnt — am Feld steht der gültige Bereich.
  const [schuetzenEntwurf, setSchuetzenEntwurf] = useState(String(settings.penaltyShootersPerTeam));
  const [schuetzenFehler, setSchuetzenFehler] = useState(false);

  // Wert von außen (z. B. nach dem Speichern oder bei Umschalten) in den Entwurf übernehmen
  useEffect(() => {
    setSchuetzenEntwurf(String(settings.penaltyShootersPerTeam));
  }, [settings.penaltyShootersPerTeam]);

  const handleSchuetzenBlur = useCallback(() => {
    const wert = Number(schuetzenEntwurf);
    if (!Number.isInteger(wert) || wert < 1 || wert > 5) {
      setSchuetzenFehler(true);
      setSchuetzenEntwurf(String(settings.penaltyShootersPerTeam));
      return;
    }
    setSchuetzenFehler(false);
    updateSetting('penaltyShootersPerTeam', wert);
  }, [schuetzenEntwurf, settings.penaltyShootersPerTeam, updateSetting]);

  // Handle sound preset change
  const handleSoundChange = useCallback(
    (value: string) => {
      // Ein einziger onChange: zwei aufeinanderfolgende updateSetting-Aufrufe
      // bauen beide auf demselben alten `settings` auf, der zweite überschriebe den ersten.
      if (value === 'none') {
        onChange({ ...settings, soundEnabled: false, soundId: null });
      } else {
        onChange({ ...settings, soundEnabled: true, soundId: value as MatchSoundPreset });
      }
    },
    [settings, onChange]
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
        onChange({ ...settings, hasCustomSound: true, soundId: 'custom', soundEnabled: true });
      } else {
        setUploadError(result.error ?? t('settings.uploadFailed'));
      }

      setIsUploading(false);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [tournamentId, settings, onChange, t]
  );

  // Handle custom sound delete
  const handleDeleteCustomSound = useCallback(async () => {
    await deleteCustomSound(tournamentId);
    onChange({
      ...settings,
      hasCustomSound: false,
      ...(settings.soundId === 'custom' ? { soundId: 'horn-1' as const } : {}),
    });
  }, [tournamentId, settings, onChange]);

  // Get current sound value for select
  const currentSoundValue = settings.soundEnabled && settings.soundId
    ? settings.soundId
    : 'none';

  return (
    // Task R2 Fixrunde 3: natives <fieldset disabled> statt <div> — deaktiviert jedes Formular-
    // Element darunter (select/input/button, inkl. der Toggle-Buttons) ohne jede Stelle einzeln
    // zu verdrahten. `styles.container` setzt border/margin/padding/minWidth zurück, damit das
    // Fieldset optisch identisch zum vorherigen <div> bleibt.
    <fieldset disabled={readOnly} style={styles.container}>
      {/* Timer Section */}
      <section style={styles.section}>
        <h3 style={styles.sectionTitle}>{t('settings.timer')}</h3>

        <SettingRow label={t('settings.timerDirection')} description={t('settings.timerDescription')}>
          <select
            value={settings.timerDirection}
            onChange={(e) => updateSetting('timerDirection', e.target.value as TimerDirection)}
            aria-label={t('settings.timerDirection')}
            style={styles.select}
          >
            {TIMER_DIRECTION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </SettingRow>
      </section>

      {/* Spielregel Zeitstrafe (@W2A-029) — gilt ab dem nächsten Anpfiff */}
      <section style={styles.section}>
        <h3 style={styles.sectionTitle}>{t('settings.timePenalty')}</h3>

        <SettingRow label={t('settings.timePenaltyDuration')} description={t('settings.timePenaltyDurationDesc')}>
          <select
            data-testid="settings-time-penalty-duration"
            value={settings.timePenaltyDurationSeconds}
            onChange={(e) => updateSetting('timePenaltyDurationSeconds', Number(e.target.value))}
            disabled={rulesLocked}
            aria-label={t('settings.timePenaltyDuration')}
            style={styles.select}
          >
            {TIME_PENALTY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </SettingRow>
        {rulesLocked && (
          <p style={{ margin: 0, fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary }}>
            {t('settings.rulesOnlyByLead')}
          </p>
        )}
      </section>

      {/* Spielregel Schützenzahl (@W2A-034) */}
      <section style={styles.section}>
        <h3 style={styles.sectionTitle}>{t('settings.penaltyShootout')}</h3>

        <SettingRow label={t('settings.penaltyShooters')} description={t('settings.penaltyShootersDesc')}>
          <Input
            type="number"
            value={schuetzenEntwurf}
            onChange={(v) => {
              setSchuetzenEntwurf(v);
              setSchuetzenFehler(false);
            }}
            onBlur={handleSchuetzenBlur}
            disabled={rulesLocked}
            aria-label={t('settings.penaltyShooters')}
            errorMessage={schuetzenFehler ? t('settings.penaltyShootersRangeError') : undefined}
            data-testid="settings-penalty-shooters"
          />
        </SettingRow>
      </section>

      {/* Sound Section */}
      <section style={styles.section}>
        <h3 style={styles.sectionTitle}>{t('settings.sound')}</h3>

        <SettingRow label={t('settings.endSound')} description={t('settings.endSoundDesc')}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: cssVars.spacing.sm, alignItems: 'center' }}>
            <select
              value={currentSoundValue}
              onChange={(e) => handleSoundChange(e.target.value)}
              aria-label={t('settings.endSound')}
              data-testid="settings-end-sound-select"
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
              <Button
                variant="secondary"
                size="sm"
                onClick={onTestSound}
                data-testid="settings-end-sound-listen"
              >
                {t('settings.listen')}
              </Button>
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
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (settings.soundVolume > 0) {
                    updateSetting('soundVolume', 0);
                  } else {
                    updateSetting('soundVolume', 50); // Restore to default/medium volume
                  }
                }}
                style={styles.iconButton}
                aria-label={settings.soundVolume > 0 ? t('settings.mute') : t('settings.unmute')}
                title={settings.soundVolume > 0 ? t('settings.mute') : t('settings.unmute')}
              >
                {settings.soundVolume > 0 ? '🔊' : '🔇'}
              </Button>
              {onTestSound && (
                <Button variant="secondary" size="sm" onClick={onTestSound} data-testid="settings-volume-listen">
                  {t('settings.listen')}
                </Button>
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
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? t('settings.uploading') : t('settings.upload')}
            </Button>
            {settings.hasCustomSound && (
              <Button variant="danger" size="sm" onClick={() => void handleDeleteCustomSound()}>
                {t('settings.delete')}
              </Button>
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
      </section>
    </fieldset>
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
      style={{ ...styles.toggle, ...(disabled ? styles.toggleDisabled : {}) }}
      disabled={disabled}
    >
      <span style={{ ...styles.toggleTrack, ...(checked ? styles.toggleOn : styles.toggleOff) }}>
        <span
          style={{
            ...styles.toggleThumb,
            ...(checked ? styles.toggleThumbOn : styles.toggleThumbOff),
          }}
        />
      </span>
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
    // Task R2 Fixrunde 3: Reset der nativen <fieldset>-Default-Styles (Browser setzen sonst
    // border/padding/margin/min-width auf das Element) — hält das Panel optisch identisch zum
    // vorherigen <div>.
    border: 'none',
    margin: 0,
    padding: 0,
    minWidth: 0,
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
    flexWrap: 'wrap', // schmale Anzeige: Bedienelement rutscht unter die Beschriftung statt sie zu überdecken
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
    flex: '1 1 50%',
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
    maxWidth: '100%',
  },

  // Select
  select: {
    minWidth: `min(${SELECT_MIN_WIDTH}px, 100%)`, // nie breiter als die Karte (@OB-021)
    maxWidth: '100%',
    flex: '1 1 auto',
    height: cssVars.touchTargets.minimum, // @OB-022: Bedienelemente mindestens 44 hoch
    padding: `0 ${cssVars.spacing.lg} 0 ${cssVars.spacing.sm}`,
    fontSize: cssVars.fontSizes.lg, // @OB-022: Eingabefelder mindestens 16
    fontFamily: cssVars.fontFamilies.body,
    color: cssVars.colors.textPrimary,
    background: cssVars.colors.surfaceSolid,
    border: `1px solid ${cssVars.colors.borderControl}`,
    borderRadius: cssVars.borderRadius.md,
    cursor: 'pointer',
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23A3B8D4' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 8px center',
    backgroundSize: '16px',
  },

  // Toggle
  // Tippfläche mindestens 44 hoch (@OB-022); die sichtbare Spur (toggleTrack) bleibt so klein wie bisher
  toggle: {
    display: 'flex',
    alignItems: 'center',
    width: `${TOGGLE_WIDTH}px`,
    height: cssVars.touchTargets.minimum,
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
  },
  toggleTrack: {
    position: 'relative',
    width: `${TOGGLE_WIDTH}px`,
    height: `${TOGGLE_HEIGHT}px`,
    borderRadius: cssVars.borderRadius.full,
    transition: 'background-color 0.2s ease',
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
    flexWrap: 'wrap', // „Anhören“ bricht auf schmalen Handys in die nächste Zeile statt über den Rand zu ragen
    alignItems: 'center',
    gap: cssVars.spacing.sm,
  },
  // Schieberegler in nativer Darstellung: Tippfläche mindestens 44 hoch, Schrift mindestens 16 (@OB-022)
  slider: {
    width: `${SLIDER_WIDTH}px`,
    height: cssVars.touchTargets.minimum,
    fontSize: cssVars.fontSizes.lg,
    accentColor: cssVars.colors.primary,
    cursor: 'pointer',
  },
  iconButton: {
    minWidth: cssVars.touchTargets.minimum,
  },

  // Upload
  uploadContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
  },
  errorText: {
    marginTop: cssVars.spacing.sm,
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.error,
  },
};

export default MatchCockpitSettingsPanel;
