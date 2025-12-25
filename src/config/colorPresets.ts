/**
 * Corporate Color Presets
 *
 * Defines available color schemes for the application.
 * Premium presets require Pro or Team subscription.
 */

// ============================================================================
// Types
// ============================================================================

export interface ColorPreset {
  id: string
  name: string
  nameEn?: string
  primary: string
  secondary: string
  textOnPrimary?: string   // Auto-calculated if not provided
  textOnSecondary?: string // Auto-calculated if not provided
  category: 'sport' | 'corporate' | 'custom'
  premium: boolean
  /** Optional description shown in preset selector */
  description?: string
}

export type PresetCategory = ColorPreset['category']

// ============================================================================
// Preset Definitions
// ============================================================================

export const colorPresets: ColorPreset[] = [
  // ==========================================================================
  // Free Tier - Standard Theme
  // ==========================================================================
  {
    id: 'default',
    name: 'Standard',
    nameEn: 'Default',
    primary: '#00E676',
    secondary: '#00B0FF',
    textOnPrimary: '#0A1628',
    textOnSecondary: '#0A1628',
    category: 'sport',
    premium: false,
    description: 'Das klassische Hallenfussball-Farbschema',
  },

  // ==========================================================================
  // Premium - Sport Themes (Vereinsfarben)
  // ==========================================================================
  {
    id: 'dfb',
    name: 'DFB Grun',
    nameEn: 'DFB Green',
    primary: '#008642', // WCAG AA: 4.7:1 contrast with white text (was #00A551 = 3.2:1)
    secondary: '#000000',
    textOnPrimary: '#FFFFFF',
    textOnSecondary: '#FFFFFF',
    category: 'sport',
    premium: true,
    description: 'Offizielles DFB-Grun fur Verbands-Turniere',
  },
  {
    id: 'fcb',
    name: 'FC Bayern',
    primary: '#DC052D',
    secondary: '#0066B2',
    textOnPrimary: '#FFFFFF',
    textOnSecondary: '#FFFFFF',
    category: 'sport',
    premium: true,
  },
  {
    id: 'bvb',
    name: 'Borussia Dortmund',
    primary: '#FDE100',
    secondary: '#000000',
    textOnPrimary: '#000000',
    textOnSecondary: '#FFFFFF',
    category: 'sport',
    premium: true,
  },
  {
    id: 'schalke',
    name: 'Schalke 04',
    primary: '#004D9D',
    secondary: '#FFFFFF',
    textOnPrimary: '#FFFFFF',
    textOnSecondary: '#004D9D',
    category: 'sport',
    premium: true,
  },
  {
    id: 'bremen',
    name: 'Werder Bremen',
    primary: '#1A834C', // WCAG AA: 4.8:1 contrast with white text (was #1D9053 = 4.1:1)
    secondary: '#FFFFFF',
    textOnPrimary: '#FFFFFF',
    textOnSecondary: '#1A834C',
    category: 'sport',
    premium: true,
  },
  {
    id: 'hsv',
    name: 'Hamburger SV',
    primary: '#0A3C73',
    secondary: '#FFFFFF',
    textOnPrimary: '#FFFFFF',
    textOnSecondary: '#0A3C73',
    category: 'sport',
    premium: true,
  },

  // ==========================================================================
  // Premium - Corporate Themes (Allgemeine Farben)
  // ==========================================================================
  {
    id: 'red',
    name: 'Sportlich Rot',
    nameEn: 'Athletic Red',
    primary: '#DC2626',
    secondary: '#FFFFFF',
    textOnPrimary: '#FFFFFF',
    textOnSecondary: '#DC2626',
    category: 'corporate',
    premium: true,
    description: 'Kraftvolles Rot fur dynamische Events',
  },
  {
    id: 'purple',
    name: 'Lila',
    nameEn: 'Purple',
    primary: '#7C3AED',
    secondary: '#FFFFFF',
    textOnPrimary: '#FFFFFF',
    textOnSecondary: '#7C3AED',
    category: 'corporate',
    premium: true,
  },
  {
    id: 'teal',
    name: 'Turkis',
    nameEn: 'Teal',
    primary: '#0B8177', // WCAG AA: 4.8:1 contrast with white text (was #0D9488 = 3.7:1)
    secondary: '#FFFFFF',
    textOnPrimary: '#FFFFFF',
    textOnSecondary: '#0B8177',
    category: 'corporate',
    premium: true,
    description: 'Modern und frisch',
  },
  {
    id: 'orange',
    name: 'Orange',
    primary: '#CD4D0B', // WCAG AA: 4.5:1 contrast with white text (was #EA580C = 3.6:1)
    secondary: '#FFFFFF',
    textOnPrimary: '#FFFFFF',
    textOnSecondary: '#CD4D0B',
    category: 'corporate',
    premium: true,
  },
  {
    id: 'pink',
    name: 'Pink',
    primary: '#DB2777',
    secondary: '#FFFFFF',
    textOnPrimary: '#FFFFFF',
    textOnSecondary: '#DB2777',
    category: 'corporate',
    premium: true,
  },
  {
    id: 'gold',
    name: 'Gold',
    primary: '#CA8A04',
    secondary: '#000000',
    textOnPrimary: '#000000',
    textOnSecondary: '#FFFFFF',
    category: 'corporate',
    premium: true,
    description: 'Elegant und hochwertig',
  },
]

// ============================================================================
// Accessor Functions
// ============================================================================

/**
 * Gets a preset by ID
 */
export function getPreset(id: string): ColorPreset | undefined {
  return colorPresets.find((p) => p.id === id)
}

/**
 * Gets the default preset
 */
export function getDefaultPreset(): ColorPreset {
  return colorPresets.find((p) => p.id === 'default')!
}

/**
 * Gets all presets in a category
 */
export function getPresetsByCategory(category: PresetCategory): ColorPreset[] {
  return colorPresets.filter((p) => p.category === category)
}

/**
 * Gets only free presets
 */
export function getFreePresets(): ColorPreset[] {
  return colorPresets.filter((p) => !p.premium)
}

/**
 * Gets only premium presets
 */
export function getPremiumPresets(): ColorPreset[] {
  return colorPresets.filter((p) => p.premium)
}

/**
 * Gets all unique categories
 */
export function getCategories(): PresetCategory[] {
  return [...new Set(colorPresets.map((p) => p.category))]
}

/**
 * Checks if a preset requires premium subscription
 */
export function isPresetPremium(presetId: string): boolean {
  const preset = getPreset(presetId)
  return preset?.premium ?? true
}

// ============================================================================
// Category Labels (for UI)
// ============================================================================

export const categoryLabels: Record<PresetCategory, { de: string; en: string }> = {
  sport: { de: 'Vereinsfarben', en: 'Team Colors' },
  corporate: { de: 'Unternehmensfarben', en: 'Corporate Colors' },
  custom: { de: 'Benutzerdefiniert', en: 'Custom' },
}

export function getCategoryLabel(category: PresetCategory, lang: 'de' | 'en' = 'de'): string {
  return categoryLabels[category][lang]
}
