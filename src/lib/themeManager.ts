/**
 * Theme Manager
 *
 * Handles runtime CSS variable injection for corporate colors.
 * Provides persistence via localStorage with future API support.
 */

import { getOptimalTextColor, darken, withAlpha } from './colorUtils'
import { getDefaultPreset, getPreset, type ColorPreset } from '../config/colorPresets'

// ============================================================================
// Types
// ============================================================================

export interface CorporateColors {
  primary: string
  secondary: string
  textOnPrimary?: string
  textOnSecondary?: string
}

export interface ThemeConfig {
  colors: CorporateColors
  presetId?: string
  customized: boolean
  updatedAt: string
}

/**
 * Theme source interface for future API integration
 */
export interface ThemeSource {
  type: 'local' | 'api'
  load: () => Promise<ThemeConfig | null>
  save: (config: ThemeConfig) => Promise<void>
  clear: () => Promise<void>
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'hallenfussball_theme'

const DEFAULT_COLORS: CorporateColors = {
  primary: '#00E676',
  secondary: '#00B0FF',
  textOnPrimary: '#0A1628',
  textOnSecondary: '#0A1628',
}

// CSS custom property names for theme colors
const THEME_PROPERTIES = [
  '--theme-primary',
  '--theme-primary-hover',
  '--theme-primary-active',
  '--theme-primary-light',
  '--theme-on-primary',
  '--theme-secondary',
  '--theme-secondary-hover',
  '--theme-secondary-light',
  '--theme-on-secondary',
  '--theme-gradient',
] as const

// ============================================================================
// State
// ============================================================================

let currentThemeSource: ThemeSource = createLocalStorageSource()
let currentConfig: ThemeConfig | null = null

// ============================================================================
// Theme Source Implementations
// ============================================================================

/**
 * Creates a localStorage-based theme source
 */
function createLocalStorageSource(): ThemeSource {
  return {
    type: 'local',
    async load(): Promise<ThemeConfig | null> {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (!stored) {return null}
        return JSON.parse(stored) as ThemeConfig
      } catch {
        console.warn('[ThemeManager] Failed to load theme from localStorage')
        return null
      }
    },
    async save(config: ThemeConfig): Promise<void> {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
      } catch (error) {
        console.error('[ThemeManager] Failed to save theme to localStorage:', error)
      }
    },
    async clear(): Promise<void> {
      localStorage.removeItem(STORAGE_KEY)
    },
  }
}

/**
 * Sets the theme source (for future API integration)
 */
export function setThemeSource(source: ThemeSource): void {
  currentThemeSource = source
}

/**
 * Gets the current theme source
 */
export function getThemeSource(): ThemeSource {
  return currentThemeSource
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Applies corporate colors to the document
 * Injects CSS custom properties into :root
 */
export function applyCorporateColors(colors: CorporateColors): void {
  const root = document.documentElement.style

  // Calculate text colors if not provided
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Empty color should calculate from primary
  const textOnPrimary = colors.textOnPrimary || getOptimalTextColor(colors.primary)
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Empty color should calculate from secondary
  const textOnSecondary = colors.textOnSecondary || getOptimalTextColor(colors.secondary)

  // Apply primary colors
  root.setProperty('--theme-primary', colors.primary)
  root.setProperty('--theme-primary-hover', darken(colors.primary, 8))
  root.setProperty('--theme-primary-active', darken(colors.primary, 12))
  root.setProperty('--theme-primary-light', withAlpha(colors.primary, 0.15))
  root.setProperty('--theme-on-primary', textOnPrimary)

  // Apply secondary colors
  root.setProperty('--theme-secondary', colors.secondary)
  root.setProperty('--theme-secondary-hover', darken(colors.secondary, 8))
  root.setProperty('--theme-secondary-light', withAlpha(colors.secondary, 0.15))
  root.setProperty('--theme-on-secondary', textOnSecondary)

  // Apply gradient
  root.setProperty(
    '--theme-gradient',
    `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`
  )
}

/**
 * Resets theme to default colors
 * Removes all custom properties (falls back to CSS defaults)
 */
export function resetToDefaultTheme(): void {
  const root = document.documentElement.style

  // Remove all theme properties
  THEME_PROPERTIES.forEach((prop) => {
    root.removeProperty(prop)
  })

  currentConfig = null
}

/**
 * Applies a preset by ID
 */
export function applyPreset(presetId: string): void {
  const preset = getPreset(presetId)

  if (!preset) {
    console.warn(`[ThemeManager] Preset not found: ${presetId}`)
    return
  }

  applyCorporateColors({
    primary: preset.primary,
    secondary: preset.secondary,
    textOnPrimary: preset.textOnPrimary,
    textOnSecondary: preset.textOnSecondary,
  })
}

// ============================================================================
// Persistence
// ============================================================================

/**
 * Saves current theme configuration
 */
export async function saveTheme(config: ThemeConfig): Promise<void> {
  currentConfig = config
  await currentThemeSource.save(config)
}

/**
 * Loads theme from storage and applies it
 * Returns the loaded config or null if none exists
 */
export async function loadTheme(): Promise<ThemeConfig | null> {
  const config = await currentThemeSource.load()

  if (config) {
    currentConfig = config
    applyCorporateColors(config.colors)
  }

  return config
}

/**
 * Clears stored theme and resets to default
 */
export async function clearTheme(): Promise<void> {
  await currentThemeSource.clear()
  resetToDefaultTheme()
}

/**
 * Gets the current theme config (in-memory)
 */
export function getCurrentConfig(): ThemeConfig | null {
  return currentConfig
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a ThemeConfig from colors
 */
export function createThemeConfig(
  colors: CorporateColors,
  options: { presetId?: string; customized?: boolean } = {}
): ThemeConfig {
  return {
    colors,
    presetId: options.presetId,
    customized: options.customized ?? false,
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Creates a ThemeConfig from a preset
 */
export function createThemeConfigFromPreset(preset: ColorPreset): ThemeConfig {
  return createThemeConfig(
    {
      primary: preset.primary,
      secondary: preset.secondary,
      textOnPrimary: preset.textOnPrimary,
      textOnSecondary: preset.textOnSecondary,
    },
    { presetId: preset.id, customized: false }
  )
}

/**
 * Checks if the current theme differs from default
 */
export function isCustomTheme(): boolean {
  if (!currentConfig) {return false}
  const defaultPreset = getDefaultPreset()
  return (
    currentConfig.colors.primary !== defaultPreset.primary ||
    currentConfig.colors.secondary !== defaultPreset.secondary
  )
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initializes the theme manager
 * Should be called early in app lifecycle (but after DOM is ready)
 */
export async function initializeTheme(): Promise<void> {
  await loadTheme()
}

// ============================================================================
// Export Default Colors
// ============================================================================

export { DEFAULT_COLORS }
