/**
 * MatchCockpitSettingsPanel
 *
 * Tournament-wide Match Cockpit Pro settings panel for Admin Center.
 * Manages timer direction, netto warning, sounds, haptics, and auto-advance.
 * Abschnitte: Spielregeln in `MatchRulesSections.tsx`, Ton in `MatchSoundSection.tsx`, Bausteine in `SettingRow.tsx`/`settingsPanelStile.ts`.
 *
 * @see docs/concepts/MATCH-COCKPIT-PRO-KONZEPT.md Section 4
 */

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ToggleSwitch } from '../ui/atoms';
import type { MatchCockpitSettings, TimerDirection } from '../../types/tournament';
import { MatchRulesSections } from './MatchRulesSections';
import { MatchSoundSection } from './MatchSoundSection';
import { SettingRow } from './SettingRow';
import { styles } from './settingsPanelStile';

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

export function MatchCockpitSettingsPanel({
  settings,
  onChange,
  tournamentId,
  onTestSound,
  readOnly = false,
}: MatchCockpitSettingsPanelProps): React.ReactNode {
  const { t } = useTranslation('cockpit');

  const TIMER_DIRECTION_OPTIONS: { value: TimerDirection; label: string }[] = [
    { value: 'countdown', label: t('settings.countdown') },
    { value: 'elapsed', label: t('settings.elapsed') },
  ];

  // Update a single setting
  const updateSetting = useCallback(
    <K extends keyof MatchCockpitSettings>(key: K, value: MatchCockpitSettings[K]) => {
      onChange({ ...settings, [key]: value });
    },
    [settings, onChange]
  );

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

      <MatchRulesSections settings={settings} updateSetting={updateSetting} />

      <MatchSoundSection settings={settings} onChange={onChange} tournamentId={tournamentId} onTestSound={onTestSound} />

      {/* Feedback Section */}
      <section style={styles.section}>
        <h3 style={styles.sectionTitle}>{t('settings.feedback')}</h3>

        <SettingRow label={t('settings.vibration')} description={t('settings.vibrationDesc')}>
          <ToggleSwitch
            checked={settings.hapticEnabled}
            onChange={(v) => updateSetting('hapticEnabled', v)}
            label={t('settings.enableVibration')}
          />
        </SettingRow>
      </section>
    </fieldset>
  );
}

export default MatchCockpitSettingsPanel;
