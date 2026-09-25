import { vi } from 'vitest'

// Umgebungsunabhängiges Setup — läuft für BEIDE Vitest-Projekte (unit-node und dom).
// DOM-spezifische Mocks (jest-dom, cleanup, window/localStorage/matchMedia/
// ResizeObserver/requestAnimationFrame) stehen in src/test/setup.dom.ts, das nur
// im `dom`-Projekt zusätzlich geladen wird — window existiert unter environment: 'node' nicht.

// Mock i18next (direct import) — returns key as translation (passthrough)
vi.mock('i18next', () => ({
  default: {
    t: (key: string, opts?: Record<string, unknown>) => {
      // Return key (with interpolation values replaced if provided)
      let result = String(key)
      if (opts) {
        for (const [k, v] of Object.entries(opts)) {
          if (k === 'count' || k === 'defaultValue' || k === 'ns') { continue }
          result = result.replace(`{{${k}}}`, String(v))
        }
      }
      return result
    },
    language: 'de',
    changeLanguage: vi.fn().mockResolvedValue(undefined),
    use: vi.fn().mockReturnThis(),
    init: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    off: vi.fn(),
    isInitialized: true,
  },
  __esModule: true,
}))

// Mock react-i18next — returns key as translation (passthrough)
vi.mock('react-i18next', () => ({
  useTranslation: (ns?: string) => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      const prefix = ns ? `${ns}:` : ''
      // Return key with interpolation values replaced if provided
      let result = `${prefix}${key}`
      if (opts) {
        for (const [k, v] of Object.entries(opts)) {
          if (k === 'count' || k === 'defaultValue' || k === 'ns') { continue }
          result = result.replace(`{{${k}}}`, String(v))
        }
      }
      return result
    },
    i18n: {
      language: 'de',
      changeLanguage: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      off: vi.fn(),
    },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}))

