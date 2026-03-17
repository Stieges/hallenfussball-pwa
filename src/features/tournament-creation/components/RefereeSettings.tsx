import { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Select, Input, NumberStepper } from '../../../components/ui';
import { cssVars } from '../../../design-tokens'
import { Tournament, RefereeMode, FinalsRefereeMode, RefereeConfig } from '../../../types/tournament';

interface RefereeSettingsProps {
  formData: Partial<Tournament>;
  onUpdate: <K extends keyof Tournament>(field: K, value: Tournament[K]) => void;
}

export const RefereeSettings: React.FC<RefereeSettingsProps> = ({
  formData,
  onUpdate,
}) => {
  const { t } = useTranslation('wizard');
  const refereeConfig = formData.refereeConfig;
  const mode = refereeConfig?.mode ?? 'none';
  const showFinalsOptions = mode === 'teams' && formData.groupSystem === 'groupsAndFinals';

  const handleModeChange = (newMode: string) => {
    const newConfig: RefereeConfig = {
      ...refereeConfig,
      mode: newMode as RefereeMode,
    };

    // Initialize defaults when switching to organizer mode
    if (newMode === 'organizer' && !refereeConfig?.numberOfReferees) {
      newConfig.numberOfReferees = 2;
      newConfig.maxConsecutiveMatches = 1;
    }

    onUpdate('refereeConfig', newConfig);
  };

  const handleNumberChange = (field: 'numberOfReferees' | 'maxConsecutiveMatches', value: number) => {
    const newConfig: RefereeConfig = {
      ...refereeConfig,
      mode: 'organizer',
      [field]: value,
    };

    // Adjust referee names if number changes
    if (field === 'numberOfReferees' && refereeConfig?.refereeNames) {
      const updatedNames: Record<number, string> = {};
      for (let i = 1; i <= value; i++) {
        updatedNames[i] = refereeConfig.refereeNames[i] ?? '';
      }
      newConfig.refereeNames = updatedNames;
    }

    onUpdate('refereeConfig', newConfig);
  };

  const handleNamesToggle = (enabled: boolean) => {
    const numberOfRefs = refereeConfig?.numberOfReferees ?? 2;

    if (enabled) {
      const names: Record<number, string> = {};
      for (let i = 1; i <= numberOfRefs; i++) {
        names[i] = '';
      }
      onUpdate('refereeConfig', {
        ...refereeConfig,
        mode: 'organizer',
        refereeNames: names,
      } as RefereeConfig);
    } else {
      // Remove names but keep other config
      const { refereeNames: _refereeNames, ...rest } = refereeConfig ?? {};
      onUpdate('refereeConfig', rest as RefereeConfig);
    }
  };

  const handleNameChange = (refNumber: number, name: string) => {
    const updatedNames = {
      ...(refereeConfig?.refereeNames ?? {}),
      [refNumber]: name,
    };
    onUpdate('refereeConfig', {
      ...refereeConfig,
      mode: 'organizer',
      refereeNames: updatedNames,
    } as RefereeConfig);
  };

  const handleFinalsRefereeMode = (newMode: string) => {
    onUpdate('refereeConfig', {
      ...refereeConfig,
      finalsRefereeMode: newMode as FinalsRefereeMode,
    } as RefereeConfig);
  };

  const containerStyle: CSSProperties = {
    marginTop: '32px',
  };

  const organizerSettingsStyle: CSSProperties = {
    marginTop: '16px',
    padding: '16px',
    background: cssVars.colors.accentBadge,
    borderRadius: cssVars.borderRadius.md,
    border: `1px solid ${cssVars.colors.accentLight}`,
  };

  const namesContainerStyle: CSSProperties = {
    marginTop: '12px',
    padding: '12px',
    background: cssVars.colors.surfaceDarkSubtle,
    borderRadius: cssVars.borderRadius.sm,
  };

  const hasNames = refereeConfig?.refereeNames && Object.keys(refereeConfig.refereeNames).length > 0;

  // Prüft ob ein Schiedsrichter ein Duplikat ist (= ein vorheriger SR hat denselben Namen)
  const isRefereeDuplicate = (refNumber: number, refName: string | undefined): boolean => {
    if (!refName?.trim()) {return false;}
    if (!refereeConfig?.refereeNames) {return false;}
    const normalizedName = refName.trim().toLowerCase();
    // Prüfe ob ein vorheriger Schiedsrichter (1 bis refNumber-1) denselben Namen hat
    for (let i = 1; i < refNumber; i++) {
      if (refereeConfig.refereeNames[i].trim().toLowerCase() === normalizedName) {
        return true;
      }
    }
    return false;
  };

  // Prüft ob ein Schiedsrichter ein Original ist (= ein späterer SR hat denselben Namen)
  const isRefereeOriginal = (refNumber: number, refName: string | undefined): boolean => {
    if (!refName?.trim()) {return false;}
    if (!refereeConfig?.refereeNames) {return false;}
    const normalizedName = refName.trim().toLowerCase();
    const totalRefs = refereeConfig.numberOfReferees ?? 2;
    // Prüfe ob ein späterer Schiedsrichter (refNumber+1 bis totalRefs) denselben Namen hat
    for (let i = refNumber + 1; i <= totalRefs; i++) {
      if (refereeConfig.refereeNames[i].trim().toLowerCase() === normalizedName) {
        return true;
      }
    }
    return false;
  };

  return (
    <div style={containerStyle}>
      <h3 style={{
        fontSize: cssVars.fontSizes.lg,
        fontWeight: cssVars.fontWeights.semibold,
        color: cssVars.colors.textPrimary,
        marginBottom: '16px'
      }}>
        {t('referees.title')}
      </h3>

      <Select
        label={t('referees.modeLabel')}
        value={mode}
        onChange={handleModeChange}
        options={[
          { value: 'none', label: t('referees.modes.none') },
          { value: 'organizer', label: t('referees.modes.organizer') },
          { value: 'teams', label: t('referees.modes.teams') },
        ]}
      />
      <p style={{ fontSize: cssVars.fontSizes.xs, color: cssVars.colors.textSecondary, lineHeight: '1.4', marginTop: '8px' }}>
        <strong>{t('referees.modeHint.organizerMode')}</strong> {t('referees.modeHint.organizerDescription')}{' '}
        <strong>{t('referees.modeHint.teamsMode')}</strong> {t('referees.modeHint.teamsDescription')}
      </p>

      {/* Organizer Mode Settings */}
      {mode === 'organizer' && (
        <div style={organizerSettingsStyle}>
          <div className="referee-grid" style={{ display: 'grid', gap: '16px', marginBottom: '16px' }}>
            <NumberStepper
              label={t('referees.organizerSettings.count')}
              value={refereeConfig?.numberOfReferees ?? 2}
              onChange={(v) => handleNumberChange('numberOfReferees', v)}
              min={1}
              max={20}
              mode="stepper"
            />
            <NumberStepper
              label={t('referees.organizerSettings.maxConsecutive')}
              value={refereeConfig?.maxConsecutiveMatches ?? 1}
              onChange={(v) => handleNumberChange('maxConsecutiveMatches', v)}
              min={1}
              max={5}
              mode="stepper"
            />
          </div>
          <p style={{ fontSize: cssVars.fontSizes.xs, color: cssVars.colors.textSecondary, lineHeight: '1.4', margin: '0 0 16px 0' }}>
            {t('referees.organizerSettings.distributionHint')}
          </p>

          {/* Names Checkbox */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', marginBottom: '12px' }}>
            <input
              type="checkbox"
              checked={hasNames}
              onChange={(e) => handleNamesToggle(e.target.checked)}
              style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: cssVars.colors.accent }}
            />
            <span style={{ color: cssVars.colors.textPrimary, fontSize: cssVars.fontSizes.md, fontWeight: cssVars.fontWeights.medium }}>
              {t('referees.organizerSettings.enableNames')}
            </span>
          </label>

          {/* Name Inputs */}
          {hasNames && (
            <div style={namesContainerStyle}>
              <h4 style={{ color: cssVars.colors.textPrimary, fontSize: cssVars.fontSizes.sm, margin: '0 0 12px 0', fontWeight: cssVars.fontWeights.semibold }}>
                {t('referees.organizerSettings.namesTitle')}
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {Array.from({ length: refereeConfig.numberOfReferees ?? 2 }, (_, i) => i + 1).map((refNumber) => {
                  const refName = refereeConfig.refereeNames?.[refNumber] ?? '';
                  const isDuplicate = isRefereeDuplicate(refNumber, refName);
                  const isOriginal = isRefereeOriginal(refNumber, refName);
                  const hasError = isDuplicate || isOriginal;
                  return (
                    <div key={refNumber}>
                      <Input
                        label={t('referees.organizerSettings.nameLabel', { number: refNumber })}
                        type="text"
                        value={refName}
                        onChange={(v) => handleNameChange(refNumber, v)}
                        placeholder={t('referees.organizerSettings.namePlaceholder', { number: refNumber })}
                        error={hasError}
                      />
                      {hasError && (
                        <p style={{
                          margin: `${cssVars.spacing.xs} 0 0 0`,
                          color: cssVars.colors.error,
                          fontSize: cssVars.fontSizes.xs,
                        }}>
                          {t('referees.organizerSettings.duplicateName')}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              <p style={{ fontSize: cssVars.fontSizes.xs, color: cssVars.colors.textSecondary, lineHeight: '1.4', marginTop: '12px', marginBottom: 0 }}>
                {t('referees.organizerSettings.namesHint')}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Finals Referee Mode (Teams Mode only) */}
      {showFinalsOptions && (
        <div style={{ marginTop: '16px' }}>
          <Select
            label={t('referees.finalsMode.label')}
            value={refereeConfig?.finalsRefereeMode ?? 'none'}
            onChange={handleFinalsRefereeMode}
            options={[
              { value: 'none', label: t('referees.finalsMode.none') },
              { value: 'neutralTeams', label: t('referees.finalsMode.neutralTeams') },
              { value: 'nonParticipatingTeams', label: t('referees.finalsMode.nonParticipatingTeams') },
            ]}
          />
          <p style={{ fontSize: cssVars.fontSizes.xs, color: cssVars.colors.textSecondary, lineHeight: '1.4', marginTop: '8px' }}>
            <strong>{t('referees.finalsMode.hintNeutral')}</strong> {t('referees.finalsMode.hintNeutralDescription')}{' '}
            <strong>{t('referees.finalsMode.hintNonParticipating')}</strong> {t('referees.finalsMode.hintNonParticipatingDescription')}
          </p>
        </div>
      )}

      {/* Responsive Styles */}
      <style>{`
        .referee-grid {
          grid-template-columns: 1fr 1fr;
        }

        @media (max-width: 540px) {
          .referee-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};
