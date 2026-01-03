/**
 * Custom Hooks - Central Export
 *
 * All reusable hooks are exported from here for easy importing:
 * import { useLocalStorage, useDebounce, useMatchTimer } from '@/hooks'
 */

// Storage & Persistence
export { useLocalStorage } from './useLocalStorage'
export { useFormPersistence } from './useFormPersistence'

// Timer & Animation
export { useMatchTimer } from './useMatchTimer'
export { useDialogTimer } from './useDialogTimer'
export { useShake } from './useShake'
export { useListAnimation, useFadeIn } from './useListAnimation'

// User Interaction
export { useDebounce, useDebouncedCallback } from './useDebounce'
export { useClickOutside, useClickOutsideMultiple } from './useClickOutside'
export { useLongPress } from './useLongPress'

// State Utilities
export { usePrevious, usePreviousDistinct } from './usePrevious'

// Responsive & Layout
export { useIsMobile } from './useIsMobile'
export { useBreakpoint, type Breakpoint, type BreakpointConfig, type UseBreakpointReturn } from './useBreakpoint'

// Live Data & Sync
export { useLiveMatchManagement } from './useLiveMatchManagement'
export { useLiveMatches } from './useLiveMatches'
export { useLiveProgress, formatTime, type UseLiveProgressReturn, type ProgressMatch } from './useLiveProgress'
export { useMultiTabSync } from './useMultiTabSync'
export { useOnlineStatus } from './useOnlineStatus'
export { useSyncedPenalties } from './useSyncedPenalties'

// Domain Specific
export { useTournaments } from './useTournaments'
export { useSportConfig } from './useSportConfig'
export { useUserProfile } from './useUserProfile'
export { usePermissions } from './usePermissions'
export { useSponsors } from './useSponsors'
export { useFields } from './useFields'
export { useMonitors } from './useMonitors'

// Theming & Corporate Colors
export { useCorporateColors, useCurrentThemeColors } from './useCorporateColors'
export { useTheme, ThemeProvider, type Theme, type ThemeContextValue } from './useTheme'

// Accessibility
export { useHighContrast } from './useHighContrast'
export { useFontScale, FONT_SCALES, FONT_SCALE_LABELS } from './useFontScale'

// Scroll & Viewport
export { useScrollDirection, type ScrollDirection, type UseScrollDirectionOptions, type UseScrollDirectionReturn } from './useScrollDirection'
