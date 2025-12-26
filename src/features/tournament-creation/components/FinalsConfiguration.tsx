import { CSSProperties, useState } from 'react';
import { borderRadius, colors, fontWeights } from '../../../design-tokens';
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
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  const numberOfGroups = formData.numberOfGroups || 2;
  const numberOfFields = formData.numberOfFields || 1;
  const finalsOptions = getFinalsOptions(numberOfGroups);
  const recommendedOptions = finalsOptions.filter(opt => opt.category === 'recommended');
  const possibleOptions = finalsOptions.filter(opt => opt.category === 'possible');

  const currentPreset = formData.finalsConfig?.preset || 'none';

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
      preset: formData.finalsConfig?.preset || 'none',
      tiebreaker,
    };
    onUpdate('finalsConfig', newConfig);
  };

  const handleTiebreakerDurationChange = (duration: number) => {
    const newConfig: FinalsConfig = {
      ...formData.finalsConfig,
      preset: formData.finalsConfig?.preset || 'none',
      tiebreakerDuration: duration,
    };
    onUpdate('finalsConfig', newConfig);
  };

  // Get sport config for defaults
  const sportConfig = getSportConfig(formData.sportId || DEFAULT_SPORT_ID);
  const currentTiebreaker = formData.finalsConfig?.tiebreaker || sportConfig.rules.defaultTiebreaker || 'shootout';
  const currentDuration = formData.finalsConfig?.tiebreakerDuration || sportConfig.rules.defaultTiebreakerDuration || 5;

  const renderOption = (option: FinalsOption, isRecommended: boolean) => {
    const isSelected = currentPreset === option.preset;

    const labelStyle: CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '14px 16px',
      background: isSelected
        ? isRecommended ? 'rgba(255,215,0,0.15)' : 'rgba(255,165,0,0.12)'
        : isRecommended ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.15)',
      border: isSelected
        ? `2px solid ${isRecommended ? colors.accent : 'rgba(255,165,0,0.5)'}`
        : isRecommended ? '2px solid rgba(255,215,0,0.3)' : '2px solid rgba(255,255,255,0.1)',
      borderRadius: borderRadius.md,
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
            accentColor: isRecommended ? colors.accent : 'rgba(255,165,0,0.8)'
          }}
        />
        <div style={{ flex: 1 }}>
          <div style={{
            color: colors.textPrimary,
            fontSize: '14px',
            fontWeight: fontWeights.medium,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            {isRecommended && <span>⭐</span>}
            {option.label}
          </div>
          <div style={{ color: colors.textSecondary, fontSize: '12px', marginTop: '2px' }}>
            {option.description}
          </div>
          {option.explanation && (
            <div style={{
              color: isRecommended ? colors.textSecondary : 'rgba(255,165,0,0.8)',
              fontSize: '11px',
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
    <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: `1px solid ${colors.border}` }}>
      <h3 style={{ color: colors.accent, fontSize: '14px', margin: '0 0 8px 0' }}>
        Finalrunde
      </h3>
      <p style={{ fontSize: '12px', color: colors.textSecondary, margin: '0 0 16px 0' }}>
        ⭐ = Empfohlen für {numberOfGroups} Gruppe{numberOfGroups > 1 ? 'n' : ''}
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
              background: 'rgba(0,0,0,0.2)',
              border: `1px solid ${colors.border}`,
              borderRadius: borderRadius.sm,
              color: colors.textSecondary,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>Weitere Optionen (theoretisch möglich, aber weniger empfohlen)</span>
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
          background: 'rgba(255,165,0,0.12)',
          borderRadius: borderRadius.md,
          border: '1px solid rgba(255,165,0,0.3)'
        }}>
          <p style={{ fontSize: '12px', color: colors.textPrimary, margin: 0, lineHeight: '1.5' }}>
            <strong>Hinweis:</strong> Top-8 mit Viertelfinale benötigt mindestens 4 Gruppen (8 Teams).
            Mit {numberOfGroups} Gruppen wird automatisch Top-4 (Halbfinale) verwendet.
          </p>
        </div>
      )}

      {currentPreset === 'all-places' && (
        <div style={{
          marginTop: '16px',
          padding: '12px 16px',
          background: 'rgba(0,176,255,0.12)',
          borderRadius: borderRadius.md,
          border: '1px solid rgba(0,176,255,0.3)'
        }}>
          <p style={{ fontSize: '12px', color: colors.textPrimary, margin: 0, lineHeight: '1.5' }}>
            <strong>Info:</strong> Es werden alle möglichen Platzierungen ausgespielt.
            {numberOfGroups === 2 && ' Bei 2 Gruppen: Halbfinale + Plätze 3, 5 und 7.'}
            {numberOfGroups >= 4 && ' Bei 4+ Gruppen: Viertelfinale + alle Platzierungen.'}
          </p>
        </div>
      )}

      {/* Parallelization Options */}
      {currentPreset && ['top-4', 'top-8', 'top-16', 'all-places'].includes(currentPreset) && numberOfFields > 1 && (
        <div style={{
          marginTop: '20px',
          padding: '16px',
          background: 'rgba(255,215,0,0.08)',
          borderRadius: borderRadius.md,
          border: '1px solid rgba(255,215,0,0.2)'
        }}>
          <h4 style={{
            color: colors.accent,
            fontSize: '13px',
            margin: '0 0 12px 0',
            fontWeight: fontWeights.semibold
          }}>
            Parallelisierung
          </h4>

          {['top-4', 'top-8', 'top-16', 'all-places'].includes(currentPreset) && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.finalsConfig?.parallelSemifinals ?? true}
                onChange={(e) => handleParallelChange('parallelSemifinals', e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: colors.accent }}
              />
              <span style={{ color: colors.textPrimary, fontSize: '13px' }}>
                Halbfinale gleichzeitig austragen
              </span>
            </label>
          )}

          {['top-8', 'top-16', 'all-places'].includes(currentPreset) && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.finalsConfig?.parallelQuarterfinals ?? true}
                onChange={(e) => handleParallelChange('parallelQuarterfinals', e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: colors.accent }}
              />
              <span style={{ color: colors.textPrimary, fontSize: '13px' }}>
                Viertelfinale gleichzeitig austragen
              </span>
            </label>
          )}

          {currentPreset === 'top-16' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.finalsConfig?.parallelRoundOf16 ?? true}
                onChange={(e) => handleParallelChange('parallelRoundOf16', e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: colors.accent }}
              />
              <span style={{ color: colors.textPrimary, fontSize: '13px' }}>
                Achtelfinale gleichzeitig austragen
              </span>
            </label>
          )}

          <p style={{ fontSize: '11px', color: colors.textSecondary, marginTop: '12px', lineHeight: '1.4' }}>
            Bei mehreren Feldern können Spiele gleichzeitig stattfinden
          </p>
        </div>
      )}

      {/* Tiebreaker Options - only show when finals are enabled */}
      {currentPreset && currentPreset !== 'none' && (
        <div style={{
          marginTop: '20px',
          padding: '16px',
          background: 'rgba(0,176,255,0.08)',
          borderRadius: borderRadius.md,
          border: '1px solid rgba(0,176,255,0.2)'
        }}>
          <h4 style={{
            color: colors.secondary,
            fontSize: '13px',
            margin: '0 0 12px 0',
            fontWeight: fontWeights.semibold
          }}>
            ⚖️ Bei Unentschieden
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="tiebreaker"
                checked={currentTiebreaker === 'shootout'}
                onChange={() => handleTiebreakerChange('shootout')}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: colors.secondary }}
              />
              <div>
                <span style={{ color: colors.textPrimary, fontSize: '13px' }}>
                  Direkt Strafstoßschießen
                </span>
                <span style={{ color: colors.textSecondary, fontSize: '11px', marginLeft: '8px' }}>
                  (privates Turnier)
                </span>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="tiebreaker"
                checked={currentTiebreaker === 'overtime-then-shootout'}
                onChange={() => handleTiebreakerChange('overtime-then-shootout')}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: colors.secondary }}
              />
              <div>
                <span style={{ color: colors.textPrimary, fontSize: '13px' }}>
                  Verlängerung, dann Strafstoßschießen
                </span>
                <span style={{ color: colors.textSecondary, fontSize: '11px', marginLeft: '8px' }}>
                  (offiziell)
                </span>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="tiebreaker"
                checked={currentTiebreaker === 'goldenGoal'}
                onChange={() => handleTiebreakerChange('goldenGoal')}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: colors.secondary }}
              />
              <span style={{ color: colors.textPrimary, fontSize: '13px' }}>
                Golden Goal
              </span>
            </label>
          </div>

          {/* Duration input for overtime/golden goal */}
          {(currentTiebreaker === 'overtime-then-shootout' || currentTiebreaker === 'goldenGoal') && (
            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ color: colors.textSecondary, fontSize: '13px' }}>
                {currentTiebreaker === 'goldenGoal' ? 'Golden Goal-Zeit:' : 'Verlängerung:'}
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
                  background: 'rgba(0,0,0,0.3)',
                  border: `1px solid ${colors.border}`,
                  borderRadius: borderRadius.sm,
                  color: colors.textPrimary,
                  fontSize: '14px',
                  textAlign: 'center',
                }}
              />
              <span style={{ color: colors.textSecondary, fontSize: '13px' }}>Minuten</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
