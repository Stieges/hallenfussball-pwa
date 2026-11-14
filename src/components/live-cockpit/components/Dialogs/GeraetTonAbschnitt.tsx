/**
 * GeraetTonAbschnitt (H4-12, @HT-009, @SL-125): „Ton dieses Geräts“ im Cockpit-Dialog – nur Ton an/aus und Lautstärke dieses Geräts
 * (`useCockpitTon`, lokal, nicht im Turnier). Die Tonwahl und der eigene Ton bleiben Sache der Turnierleitung (Admin „Match Cockpit“).
 * Unter `readOnly` (kein Steuerrecht) bleibt der Abschnitt bedienbar: es ist die Einstellung des Geräts, nicht des Turniers.
 */
import { useTranslation } from 'react-i18next';
import { Button } from '../../../ui';
import { ToggleSwitch } from '../../../ui/atoms';
import { SettingRow } from '../../../match-settings/SettingRow';
import { styles } from '../../../match-settings/settingsPanelStile';
import { cssVars } from '../../../../design-tokens';
import { useCockpitTon } from '../../hooks/useCockpitTon';

export interface GeraetTonAbschnittProps {
  onTestSound?: () => void;
}

export function GeraetTonAbschnitt({ onTestSound }: GeraetTonAbschnittProps): React.ReactNode {
  const { t } = useTranslation('cockpit');
  const ton = useCockpitTon();
  return (
    <section style={{ ...styles.section, marginTop: cssVars.spacing.lg }} data-testid="cockpit-geraet-ton">
      <h3 style={styles.sectionTitle}>{t('settings.deviceTitle')}</h3>
      <SettingRow label={t('settings.deviceSwitch')} description={t('settings.deviceSwitchDesc')}>
        <ToggleSwitch checked={ton.an} onChange={ton.setAn} label={t('settings.deviceSwitchAria')} data-testid="cockpit-ton-schalter" />
      </SettingRow>
      {ton.an && (
        <SettingRow label={t('settings.volume')} description={t('settings.deviceVolumeDesc', { percent: ton.lautstaerke })}>
          <div style={styles.sliderContainer}>
            <input
              type="range" min="0" max="100" value={ton.lautstaerke} style={styles.slider}
              onChange={(e) => ton.setLautstaerke(Number(e.target.value))}
              aria-label={t('settings.volumeAria')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={ton.lautstaerke}
              data-testid="cockpit-ton-regler"
            />
            {onTestSound && (
              <Button variant="secondary" size="sm" onClick={onTestSound} data-testid="cockpit-ton-anhoeren">
                {t('settings.listen')}
              </Button>
            )}
          </div>
        </SettingRow>
      )}
    </section>
  );
}
