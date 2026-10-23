// DOM-only test setup. Nur für das `dom`-Vitest-Projekt (environment: 'jsdom').
// Ergänzt src/test/setup.ts (dort die umgebungsunabhängigen Mocks: i18n).
import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

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
// Ausstehende Rahmen werden gemerkt und nach jedem Test (und am Dateiende) verworfen,
// damit kein Rueckruf nach dem Abbau der Testumgebung mehr laeuft.
let nextRafId = 1
const pendingRafs = new Map<number, ReturnType<typeof setTimeout>>()

function clearPendingRafs(): void {
  pendingRafs.forEach((timer) => clearTimeout(timer))
  pendingRafs.clear()
}

window.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
  const id = nextRafId++
  const timer = setTimeout(() => {
    pendingRafs.delete(id)
    if (typeof globalThis.requestAnimationFrame === 'undefined') {return}
    cb(performance.now())
  }, 16)
  pendingRafs.set(id, timer)
  return id
})
window.cancelAnimationFrame = vi.fn((id: number) => {
  const timer = pendingRafs.get(id)
  if (timer !== undefined) {clearTimeout(timer)}
  pendingRafs.delete(id)
})

afterEach(clearPendingRafs)
afterAll(clearPendingRafs)

// Suppress console errors in tests (optional)
// vi.spyOn(console, 'error').mockImplementation(() => {})
