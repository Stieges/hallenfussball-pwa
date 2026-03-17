import '@testing-library/jest-dom'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

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

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
}
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock ResizeObserver
class ResizeObserverMock {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}
window.ResizeObserver = ResizeObserverMock

// Mock requestAnimationFrame
window.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
  setTimeout(() => cb(performance.now()), 16)
  return 1
})
window.cancelAnimationFrame = vi.fn()

// Suppress console errors in tests (optional)
// vi.spyOn(console, 'error').mockImplementation(() => {})
