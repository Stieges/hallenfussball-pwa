import { CSSProperties } from 'react';
import { theme } from '../styles/theme';

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
    const errors = stepErrors?.[stepIndex + 1] || [];
    return errors.length > 0;
  };

  const labelStyle = (stepIndex: number): CSSProperties => {
    const stepNum = stepIndex + 1;
    const isVisited = isStepVisited(stepIndex);
    const isCurrent = currentStep === stepNum;
    const hasErrors = hasStepErrors(stepIndex);
    const isClickableStep = clickable && onStepClick && (isVisited || isCurrent);

    return {
      fontSize: theme.fontSizes.xs,
      fontWeight: isCurrent ? theme.fontWeights.bold : theme.fontWeights.semibold,
      color:
        currentStep > stepNum
          ? theme.colors.primary
          : isCurrent
          ? theme.colors.text.primary
          : hasErrors
          ? theme.colors.error
          : theme.colors.text.secondary,
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
    background: theme.colors.error,
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
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
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
              {label}
              {hasErrors && <span style={errorBadgeStyle} aria-label="Fehler" />}
            </button>
          );
        })}
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
