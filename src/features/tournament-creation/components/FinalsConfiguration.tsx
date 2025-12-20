import { CSSProperties, useState } from 'react';
import { theme } from '../../../styles/theme';
import { Tournament, FinalsPreset, FinalsConfig } from '../../../types/tournament';
import { getFinalsOptions, FinalsOption } from '../../../constants/finalsOptions';

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
        ? `2px solid ${isRecommended ? theme.colors.accent : 'rgba(255,165,0,0.5)'}`
        : isRecommended ? '2px solid rgba(255,215,0,0.3)' : '2px solid rgba(255,255,255,0.1)',
      borderRadius: theme.borderRadius.md,
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
            accentColor: isRecommended ? theme.colors.accent : 'rgba(255,165,0,0.8)'
          }}
        />
        <div style={{ flex: 1 }}>
          <div style={{
            color: theme.colors.text.primary,
            fontSize: '14px',
            fontWeight: theme.fontWeights.medium,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            {isRecommended && <span>⭐</span>}
            {option.label}
          </div>
          <div style={{ color: theme.colors.text.secondary, fontSize: '12px', marginTop: '2px' }}>
            {option.description}
          </div>
          {option.explanation && (
            <div style={{
              color: isRecommended ? theme.colors.text.secondary : 'rgba(255,165,0,0.8)',
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
    <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: `1px solid ${theme.colors.border}` }}>
      <h3 style={{ color: theme.colors.accent, fontSize: '14px', margin: '0 0 8px 0' }}>
        Finalrunde
      </h3>
      <p style={{ fontSize: '12px', color: theme.colors.text.secondary, margin: '0 0 16px 0' }}>
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
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.borderRadius.sm,
              color: theme.colors.text.secondary,
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
          borderRadius: theme.borderRadius.md,
          border: '1px solid rgba(255,165,0,0.3)'
        }}>
          <p style={{ fontSize: '12px', color: theme.colors.text.primary, margin: 0, lineHeight: '1.5' }}>
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
          borderRadius: theme.borderRadius.md,
          border: '1px solid rgba(0,176,255,0.3)'
        }}>
          <p style={{ fontSize: '12px', color: theme.colors.text.primary, margin: 0, lineHeight: '1.5' }}>
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
          borderRadius: theme.borderRadius.md,
          border: '1px solid rgba(255,215,0,0.2)'
        }}>
          <h4 style={{
            color: theme.colors.accent,
            fontSize: '13px',
            margin: '0 0 12px 0',
            fontWeight: theme.fontWeights.semibold
          }}>
            Parallelisierung
          </h4>

          {['top-4', 'top-8', 'top-16', 'all-places'].includes(currentPreset) && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.finalsConfig?.parallelSemifinals ?? true}
                onChange={(e) => handleParallelChange('parallelSemifinals', e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: theme.colors.accent }}
              />
              <span style={{ color: theme.colors.text.primary, fontSize: '13px' }}>
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
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: theme.colors.accent }}
              />
              <span style={{ color: theme.colors.text.primary, fontSize: '13px' }}>
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
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: theme.colors.accent }}
              />
              <span style={{ color: theme.colors.text.primary, fontSize: '13px' }}>
                Achtelfinale gleichzeitig austragen
              </span>
            </label>
          )}

          <p style={{ fontSize: '11px', color: theme.colors.text.secondary, marginTop: '12px', lineHeight: '1.4' }}>
            Bei mehreren Feldern können Spiele gleichzeitig stattfinden
          </p>
        </div>
      )}
    </div>
  );
};
