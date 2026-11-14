/**
 * MatchSoundSection: Ton-Abschnitt der Einstellungen des Match Cockpits – Wahl des Abpfiff-Tons und eigener Ton hochladen (Ein/Aus und Lautstärke: je Gerät, `useCockpitTon`).
 * Aus `MatchCockpitSettingsPanel.tsx` gelöst (H4-12), Verhalten gleich.
 */

import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../design-tokens';
import { Button } from '../ui';
import type { MatchCockpitSettings, MatchSoundPreset } from '../../types/tournament';
import { storeCustomSound, deleteCustomSound, MAX_SOUND_FILE_SIZE } from '../../utils/soundStorage';
import { SettingRow } from './SettingRow';
import { styles } from './settingsPanelStile';

export interface MatchSoundSectionProps {
  settings: MatchCockpitSettings;
  onChange: (settings: MatchCockpitSettings) => void;
  tournamentId: string;
  onTestSound?: () => void;
}

export function MatchSoundSection({ settings, onChange, tournamentId, onTestSound }: MatchSoundSectionProps): React.ReactNode {
  const { t } = useTranslation('cockpit');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const SOUND_PRESET_OPTIONS: { value: MatchSoundPreset | 'none'; label: string }[] = [
    { value: 'none', label: t('settings.noSound') },
    { value: 'horn-1', label: t('settings.horn1') },
    { value: 'horn-2', label: t('settings.horn2') },
    { value: 'horn-3', label: t('settings.horn3') },
    { value: 'custom', label: t('settings.customSound') },
  ];

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
  // H4-12: nur die Tonwahl zählt; Ein/Aus und Lautstärke gelten je Gerät (`useCockpitTon`), `soundEnabled` wird nicht mehr gelesen
  const currentSoundValue = settings.soundId ?? 'none';

  return (
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
  );
}
