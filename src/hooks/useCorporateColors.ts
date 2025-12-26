/**
 * useCorporateColors Hook
 *
 * React hook for managing corporate color theming.
 * Integrates with user profile for premium feature gating.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  applyCorporateColors,
  resetToDefaultTheme,
  saveTheme,
  loadTheme,
  createThemeConfig,
  createThemeConfigFromPreset,
  type CorporateColors,
  type ThemeConfig,
} from '../lib/themeManager'
import { validateCorporateColor, type ColorValidation } from '../lib/colorUtils'
import {
  colorPresets,
  getPreset,
  getDefaultPreset,
  getFreePresets,
  getPremiumPresets,
  type ColorPreset,
} from '../config/colorPresets'
import { useUserProfile } from './useUserProfile'
import { canUseCorporateColors, canUsePreset } from '../types/userProfile'

// ============================================================================
// Types
// ============================================================================

export interface UseCorporateColorsResult {
  // Current state
  colors: CorporateColors
  presetId: string | null
  isCustomized: boolean
  isLoading: boolean

  // Available presets
  allPresets: ColorPreset[]
  freePresets: ColorPreset[]
  premiumPresets: ColorPreset[]

  // Actions
  applyPreset: (presetId: string) => Promise<void>
  applyCustomColors: (colors: CorporateColors) => Promise<void>
  reset: () => Promise<void>

  // Validation
  validateColor: (hex: string) => ColorValidation

  // Feature gate info
  canUsePreset: (preset: ColorPreset) => boolean
  isPremiumUser: boolean
  currentPlan: 'free' | 'pro' | 'team'
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useCorporateColors(): UseCorporateColorsResult {
  const { profile, updateProfile } = useUserProfile()

  const [currentConfig, setCurrentConfig] = useState<ThemeConfig | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load theme on mount
  useEffect(() => {
    const init = async () => {
      try {
        const config = await loadTheme()
        setCurrentConfig(config)
      } catch (error) {
        console.error('[useCorporateColors] Failed to load theme:', error)
      } finally {
        setIsLoading(false)
      }
    }
    void init()
  }, [])

  // Feature gating
  const isPremiumUser = useMemo(
    () => canUseCorporateColors(profile),
    [profile]
  )

  const checkCanUsePreset = useCallback(
    (preset: ColorPreset): boolean => {
      return canUsePreset(profile, preset.premium)
    },
    [profile]
  )

  // Current colors (from config or default)
  const colors = useMemo<CorporateColors>(() => {
    if (currentConfig) {
      return currentConfig.colors
    }
    const defaultPreset = getDefaultPreset()
    return {
      primary: defaultPreset.primary,
      secondary: defaultPreset.secondary,
      textOnPrimary: defaultPreset.textOnPrimary,
      textOnSecondary: defaultPreset.textOnSecondary,
    }
  }, [currentConfig])

  // Apply a preset
  const applyPreset = useCallback(
    async (presetId: string) => {
      const preset = getPreset(presetId)
      if (!preset) {
        console.warn(`[useCorporateColors] Preset not found: ${presetId}`)
        return
      }

      // Check feature gate
      if (preset.premium && !isPremiumUser) {
        console.warn('[useCorporateColors] Premium preset requires subscription')
        return
      }

      // Apply to DOM
      applyCorporateColors({
        primary: preset.primary,
        secondary: preset.secondary,
        textOnPrimary: preset.textOnPrimary,
        textOnSecondary: preset.textOnSecondary,
      })

      // Create and save config
      const config = createThemeConfigFromPreset(preset)
      setCurrentConfig(config)
      await saveTheme(config)

      // Update user profile
      if (isPremiumUser) {
        updateProfile({
          corporateColors: {
            primary: preset.primary,
            secondary: preset.secondary,
            textOnPrimary: preset.textOnPrimary,
            textOnSecondary: preset.textOnSecondary,
            presetId: preset.id,
            customized: false,
          },
        })
      }
    },
    [isPremiumUser, updateProfile]
  )

  // Apply custom colors
  const applyCustomColors = useCallback(
    async (newColors: CorporateColors) => {
      if (!isPremiumUser) {
        console.warn('[useCorporateColors] Custom colors require subscription')
        return
      }

      // Apply to DOM
      applyCorporateColors(newColors)

      // Create and save config
      const config = createThemeConfig(newColors, { customized: true })
      setCurrentConfig(config)
      await saveTheme(config)

      // Update user profile
      updateProfile({
        corporateColors: {
          ...newColors,
          customized: true,
        },
      })
    },
    [isPremiumUser, updateProfile]
  )

  // Reset to default
  const reset = useCallback(async () => {
    resetToDefaultTheme()
    setCurrentConfig(null)

    // Clear from storage
    try {
      localStorage.removeItem('hallenfussball_theme')
    } catch {
      // Ignore storage errors
    }

    // Update user profile
    updateProfile({
      corporateColors: undefined,
    })
  }, [updateProfile])

  // Validate a color
  const validateColor = useCallback((hex: string): ColorValidation => {
    return validateCorporateColor(hex)
  }, [])

  return {
    // Current state
    colors,
    presetId: currentConfig?.presetId ?? null,
    isCustomized: currentConfig?.customized ?? false,
    isLoading,

    // Available presets
    allPresets: colorPresets,
    freePresets: getFreePresets(),
    premiumPresets: getPremiumPresets(),

    // Actions
    applyPreset,
    applyCustomColors,
    reset,

    // Validation
    validateColor,

    // Feature gate info
    canUsePreset: checkCanUsePreset,
    isPremiumUser,
    currentPlan: profile.plan,
  }
}

// ============================================================================
// Lightweight Hook for Reading Only
// ============================================================================

/**
 * Lightweight hook that only reads current theme colors
 * Use this in components that just need to display colors
 */
export function useCurrentThemeColors(): CorporateColors {
  const [colors, setColors] = useState<CorporateColors>(() => {
    const defaultPreset = getDefaultPreset()
    return {
      primary: defaultPreset.primary,
      secondary: defaultPreset.secondary,
      textOnPrimary: defaultPreset.textOnPrimary,
      textOnSecondary: defaultPreset.textOnSecondary,
    }
  })

  useEffect(() => {
    const loadColors = async () => {
      try {
        const config = await loadTheme()
        if (config) {
          setColors(config.colors)
        }
      } catch {
        // Use defaults
      }
    }
    void loadColors()
  }, [])

  return colors
}
