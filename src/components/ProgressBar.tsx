import { CSSProperties } from 'react';
import { theme } from '../styles/theme';

interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
  stepLabels: string[];
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ currentStep, totalSteps, stepLabels }) => {
  const labelStyle = (stepIndex: number): CSSProperties => ({
    fontSize: theme.fontSizes.xs,
    fontWeight: theme.fontWeights.semibold,
    color:
      currentStep > stepIndex + 1
        ? theme.colors.primary
        : currentStep === stepIndex + 1
        ? theme.colors.text.primary
        : theme.colors.text.secondary,
    transition: 'color 0.3s ease',
  });

  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        {stepLabels.map((label, index) => (
          <span key={index} style={labelStyle(index)}>
            {label}
          </span>
        ))}
      </div>
      <div
        style={{
          height: '4px',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: theme.borderRadius.sm,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${(currentStep / totalSteps) * 100}%`,
            height: '100%',
            background: theme.gradients.primary,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
    </div>
  );
};
