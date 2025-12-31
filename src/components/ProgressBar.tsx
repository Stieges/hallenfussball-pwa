import { CSSProperties } from 'react';
import { borderRadius, colors, fontSizes, fontWeights, gradients, spacing } from '../design-tokens';

// Step Status Icons
const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
    <circle cx="7" cy="7" r="6" fill={colors.primary} />
    <path
      d="M4.5 7L6.5 9L9.5 5"
      stroke={colors.onPrimary}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const CurrentIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
    <circle cx="7" cy="7" r="6" fill={colors.textPrimary} />
    <circle cx="7" cy="7" r="3" fill={colors.surface} />
  </svg>
);

const EmptyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
    <circle cx="7" cy="7" r="5.5" stroke={colors.textSecondary} strokeWidth="1" fill="none" />
  </svg>
);

interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
  stepLabels: string[];
  onStepClick?: (step: number) => void;
  visitedSteps?: Set<number>;
  stepErrors?: Record<number, string[]>;
  clickable?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  currentStep,
  totalSteps,
  stepLabels,
  onStepClick,
  visitedSteps,
  stepErrors,
  clickable = true,
}) => {
  const isStepVisited = (stepIndex: number): boolean => {
    return visitedSteps ? visitedSteps.has(stepIndex + 1) : false;
  };

  const hasStepErrors = (stepIndex: number): boolean => {
    const errors = stepErrors?.[stepIndex + 1] ?? [];
    return errors.length > 0;
  };

  // Determine which icon to show for each step
  const getStepIcon = (stepIndex: number): React.ReactNode => {
    const stepNum = stepIndex + 1;
    const isVisited = isStepVisited(stepIndex);
    const isCurrent = currentStep === stepNum;
    const isCompleted = isVisited && stepNum < currentStep;

    if (isCompleted) {
      return <CheckIcon />;
    }
    if (isCurrent) {
      return <CurrentIcon />;
    }
    return <EmptyIcon />;
  };

  const labelStyle = (stepIndex: number): CSSProperties => {
    const stepNum = stepIndex + 1;
    const isVisited = isStepVisited(stepIndex);
    const isCurrent = currentStep === stepNum;
    const hasErrors = hasStepErrors(stepIndex);
    const isClickableStep = clickable && onStepClick && (isVisited || isCurrent);

    return {
      fontSize: fontSizes.xs,
      fontWeight: isCurrent ? fontWeights.bold : fontWeights.semibold,
      color:
        currentStep > stepNum
          ? colors.primary
          : isCurrent
          ? colors.textPrimary
          : hasErrors
          ? colors.error
          : colors.textSecondary,
      transition: 'all 0.3s ease',
      cursor: isClickableStep ? 'pointer' : 'default',
      position: 'relative',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      textDecoration: isCurrent ? 'underline' : 'none',
      textUnderlineOffset: '4px',
      opacity: hasErrors ? 0.8 : 1,
    };
  };

  const buttonStyle = (stepIndex: number): CSSProperties => {
    const stepNum = stepIndex + 1;
    const isVisited = isStepVisited(stepIndex);
    const isCurrent = currentStep === stepNum;
    const isClickableStep = clickable && onStepClick && (isVisited || isCurrent);

    return {
      background: 'none',
      border: 'none',
      padding: '8px 4px',
      margin: 0,
      cursor: isClickableStep ? 'pointer' : 'default',
      ...labelStyle(stepIndex),
    };
  };

  const errorBadgeStyle: CSSProperties = {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: colors.error,
    display: 'inline-block',
    marginLeft: '2px',
  };

  const handleStepClick = (stepIndex: number) => {
    const stepNum = stepIndex + 1;
    const isVisited = isStepVisited(stepIndex);
    const isCurrent = currentStep === stepNum;

    // Only allow clicking on visited or current steps
    if (clickable && onStepClick && (isVisited || isCurrent)) {
      onStepClick(stepNum);
    }
  };

  return (
    <div style={{ marginBottom: spacing.lg }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.sm }}>
        {stepLabels.map((label, index) => {
          const stepNum = index + 1;
          const isVisited = isStepVisited(index);
          const isCurrent = currentStep === stepNum;
          const hasErrors = hasStepErrors(index);
          const isClickableStep = clickable && onStepClick && (isVisited || isCurrent);

          return (
            <button
              key={index}
              onClick={() => handleStepClick(index)}
              disabled={!isClickableStep}
              style={buttonStyle(index)}
              title={hasErrors ? `Fehler: ${stepErrors?.[stepNum]?.join(', ')}` : label}
              aria-label={`Schritt ${stepNum}: ${label}`}
              aria-current={isCurrent ? 'step' : undefined}
              role="tab"
              tabIndex={isClickableStep ? 0 : -1}
            >
              {getStepIcon(index)}
              {label}
              {hasErrors && <span style={errorBadgeStyle} aria-label="Fehler" />}
            </button>
          );
        })}
      </div>
      <div
        style={{
          height: '4px',
          background: colors.border,
          borderRadius: borderRadius.sm,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${(currentStep / totalSteps) * 100}%`,
            height: '100%',
            background: gradients.primary,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
    </div>
  );
};
