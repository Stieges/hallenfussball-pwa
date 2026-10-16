import type { CSSProperties, ReactNode } from 'react';
import type { TransitionType } from '../../../types/monitor';
import type { SlideView } from '../useSlideshow';

interface TransitionWrapperProps {
  children: ReactNode;
  slideState: SlideView;
  transitionType: TransitionType;
  transitionDuration: number;
  enableTransitions: boolean;
}

/** Hüllt die aktuelle Folie und animiert Fade oder Slide beim Wechsel (none = harter Schnitt). */
export function TransitionWrapper({
  children,
  slideState,
  transitionType,
  transitionDuration,
  enableTransitions,
}: TransitionWrapperProps) {
  const getTransitionStyle = (): CSSProperties => {
    if (!enableTransitions || transitionType === 'none') {
      return {};
    }

    const baseTransition: CSSProperties = {
      transition: `all ${transitionDuration}ms cubic-bezier(0.4, 0, 0.2, 1)`,
    };

    if (transitionType === 'fade') {
      return {
        ...baseTransition,
        opacity: slideState.isTransitioning ? 0 : 1,
      };
    }

    // transitionType === 'slide' (remaining option after 'none' and 'fade')
    const translateX = slideState.isTransitioning
      ? slideState.direction === 'next' ? '-100%' : '100%'
      : '0%';
    return {
      ...baseTransition,
      transform: `translateX(${translateX})`,
    };
  };

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      ...getTransitionStyle(),
    }}>
      {children}
    </div>
  );
}
