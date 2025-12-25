/**
 * Motion Design Tokens
 *
 * Material Design 3 inspired motion system for consistent animations.
 * This file is the single source of truth for all motion-related values.
 *
 * @see https://m3.material.io/styles/motion/overview
 */

// Duration tokens (in milliseconds)
export const durations = {
  /** Instant - no perceptible delay (0ms) */
  instant: '0ms',
  /** Faster - quick micro-interactions (100ms) */
  faster: '100ms',
  /** Fast - standard UI feedback (150ms) */
  fast: '150ms',
  /** Normal - standard transitions (250ms) */
  normal: '250ms',
  /** Slow - complex animations (350ms) */
  slow: '350ms',
  /** Slower - emphasized movements (500ms) */
  slower: '500ms',
} as const;

// Duration values in ms for JavaScript use
export const durationsMs = {
  instant: 0,
  faster: 100,
  fast: 150,
  normal: 250,
  slow: 350,
  slower: 500,
} as const;

// Easing curves (cubic-bezier)
export const easings = {
  /** Standard easing - default for most animations */
  standard: 'cubic-bezier(0.2, 0, 0, 1)',
  /** Decelerate - elements entering the screen */
  decelerate: 'cubic-bezier(0, 0, 0, 1)',
  /** Accelerate - elements leaving the screen */
  accelerate: 'cubic-bezier(0.3, 0, 1, 1)',
  /** Emphasized - important transitions that need attention */
  emphasized: 'cubic-bezier(0.2, 0, 0, 1)',
  /** Bounce - playful, attention-grabbing */
  bounce: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  /** Linear - constant speed (use sparingly) */
  linear: 'linear',
} as const;

// Pre-composed transitions for common use cases
export const transitions = {
  /** Button press feedback */
  buttonPress: `transform ${durations.faster} ${easings.standard}`,
  /** Fade in elements */
  fadeIn: `opacity ${durations.fast} ${easings.decelerate}`,
  /** Fade out elements */
  fadeOut: `opacity ${durations.fast} ${easings.accelerate}`,
  /** Slide in from bottom */
  slideIn: `transform ${durations.normal} ${easings.decelerate}`,
  /** Slide out to bottom */
  slideOut: `transform ${durations.normal} ${easings.accelerate}`,
  /** Color/background changes */
  color: `background-color ${durations.fast} ${easings.standard}, border-color ${durations.fast} ${easings.standard}`,
  /** Scale animations */
  scale: `transform ${durations.fast} ${easings.standard}`,
  /** All properties (use sparingly) */
  all: `all ${durations.normal} ${easings.standard}`,
} as const;

// Keyframe animation names (defined in global.css)
export const keyframes = {
  /** Fade in from transparent */
  fadeIn: 'fadeIn',
  /** Fade in while moving up */
  fadeInUp: 'fadeInUp',
  /** Shake for error feedback */
  shake: 'shake',
  /** Skeleton shimmer effect */
  shimmer: 'shimmer',
  /** Pulse for loading states */
  pulse: 'pulse',
  /** Spin for loading spinners */
  spin: 'spin',
  /** Scale bounce for success */
  successBounce: 'successBounce',
} as const;

// Animation presets (keyframe + duration + easing)
export const animations = {
  /** Error shake - 300ms */
  shake: `${keyframes.shake} ${durations.slow} ${easings.standard}`,
  /** Fade in - 250ms */
  fadeIn: `${keyframes.fadeIn} ${durations.normal} ${easings.decelerate}`,
  /** Fade in up - 300ms with stagger support */
  fadeInUp: `${keyframes.fadeInUp} ${durations.slow} ${easings.decelerate}`,
  /** Shimmer loading - continuous 1.5s */
  shimmer: `${keyframes.shimmer} 1.5s ${easings.linear} infinite`,
  /** Pulse loading - continuous 2s */
  pulse: `${keyframes.pulse} 2s ${easings.standard} infinite`,
  /** Spin loading - continuous 1s */
  spin: `${keyframes.spin} 1s ${easings.linear} infinite`,
  /** Success bounce - 400ms */
  successBounce: `${keyframes.successBounce} 400ms ${easings.bounce}`,
} as const;

// Helper function to create staggered animation delay
export function staggerDelay(index: number, baseDelay = 50): string {
  return `${index * baseDelay}ms`;
}

// Helper to get animation with custom delay
export function withDelay(animation: string, delay: string): string {
  return `${animation} ${delay}`;
}

export type Durations = typeof durations;
export type Easings = typeof easings;
export type Transitions = typeof transitions;
