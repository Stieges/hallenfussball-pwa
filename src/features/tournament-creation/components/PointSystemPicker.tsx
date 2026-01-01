import { CSSProperties, useMemo } from 'react';
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

const PRESETS: Preset[] = [
  { win: 3, draw: 1, loss: 0, label: '3-1-0', sublabel: 'Standard' },
  { win: 2, draw: 1, loss: 0, label: '2-1-0', sublabel: 'Klassisch' },
  { win: 3, draw: 0, loss: 0, label: '3-0-0', sublabel: 'Nur Siege' },
];

export const PointSystemPicker: React.FC<PointSystemPickerProps> = ({
  formData,
  onUpdate,
}) => {
  const currentPoints = formData.pointSystem ?? { win: 3, draw: 1, loss: 0 };

  // Determine if current values match a preset or are custom
  const isCustom = useMemo(() => {
    return !PRESETS.some(
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
    background: isActive ? 'rgba(0,176,255,0.2)' : 'rgba(0,0,0,0.2)',
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
    background: 'rgba(0,176,255,0.08)',
    borderRadius: cssVars.borderRadius.md,
    border: '1px solid rgba(0,176,255,0.2)',
  };

  return (
    <div style={containerStyle}>
      <h3 style={{ color: cssVars.colors.secondary, fontSize: '14px', margin: '0 0 16px 0' }}>
        Punktesystem
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
              <div style={{ fontSize: '16px', fontWeight: '700', color: cssVars.colors.textPrimary }}>
                {preset.label}
              </div>
              <div style={{ fontSize: '11px', color: cssVars.colors.textSecondary, marginTop: '2px' }}>
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
          <div style={{ fontSize: '16px', fontWeight: '700', color: cssVars.colors.textPrimary }}>
            ⚙️
          </div>
          <div style={{ fontSize: '11px', color: cssVars.colors.textSecondary, marginTop: '2px' }}>
            Individuell
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
                Sieg
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
                Unentschieden
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
                Niederlage
              </label>
              <Input
                type="number"
                step="0.5"
                value={currentPoints.loss}
                onChange={(v) => handleCustomChange('loss', v)}
              />
            </div>
          </div>
          <p style={{ fontSize: '11px', color: cssVars.colors.textSecondary, marginTop: '12px', lineHeight: '1.4' }}>
            Erlaubt sind positive, negative Zahlen und Null. Auch Kommazahlen sind möglich (z.B. 2.5)
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
