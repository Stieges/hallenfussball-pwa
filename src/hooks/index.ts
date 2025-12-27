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

// State Utilities
export { usePrevious, usePreviousDistinct } from './usePrevious'

// Responsive & Layout
export { useIsMobile } from './useIsMobile'

// Live Data & Sync
export { useLiveMatchManagement } from './useLiveMatchManagement'
export { useLiveMatches } from './useLiveMatches'
export { useMultiTabSync } from './useMultiTabSync'
export { useOnlineStatus } from './useOnlineStatus'

// Domain Specific
export { useTournaments } from './useTournaments'
export { useSportConfig } from './useSportConfig'
export { useUserProfile } from './useUserProfile'
export { usePermissions } from './usePermissions'

// Theming & Corporate Colors
export { useCorporateColors, useCurrentThemeColors } from './useCorporateColors'
export { useTheme, ThemeProvider, type Theme, type ThemeContextValue } from './useTheme'
