/**
 * Einstellungen des Monitor-Editors: Name, Folienzeit, Wechsel, Darstellung, Farbschema, Bildrand.
 * Alles wirkt nur auf den Entwurf (@ME-071); Fehler des Namens stehen am Feld (@ME-072).
 */

import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { MonitorTheme, PerformanceMode, TournamentMonitor, TransitionType } from '../../../../types/monitor';
import { MonitorOverscanField } from '../MonitorOverscanField';
import type { MonitorSettingsUpdate } from './monitorDraft';
import type { MonitorNameError } from './validateMonitorName';
import {
  fieldErrorStyle,
  inputGroupStyle,
  inputInvalidStyle,
  inputStyle,
  labelStyle,
  sectionStyle,
  sectionTitleStyle,
  selectStyle,
  settingsGridStyle,
} from './monitorEditorStyles';

const DURATION_PRESETS = [5, 10, 15, 20, 30, 45, 60];

interface MonitorSettingsSectionProps {
  monitor: TournamentMonitor;
  nameError: MonitorNameError | null;
  onUpdateSettings: (updates: MonitorSettingsUpdate) => void;
}

interface Option<V extends string> {
  value: V;
  label: string;
}

/** Wert aus einer Auswahl zurückholen, ohne Typ-Umwandlung: nur ein vorhandener Wert zählt. */
function pick<V extends string>(options: readonly Option<V>[], raw: string): V | undefined {
  return options.find(o => o.value === raw)?.value;
}

export function MonitorSettingsSection({ monitor, nameError, onUpdateSettings }: MonitorSettingsSectionProps) {
  const { t } = useTranslation('tournament');
  const id = useId();

  const transitions: Option<TransitionType>[] = [
    { value: 'fade', label: t('monitorEditor.settings.transitions.fade') },
    { value: 'slide', label: t('monitorEditor.settings.transitions.slide') },
    { value: 'none', label: t('monitorEditor.settings.transitions.none') },
  ];
  const performances: Option<PerformanceMode>[] = [
    { value: 'auto', label: t('monitorEditor.settings.performance.auto') },
    { value: 'high', label: t('monitorEditor.settings.performance.high') },
    { value: 'low', label: t('monitorEditor.settings.performance.low') },
  ];
  const themes: Option<MonitorTheme>[] = [
    { value: 'dark', label: t('monitorEditor.settings.themes.dark') },
    { value: 'light', label: t('monitorEditor.settings.themes.light') },
    { value: 'auto', label: t('monitorEditor.settings.themes.auto') },
  ];

  const nameId = `${id}-name`;
  const nameErrorId = `${id}-name-error`;

  return (
    <div style={sectionStyle}>
      <h3 style={sectionTitleStyle}>{t('monitorEditor.settings.title')}</h3>
      <div style={settingsGridStyle}>
        <div style={inputGroupStyle}>
          <label htmlFor={nameId} style={labelStyle}>{t('monitorEditor.settings.name')}</label>
          <input
            id={nameId}
            data-testid="monitor-name-input"
            type="text"
            style={nameError ? { ...inputStyle, ...inputInvalidStyle } : inputStyle}
            value={monitor.name}
            aria-invalid={nameError !== null}
            aria-describedby={nameError ? nameErrorId : undefined}
            onChange={(e) => onUpdateSettings({ name: e.target.value })}
          />
          {nameError && (
            <div id={nameErrorId} role="alert" data-testid="monitor-name-error" style={fieldErrorStyle}>
              {t(`monitors.errors.${nameError}`)}
            </div>
          )}
        </div>

        <div style={inputGroupStyle}>
          <label htmlFor={`${id}-duration`} style={labelStyle}>{t('monitorEditor.settings.slideDuration')}</label>
          <select
            id={`${id}-duration`}
            data-testid="monitor-duration-select"
            style={selectStyle}
            value={monitor.defaultSlideDuration}
            onChange={(e) => onUpdateSettings({ defaultSlideDuration: Number(e.target.value) })}
          >
            {DURATION_PRESETS.map(d => (
              <option key={d} value={d}>{d}s</option>
            ))}
          </select>
        </div>

        <div style={inputGroupStyle}>
          <label htmlFor={`${id}-transition`} style={labelStyle}>{t('monitorEditor.settings.transition')}</label>
          <select
            id={`${id}-transition`}
            style={selectStyle}
            value={monitor.transition}
            onChange={(e) => {
              const value = pick(transitions, e.target.value);
              if (value) {onUpdateSettings({ transition: value });}
            }}
          >
            {transitions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div style={inputGroupStyle}>
          <label htmlFor={`${id}-performance`} style={labelStyle}>{t('monitorEditor.settings.performanceLabel')}</label>
          <select
            id={`${id}-performance`}
            style={selectStyle}
            value={monitor.performanceMode}
            onChange={(e) => {
              const value = pick(performances, e.target.value);
              if (value) {onUpdateSettings({ performanceMode: value });}
            }}
          >
            {performances.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div style={inputGroupStyle}>
          <label htmlFor={`${id}-theme`} style={labelStyle}>{t('monitorEditor.settings.themeLabel')}</label>
          <select
            id={`${id}-theme`}
            data-testid="monitor-theme-select"
            style={selectStyle}
            value={monitor.theme}
            onChange={(e) => {
              const value = pick(themes, e.target.value);
              if (value) {onUpdateSettings({ theme: value });}
            }}
          >
            {themes.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Bildrand in Prozent (@ME-067) */}
        <MonitorOverscanField
          value={monitor.overscanPercent}
          onChange={(overscanPercent) => onUpdateSettings({ overscanPercent })}
        />
      </div>
    </div>
  );
}
