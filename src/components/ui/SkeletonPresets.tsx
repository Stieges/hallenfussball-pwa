/**
 * Preset Skeleton configurations for common use cases.
 *
 * Split from Skeleton.tsx so the underlying component can stay HMR-clean
 * (eslint-plugin-react-refresh v0.5 flags inline component-collections
 * exported alongside the primary component).
 */

import { Skeleton, type SkeletonProps } from './Skeleton';

export const SkeletonPresets = {
  /** Avatar placeholder (48x48 circle) */
  Avatar: (props?: Partial<SkeletonProps>) => (
    <Skeleton
      variant="circular"
      width="48px"
      height="48px"
      aria-label="Loading avatar"
      {...props}
    />
  ),

  /** Team name text placeholder */
  TeamName: (props?: Partial<SkeletonProps>) => (
    <Skeleton
      variant="text"
      width="120px"
      height="20px"
      aria-label="Loading team name"
      {...props}
    />
  ),

  /** Score placeholder */
  Score: (props?: Partial<SkeletonProps>) => (
    <Skeleton
      variant="rounded"
      width="48px"
      height="32px"
      aria-label="Loading score"
      {...props}
    />
  ),

  /** Match card placeholder */
  MatchCard: (props?: Partial<SkeletonProps>) => (
    <Skeleton
      variant="rounded"
      width="100%"
      height="80px"
      aria-label="Loading match"
      {...props}
    />
  ),

  /** Tournament card placeholder */
  TournamentCard: (props?: Partial<SkeletonProps>) => (
    <Skeleton
      variant="rounded"
      width="100%"
      height="160px"
      aria-label="Loading tournament"
      {...props}
    />
  ),

  /** Button placeholder */
  Button: (props?: Partial<SkeletonProps>) => (
    <Skeleton
      variant="rounded"
      width="100px"
      height="40px"
      aria-label="Loading button"
      {...props}
    />
  ),
} as const;
