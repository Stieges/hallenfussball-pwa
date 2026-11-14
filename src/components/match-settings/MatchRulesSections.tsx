/**
 * MatchRulesSections: die Spielregel-Abschnitte der Einstellungen des Match Cockpits – Zeitstrafe (@W2A-029, @W2A-080) und
 * Schützenzahl im Strafstoßschießen (@W2A-034). Aus `MatchCockpitSettingsPanel.tsx` gelöst (H4-12), Verhalten gleich.
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../design-tokens';
import { Input } from '../ui';
import { CheckboxField } from '../ui/molecules/CheckboxField';
import { useRulesLocked } from './RulesLockContext';
import type { MatchCockpitSettings } from '../../types/tournament';
import { SettingRow } from './SettingRow';
import { styles } from './settingsPanelStile';

export interface MatchRulesSectionsProps {
  settings: MatchCockpitSettings;
  updateSetting: <K extends keyof MatchCockpitSettings>(key: K, value: MatchCockpitSettings[K]) => void;
}

export function MatchRulesSections({ settings, updateSetting }: MatchRulesSectionsProps): React.ReactNode {
  const { t } = useTranslation('cockpit');
  // Regelfelder sind für Nicht-Turnierleitung gesperrt (@W2A-030)
  const rulesLocked = useRulesLocked();

  // Spielregel Zeitstrafe (@W2A-029): die Turnierleitung stellt die Dauer ein
  // (60/120/300 s; die Spielsteuerung bietet keine Dauer an, sie nimmt die Regel des Spiels, @W2A-016).
  const TIME_PENALTY_OPTIONS: { value: number; label: string }[] = [
    { value: 60, label: t('timePenalty.oneMin') },
    { value: 120, label: t('timePenalty.twoMin') },
    { value: 300, label: t('timePenalty.fiveMin') },
  ];

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

  return (
    <>
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
      {/* @W2A-080: Regel „Zeitstrafe endet bei Gegentor“, vorbelegt an; gilt für Zeitstrafen ab ihrem Eintrag (@W2A-079) */}
      <CheckboxField
        checked={settings.penaltyEndsOnGoal}
        onChange={(checked) => updateSetting('penaltyEndsOnGoal', checked)}
        disabled={rulesLocked}
        label={t('settings.penaltyEndsOnGoal')}
        hint={t('settings.penaltyEndsOnGoalDesc')}
        data-testid="settings-penalty-ends-on-goal"
      />
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
    </>
  );
}
