import { CSSProperties, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens'
import { Tournament, FinalsPreset, FinalsConfig, TiebreakerMode } from '../../../types/tournament';
import { getFinalsOptions, FinalsOption } from '../../../constants/finalsOptions';
import { getSportConfig, DEFAULT_SPORT_ID } from '../../../config/sports';

interface FinalsConfigurationProps {
  formData: Partial<Tournament>;
  onUpdate: <K extends keyof Tournament>(field: K, value: Tournament[K]) => void;
}

export const FinalsConfiguration: React.FC<FinalsConfigurationProps> = ({
  formData,
  onUpdate,
}) => {
  const { t } = useTranslation('wizard');
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  const numberOfGroups = formData.numberOfGroups ?? 2;
  const numberOfFields = formData.numberOfFields ?? 1;
  const finalsOptions = getFinalsOptions(numberOfGroups);
  const recommendedOptions = finalsOptions.filter(opt => opt.category === 'recommended');
  const possibleOptions = finalsOptions.filter(opt => opt.category === 'possible');

  const currentPreset = formData.finalsConfig?.preset ?? 'none';

  const handlePresetChange = (preset: FinalsPreset) => {
    const newConfig: FinalsConfig = {
      preset,
      parallelSemifinals: formData.finalsConfig?.parallelSemifinals,
      parallelQuarterfinals: formData.finalsConfig?.parallelQuarterfinals,
      parallelRoundOf16: formData.finalsConfig?.parallelRoundOf16,
    };
    onUpdate('finalsConfig', newConfig);
  };

  const handleParallelChange = (field: keyof FinalsConfig, value: boolean) => {
    if (!formData.finalsConfig) {return;}
    const newConfig: FinalsConfig = {
      ...formData.finalsConfig,
      [field]: value,
    };
    onUpdate('finalsConfig', newConfig);
  };

  const handleTiebreakerChange = (tiebreaker: TiebreakerMode) => {
    const newConfig: FinalsConfig = {
      ...formData.finalsConfig,
      preset: formData.finalsConfig?.preset ?? 'none',
      tiebreaker,
    };
    onUpdate('finalsConfig', newConfig);
  };

  const handleTiebreakerDurationChange = (duration: number) => {
    const newConfig: FinalsConfig = {
      ...formData.finalsConfig,
      preset: formData.finalsConfig?.preset ?? 'none',
      tiebreakerDuration: duration,
    };
    onUpdate('finalsConfig', newConfig);
  };

  // Get sport config for defaults
  const sportConfig = getSportConfig(formData.sportId ?? DEFAULT_SPORT_ID);
  const currentTiebreaker = formData.finalsConfig?.tiebreaker ?? sportConfig.rules.defaultTiebreaker ?? 'shootout';
  const currentDuration = formData.finalsConfig?.tiebreakerDuration ?? sportConfig.rules.defaultTiebreakerDuration ?? 5;

  const renderOption = (option: FinalsOption, isRecommended: boolean) => {
    const isSelected = currentPreset === option.preset;

    const labelStyle: CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '14px 16px',
      background: isSelected
        ? isRecommended ? cssVars.colors.accentLight : cssVars.colors.warningLight
        : isRecommended ? cssVars.colors.surfaceDarkMedium : cssVars.colors.surfaceDarkLight,
      border: isSelected
        ? `2px solid ${isRecommended ? cssVars.colors.accent : cssVars.colors.warning}`
        : isRecommended ? `2px solid ${cssVars.colors.accentBorder}` : `2px solid ${cssVars.colors.border}`,
      borderRadius: cssVars.borderRadius.md,
      cursor: 'pointer',
      transition: 'all 0.2s',
    };

    return (
      <label key={option.preset} style={labelStyle}>
        <input
          type="radio"
          name="finalsPreset"
          value={option.preset}
          checked={isSelected}
          onChange={() => handlePresetChange(option.preset)}
          style={{
            width: '18px',
            height: '18px',
            cursor: 'pointer',
            accentColor: isRecommended ? cssVars.colors.accent : cssVars.colors.warning
          }}
        />
        <div style={{ flex: 1 }}>
          <div style={{
            color: cssVars.colors.textPrimary,
            fontSize: cssVars.fontSizes.md,
            fontWeight: cssVars.fontWeights.medium,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            {isRecommended && <span>⭐</span>}
            {option.label}
          </div>
          <div style={{ color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.sm, marginTop: '2px' }}>
            {option.description}
          </div>
          {option.explanation && (
            <div style={{
              color: isRecommended ? cssVars.colors.textSecondary : cssVars.colors.warning,
              fontSize: cssVars.fontSizes.xs,
              marginTop: '4px',
              fontStyle: 'italic'
            }}>
              {!isRecommended && '⚠️ '}{option.explanation}
            </div>
          )}
        </div>
      </label>
    );
  };

  return (
    <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: `1px solid ${cssVars.colors.border}` }}>
      <h3 style={{ color: cssVars.colors.accent, fontSize: cssVars.fontSizes.md, margin: '0 0 8px 0' }}>
        {t('finalsConfig.title')}
      </h3>
      <p style={{ fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary, margin: '0 0 16px 0' }}>
        {t('finalsConfig.recommendedHint', { count: numberOfGroups })}
      </p>

      {/* Recommended Options */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {recommendedOptions.map(opt => renderOption(opt, true))}
      </div>

      {/* Advanced Options Toggle */}
      {possibleOptions.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <button
            onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
            style={{
              width: '100%',
              padding: '10px 12px',
              background: cssVars.colors.surfaceDarkMedium,
              border: `1px solid ${cssVars.colors.border}`,
              borderRadius: cssVars.borderRadius.sm,
              color: cssVars.colors.textSecondary,
              fontSize: cssVars.fontSizes.sm,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>{t('finalsConfig.advancedOptions')}</span>
            <span>{showAdvancedOptions ? '▼' : '▶'}</span>
          </button>

          {showAdvancedOptions && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
              {possibleOptions.map(opt => renderOption(opt, false))}
            </div>
          )}
        </div>
      )}

      {/* Warnings */}
      {currentPreset === 'top-8' && numberOfGroups < 4 && (
        <div style={{
          marginTop: '16px',
          padding: '12px 16px',
          background: cssVars.colors.warningLight,
          borderRadius: cssVars.borderRadius.md,
          border: `1px solid ${cssVars.colors.warningBorder}`
        }}>
          <p
            style={{ fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textPrimary, margin: 0, lineHeight: '1.5' }}
            dangerouslySetInnerHTML={{ __html: t('finalsConfig.warnings.top8TooFewGroups', { count: numberOfGroups }) }}
          />
        </div>
      )}

      {currentPreset === 'all-places' && (
        <div style={{
          marginTop: '16px',
          padding: '12px 16px',
          background: cssVars.colors.secondaryLight,
          borderRadius: cssVars.borderRadius.md,
          border: `1px solid ${cssVars.colors.secondaryBorderActive}`
        }}>
          <p
            style={{ fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textPrimary, margin: 0, lineHeight: '1.5' }}
            dangerouslySetInnerHTML={{ __html: t('finalsConfig.warnings.allPlacesInfo') }}
          />
          {numberOfGroups === 2 && (
            <p style={{ fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textPrimary, margin: '4px 0 0 0', lineHeight: '1.5' }}>
              {t('finalsConfig.warnings.allPlaces2Groups')}
            </p>
          )}
          {numberOfGroups >= 4 && (
            <p style={{ fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textPrimary, margin: '4px 0 0 0', lineHeight: '1.5' }}>
              {t('finalsConfig.warnings.allPlaces4Groups')}
            </p>
          )}
        </div>
      )}

      {/* Parallelization Options */}
      {['top-4', 'top-8', 'top-16', 'all-places'].includes(currentPreset) && numberOfFields > 1 && (
        <div style={{
          marginTop: '20px',
          padding: '16px',
          background: cssVars.colors.accentMedium,
          borderRadius: cssVars.borderRadius.md,
          border: `1px solid ${cssVars.colors.accentLight}`
        }}>
          <h4 style={{
            color: cssVars.colors.accent,
            fontSize: cssVars.fontSizes.sm,
            margin: '0 0 12px 0',
            fontWeight: cssVars.fontWeights.semibold
          }}>
            {t('finalsConfig.parallelization.title')}
          </h4>

          {['top-4', 'top-8', 'top-16', 'all-places'].includes(currentPreset) && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.finalsConfig?.parallelSemifinals ?? true}
                onChange={(e) => handleParallelChange('parallelSemifinals', e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: cssVars.colors.accent }}
              />
              <span style={{ color: cssVars.colors.textPrimary, fontSize: cssVars.fontSizes.sm }}>
                {t('finalsConfig.parallelization.semifinals')}
              </span>
            </label>
          )}

          {['top-8', 'top-16', 'all-places'].includes(currentPreset) && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.finalsConfig?.parallelQuarterfinals ?? true}
                onChange={(e) => handleParallelChange('parallelQuarterfinals', e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: cssVars.colors.accent }}
              />
              <span style={{ color: cssVars.colors.textPrimary, fontSize: cssVars.fontSizes.sm }}>
                {t('finalsConfig.parallelization.quarterfinals')}
              </span>
            </label>
          )}

          {currentPreset === 'top-16' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.finalsConfig?.parallelRoundOf16 ?? true}
                onChange={(e) => handleParallelChange('parallelRoundOf16', e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: cssVars.colors.accent }}
              />
              <span style={{ color: cssVars.colors.textPrimary, fontSize: cssVars.fontSizes.sm }}>
                {t('finalsConfig.parallelization.roundOf16')}
              </span>
            </label>
          )}

          <p style={{ fontSize: cssVars.fontSizes.xs, color: cssVars.colors.textSecondary, marginTop: '12px', lineHeight: '1.4' }}>
            {t('finalsConfig.parallelization.hint')}
          </p>
        </div>
      )}

      {/* Tiebreaker Options - only show when finals are enabled */}
      {currentPreset !== 'none' && (
        <div style={{
          marginTop: '20px',
          padding: '16px',
          background: cssVars.colors.secondaryMedium,
          borderRadius: cssVars.borderRadius.md,
          border: `1px solid ${cssVars.colors.infoBorder}`
        }}>
          <h4 style={{
            color: cssVars.colors.secondary,
            fontSize: cssVars.fontSizes.sm,
            margin: '0 0 12px 0',
            fontWeight: cssVars.fontWeights.semibold
          }}>
            ⚖️ {t('finalsConfig.tiebreaker.title')}
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="tiebreaker"
                checked={currentTiebreaker === 'shootout'}
                onChange={() => handleTiebreakerChange('shootout')}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: cssVars.colors.secondary }}
              />
              <div>
                <span style={{ color: cssVars.colors.textPrimary, fontSize: cssVars.fontSizes.sm }}>
                  {t('finalsConfig.tiebreaker.shootout')}
                </span>
                <span style={{ color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.xs, marginLeft: '8px' }}>
                  {t('finalsConfig.tiebreaker.shootoutHint')}
                </span>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="tiebreaker"
                checked={currentTiebreaker === 'overtime-then-shootout'}
                onChange={() => handleTiebreakerChange('overtime-then-shootout')}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: cssVars.colors.secondary }}
              />
              <div>
                <span style={{ color: cssVars.colors.textPrimary, fontSize: cssVars.fontSizes.sm }}>
                  {t('finalsConfig.tiebreaker.overtimeThenShootout')}
                </span>
                <span style={{ color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.xs, marginLeft: '8px' }}>
                  {t('finalsConfig.tiebreaker.overtimeHint')}
                </span>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="tiebreaker"
                checked={currentTiebreaker === 'goldenGoal'}
                onChange={() => handleTiebreakerChange('goldenGoal')}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: cssVars.colors.secondary }}
              />
              <span style={{ color: cssVars.colors.textPrimary, fontSize: cssVars.fontSizes.sm }}>
                {t('finalsConfig.tiebreaker.goldenGoal')}
              </span>
            </label>
          </div>

          {/* Duration input for overtime/golden goal */}
          {(currentTiebreaker === 'overtime-then-shootout' || currentTiebreaker === 'goldenGoal') && (
            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.sm }}>
                {currentTiebreaker === 'goldenGoal' ? t('finalsConfig.tiebreaker.goldenGoalDuration') : t('finalsConfig.tiebreaker.overtimeDuration')}
              </span>
              <input
                type="number"
                min={1}
                max={15}
                value={currentDuration}
                onChange={(e) => handleTiebreakerDurationChange(parseInt(e.target.value) || 5)}
                style={{
                  width: '60px',
                  padding: '6px 10px',
                  background: cssVars.colors.inputBg,
                  border: `1px solid ${cssVars.colors.border}`,
                  borderRadius: cssVars.borderRadius.sm,
                  color: cssVars.colors.textPrimary,
                  fontSize: cssVars.fontSizes.md,
                  textAlign: 'center',
                }}
              />
              <span style={{ color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.sm }}>{t('finalsConfig.tiebreaker.minutes')}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
