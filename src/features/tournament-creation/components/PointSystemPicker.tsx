import { CSSProperties, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '../../../components/ui';
import { cssVars } from '../../../design-tokens'
import { Tournament, PointSystem } from '../../../types/tournament';

interface PointSystemPickerProps {
  formData: Partial<Tournament>;
  onUpdate: <K extends keyof Tournament>(field: K, value: Tournament[K]) => void;
}

interface Preset {
  win: number;
  draw: number;
  loss: number;
  label: string;
  sublabel: string;
}

export const PointSystemPicker: React.FC<PointSystemPickerProps> = ({
  formData,
  onUpdate,
}) => {
  const { t } = useTranslation('wizard');

  const PRESETS: Preset[] = [
    { win: 3, draw: 1, loss: 0, label: '3-1-0', sublabel: t('pointSystem.presets.standard') },
    { win: 2, draw: 1, loss: 0, label: '2-1-0', sublabel: t('pointSystem.presets.classic') },
    { win: 3, draw: 0, loss: 0, label: '3-0-0', sublabel: t('pointSystem.presets.winsOnly') },
  ];

  const currentPoints = formData.pointSystem ?? { win: 3, draw: 1, loss: 0 };

  // Determine if current values match a preset or are custom
  const isCustom = useMemo(() => {
    const presetValues = [
      { win: 3, draw: 1, loss: 0 },
      { win: 2, draw: 1, loss: 0 },
      { win: 3, draw: 0, loss: 0 },
    ];
    return !presetValues.some(
      preset =>
        preset.win === currentPoints.win &&
        preset.draw === currentPoints.draw &&
        preset.loss === currentPoints.loss
    );
  }, [currentPoints.win, currentPoints.draw, currentPoints.loss]);

  const handlePresetClick = (preset: Preset) => {
    const newSystem: PointSystem = {
      win: preset.win,
      draw: preset.draw,
      loss: preset.loss,
    };
    onUpdate('pointSystem', newSystem);
  };

  const handleCustomChange = (field: keyof PointSystem, value: string) => {
    const newSystem: PointSystem = {
      ...currentPoints,
      [field]: parseFloat(value) || 0,
    };
    onUpdate('pointSystem', newSystem);
  };

  const presetButtonStyle = (isActive: boolean): CSSProperties => ({
    padding: '12px',
    background: isActive ? cssVars.colors.secondarySelected : cssVars.colors.surfaceDarkMedium,
    border: isActive ? `2px solid ${cssVars.colors.secondary}` : '2px solid transparent',
    borderRadius: cssVars.borderRadius.sm,
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s',
  });

  const containerStyle: CSSProperties = {
    marginTop: '32px',
    paddingTop: '24px',
    borderTop: `1px solid ${cssVars.colors.border}`,
  };

  const customContainerStyle: CSSProperties = {
    marginTop: '16px',
    padding: '16px',
    background: cssVars.colors.secondaryBadge,
    borderRadius: cssVars.borderRadius.md,
    border: `1px solid ${cssVars.colors.secondaryBorder}`,
  };

  return (
    <div style={containerStyle}>
      <h3 style={{ color: cssVars.colors.secondary, fontSize: cssVars.fontSizes.md, margin: '0 0 16px 0' }}>
        {t('pointSystem.title')}
      </h3>
      <div className="point-system-presets" style={{ display: 'grid', gap: '12px', marginBottom: '16px' }}>
        {PRESETS.map((preset) => {
          const isActive = !isCustom &&
            currentPoints.win === preset.win &&
            currentPoints.draw === preset.draw &&
            currentPoints.loss === preset.loss;

          return (
            <button
              key={preset.label}
              onClick={() => handlePresetClick(preset)}
              style={presetButtonStyle(isActive)}
            >
              <div style={{ fontSize: cssVars.fontSizes.lg, fontWeight: '700', color: cssVars.colors.textPrimary }}>
                {preset.label}
              </div>
              <div style={{ fontSize: cssVars.fontSizes.xs, color: cssVars.colors.textSecondary, marginTop: '2px' }}>
                {preset.sublabel}
              </div>
            </button>
          );
        })}
        <button
          onClick={() => {
            // Just show custom inputs, don't change values
            if (!isCustom) {
              // Make it custom by slightly modifying (or user can edit)
              handleCustomChange('win', String(currentPoints.win));
            }
          }}
          style={presetButtonStyle(isCustom)}
        >
          <div style={{ fontSize: cssVars.fontSizes.lg, fontWeight: '700', color: cssVars.colors.textPrimary }}>
            ⚙️
          </div>
          <div style={{ fontSize: cssVars.fontSizes.xs, color: cssVars.colors.textSecondary, marginTop: '2px' }}>
            {t('pointSystem.presets.custom')}
          </div>
        </button>
      </div>

      {/* Custom Point System Inputs - always show when custom is active */}
      {isCustom && (
        <div style={customContainerStyle}>
          <div className="point-system-custom" style={{ display: 'grid', gap: '16px' }}>
            <div>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: cssVars.fontSizes.sm,
                color: cssVars.colors.textSecondary,
                fontWeight: cssVars.fontWeights.medium
              }}>
                {t('pointSystem.custom.win')}
              </label>
              <Input
                type="number"
                step="0.5"
                value={currentPoints.win}
                onChange={(v) => handleCustomChange('win', v)}
              />
            </div>
            <div>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: cssVars.fontSizes.sm,
                color: cssVars.colors.textSecondary,
                fontWeight: cssVars.fontWeights.medium
              }}>
                {t('pointSystem.custom.draw')}
              </label>
              <Input
                type="number"
                step="0.5"
                value={currentPoints.draw}
                onChange={(v) => handleCustomChange('draw', v)}
              />
            </div>
            <div>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: cssVars.fontSizes.sm,
                color: cssVars.colors.textSecondary,
                fontWeight: cssVars.fontWeights.medium
              }}>
                {t('pointSystem.custom.loss')}
              </label>
              <Input
                type="number"
                step="0.5"
                value={currentPoints.loss}
                onChange={(v) => handleCustomChange('loss', v)}
              />
            </div>
          </div>
          <p style={{ fontSize: cssVars.fontSizes.xs, color: cssVars.colors.textSecondary, marginTop: '12px', lineHeight: '1.4' }}>
            {t('pointSystem.custom.hint')}
          </p>
        </div>
      )}

      {/* Responsive Styles */}
      <style>{`
        .point-system-presets {
          grid-template-columns: repeat(4, 1fr);
        }

        .point-system-custom {
          grid-template-columns: repeat(3, 1fr);
        }

        @media (max-width: 600px) {
          .point-system-presets {
            grid-template-columns: repeat(2, 1fr) !important;
          }

          .point-system-custom {
            grid-template-columns: repeat(3, 1fr) !important;
          }
        }

        @media (max-width: 400px) {
          .point-system-custom {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};
