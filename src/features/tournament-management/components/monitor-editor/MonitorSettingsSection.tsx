/**
 * Einstellungen des Monitor-Editors (M1a ausgelagert): Name, Folienzeit, Wechsel, Darstellung, Farbschema, Bildrand.
 */

import { useTranslation } from 'react-i18next';
import type { MonitorTheme, PerformanceMode, TournamentMonitor, TransitionType } from '../../../../types/monitor';
import { MonitorOverscanField } from '../MonitorOverscanField';
import {
  inputGroupStyle,
  inputStyle,
  labelStyle,
  sectionStyle,
  sectionTitleStyle,
  selectStyle,
  settingsGridStyle,
} from './monitorEditorStyles';

const TRANSITION_OPTIONS: { value: TransitionType; labelKey: string }[] = [
  { value: 'fade', labelKey: 'monitorEditor.settings.transitions.fade' },
  { value: 'slide', labelKey: 'monitorEditor.settings.transitions.slide' },
  { value: 'none', labelKey: 'monitorEditor.settings.transitions.none' },
];

const PERFORMANCE_OPTIONS: { value: PerformanceMode; labelKey: string; descriptionKey: string }[] = [
  { value: 'auto', labelKey: 'monitorEditor.settings.performance.auto', descriptionKey: 'monitorEditor.settings.performance.autoDesc' },
  { value: 'high', labelKey: 'monitorEditor.settings.performance.high', descriptionKey: 'monitorEditor.settings.performance.highDesc' },
  { value: 'low', labelKey: 'monitorEditor.settings.performance.low', descriptionKey: 'monitorEditor.settings.performance.lowDesc' },
];

const THEME_OPTIONS: { value: MonitorTheme; labelKey: string; descriptionKey: string }[] = [
  { value: 'dark', labelKey: 'monitorEditor.settings.themes.dark', descriptionKey: 'monitorEditor.settings.themes.darkDesc' },
  { value: 'light', labelKey: 'monitorEditor.settings.themes.light', descriptionKey: 'monitorEditor.settings.themes.lightDesc' },
  { value: 'auto', labelKey: 'monitorEditor.settings.themes.auto', descriptionKey: 'monitorEditor.settings.themes.autoDesc' },
];

const DURATION_PRESETS = [5, 10, 15, 20, 30, 45, 60];

interface MonitorSettingsSectionProps {
  monitor: TournamentMonitor;
  onUpdateSettings: (updates: {
    name?: string;
    defaultSlideDuration?: number;
    transition?: TransitionType;
    transitionDuration?: number;
    performanceMode?: PerformanceMode;
    theme?: MonitorTheme;
    overscanPercent?: number;
  }) => Promise<void>;
}

export function MonitorSettingsSection({ monitor, onUpdateSettings }: MonitorSettingsSectionProps) {
  const { t } = useTranslation('tournament');

  return (
    <div style={sectionStyle}>
      <h3 style={sectionTitleStyle}>{t('monitorEditor.settings.title')}</h3>
      <div style={settingsGridStyle}>
        {/* Name */}
        <div style={inputGroupStyle}>
          <label style={labelStyle}>{t('monitorEditor.settings.name')}</label>
          <input
            type="text"
            style={inputStyle}
            value={monitor.name}
            onChange={(e) => void onUpdateSettings({ name: e.target.value })}
          />
        </div>

        {/* Duration */}
        <div style={inputGroupStyle}>
          <label style={labelStyle}>{t('monitorEditor.settings.slideDuration')}</label>
          <select
            style={selectStyle}
            value={monitor.defaultSlideDuration}
            onChange={(e) => void onUpdateSettings({ defaultSlideDuration: Number(e.target.value) })}
          >
            {DURATION_PRESETS.map(d => (
              <option key={d} value={d}>{d}s</option>
            ))}
          </select>
        </div>

        {/* Transition */}
        <div style={inputGroupStyle}>
          <label style={labelStyle}>{t('monitorEditor.settings.transition')}</label>
          <select
            style={selectStyle}
            value={monitor.transition}
            onChange={(e) => void onUpdateSettings({ transition: e.target.value as TransitionType })}
          >
            {TRANSITION_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{t(opt.labelKey as never)}</option>
            ))}
          </select>
        </div>

        {/* Performance Mode */}
        <div style={inputGroupStyle}>
          <label style={labelStyle}>{t('monitorEditor.settings.performanceLabel')}</label>
          <select
            style={selectStyle}
            value={monitor.performanceMode}
            onChange={(e) => void onUpdateSettings({ performanceMode: e.target.value as PerformanceMode })}
          >
            {PERFORMANCE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{t(opt.labelKey as never)}</option>
            ))}
          </select>
        </div>

        {/* Theme */}
        <div style={inputGroupStyle}>
          <label style={labelStyle}>{t('monitorEditor.settings.themeLabel')}</label>
          <select
            style={selectStyle}
            value={monitor.theme}
            onChange={(e) => void onUpdateSettings({ theme: e.target.value as MonitorTheme })}
          >
            {THEME_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{t(opt.labelKey as never)}</option>
            ))}
          </select>
        </div>

        {/* Bildrand in Prozent (@ME-067) */}
        <MonitorOverscanField
          value={monitor.overscanPercent}
          onChange={(overscanPercent) => void onUpdateSettings({ overscanPercent })}
        />
      </div>
    </div>
  );
}
