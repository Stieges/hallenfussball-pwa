import { CSSProperties } from 'react';
import { cssVars } from '../design-tokens'
import { useIsMobile } from '../hooks/useIsMobile';

// Step Status Icons - size prop for responsive sizing
const CheckIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
    <circle cx="7" cy="7" r="6" fill={cssVars.colors.primary} />
    <path
      d="M4.5 7L6.5 9L9.5 5"
      stroke={cssVars.colors.onPrimary}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const CurrentIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
    <circle cx="7" cy="7" r="6" fill={cssVars.colors.textPrimary} />
    <circle cx="7" cy="7" r="3" fill={cssVars.colors.surface} />
  </svg>
);

const EmptyIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
    <circle cx="7" cy="7" r="5.5" stroke={cssVars.colors.textSecondary} strokeWidth="1" fill="none" />
  </svg>
);

// Mobile-friendly short labels
const SHORT_LABELS: Record<string, string> = {
  'Stammdaten': '1',
  'Sportart': '2',
  'Modus': '3',
  'Gruppen & Felder': '4',
  'Teams': '5',
  'Übersicht': '6',
};

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
  const isMobile = useIsMobile();
  const iconSize = isMobile ? 12 : 14;

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
      return <CheckIcon size={iconSize} />;
    }
    if (isCurrent) {
      return <CurrentIcon size={iconSize} />;
    }
    return <EmptyIcon size={iconSize} />;
  };

  // Get display label - use short version on mobile
  const getDisplayLabel = (label: string): string => {
    if (isMobile) {
      return SHORT_LABELS[label] || label;
    }
    return label;
  };

  const labelStyle = (stepIndex: number): CSSProperties => {
    const stepNum = stepIndex + 1;
    const isVisited = isStepVisited(stepIndex);
    const isCurrent = currentStep === stepNum;
    const hasErrors = hasStepErrors(stepIndex);
    const isClickableStep = clickable && onStepClick && (isVisited || isCurrent);

    return {
      fontSize: isMobile ? '10px' : cssVars.fontSizes.xs,
      fontWeight: isCurrent ? cssVars.fontWeights.bold : cssVars.fontWeights.semibold,
      color:
        currentStep > stepNum
          ? cssVars.colors.primary
          : isCurrent
          ? cssVars.colors.textPrimary
          : hasErrors
          ? cssVars.colors.error
          : cssVars.colors.textSecondary,
      transition: 'all 0.3s ease',
      cursor: isClickableStep ? 'pointer' : 'default',
      position: 'relative',
      display: 'inline-flex',
      alignItems: 'center',
      gap: isMobile ? '2px' : '4px',
      textDecoration: isCurrent ? 'underline' : 'none',
      textUnderlineOffset: isMobile ? '2px' : '4px',
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
      padding: isMobile ? '6px 2px' : '8px 4px',
      margin: 0,
      cursor: isClickableStep ? 'pointer' : 'default',
      ...labelStyle(stepIndex),
    };
  };

  const errorBadgeStyle: CSSProperties = {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: cssVars.colors.error,
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
    <div style={{ marginBottom: isMobile ? cssVars.spacing.md : cssVars.spacing.lg }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: cssVars.spacing.sm,
        overflow: 'hidden',
      }}>
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
              {getDisplayLabel(label)}
              {hasErrors && <span style={errorBadgeStyle} aria-label="Fehler" />}
            </button>
          );
        })}
      </div>
      <div
        style={{
          height: '4px',
          background: cssVars.colors.border,
          borderRadius: cssVars.borderRadius.sm,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${(currentStep / totalSteps) * 100}%`,
            height: '100%',
            background: cssVars.gradients.primary,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
    </div>
  );
};
