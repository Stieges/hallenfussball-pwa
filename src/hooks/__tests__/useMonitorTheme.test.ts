/**
 * useMonitorTheme Unit Tests
 *
 * Tests theme resolution and color provision
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMonitorTheme } from '../useMonitorTheme';

describe('useMonitorTheme', () => {
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    // Save original
    originalMatchMedia = window.matchMedia;
  });

  afterEach(() => {
    // Restore original
    window.matchMedia = originalMatchMedia;
  });

  // ==========================================================================
  // Theme Resolution
  // ==========================================================================
  describe('Theme Resolution', () => {
    it('gibt "dark" zurück wenn theme="dark"', () => {
      const { result } = renderHook(() => useMonitorTheme('dark'));

      expect(result.current.resolvedTheme).toBe('dark');
    });

    it('gibt "light" zurück wenn theme="light"', () => {
      const { result } = renderHook(() => useMonitorTheme('light'));

      expect(result.current.resolvedTheme).toBe('light');
    });

    it('verwendet "dark" als Default', () => {
      const { result } = renderHook(() => useMonitorTheme());

      expect(result.current.resolvedTheme).toBe('dark');
    });
  });

  // ==========================================================================
  // Auto Theme Detection
  // ==========================================================================
  describe('Auto Theme Detection', () => {
    it('gibt "dark" zurück wenn System prefers-dark und theme="auto"', () => {
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const { result } = renderHook(() => useMonitorTheme('auto'));

      expect(result.current.resolvedTheme).toBe('dark');
    });

    it('gibt "light" zurück wenn System prefers-light und theme="auto"', () => {
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query !== '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const { result } = renderHook(() => useMonitorTheme('auto'));

      expect(result.current.resolvedTheme).toBe('light');
    });

    it('reagiert auf System-Theme Änderung', () => {
      let currentMatches = true;
      const listeners: ((e: MediaQueryListEvent) => void)[] = [];

      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: currentMatches && query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addEventListener: vi.fn((_, listener) => {
          listeners.push(listener);
        }),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const { result } = renderHook(() => useMonitorTheme('auto'));

      expect(result.current.resolvedTheme).toBe('dark');

      // Simulate system theme change
      act(() => {
        currentMatches = false;
        listeners.forEach(listener => {
          listener({ matches: false } as MediaQueryListEvent);
        });
      });

      expect(result.current.resolvedTheme).toBe('light');
    });
  });

  // ==========================================================================
  // Theme Colors
  // ==========================================================================
  describe('Theme Colors', () => {
    it('gibt themeColors für dark theme zurück', () => {
      const { result } = renderHook(() => useMonitorTheme('dark'));

      expect(result.current.themeColors).toBeDefined();
      expect(result.current.themeColors.text).toBeDefined();
      expect(result.current.themeColors.background).toBeDefined();
    });

    it('gibt themeColors für light theme zurück', () => {
      const { result } = renderHook(() => useMonitorTheme('light'));

      expect(result.current.themeColors).toBeDefined();
      expect(result.current.themeColors.text).toBeDefined();
      expect(result.current.themeColors.background).toBeDefined();
    });

    it('unterschiedliche Farben für dark und light', () => {
      const { result: darkResult } = renderHook(() => useMonitorTheme('dark'));
      const { result: lightResult } = renderHook(() => useMonitorTheme('light'));

      // Background should be different
      expect(darkResult.current.themeColors.background).not.toBe(
        lightResult.current.themeColors.background
      );
    });
  });

  // ==========================================================================
  // Return Type
  // ==========================================================================
  describe('Return Type', () => {
    it('gibt UseMonitorThemeReturn interface zurück', () => {
      const { result } = renderHook(() => useMonitorTheme('dark'));

      expect(result.current).toHaveProperty('resolvedTheme');
      expect(result.current).toHaveProperty('themeColors');
    });

    it('resolvedTheme ist immer "light" oder "dark"', () => {
      const { result: darkResult } = renderHook(() => useMonitorTheme('dark'));
      const { result: lightResult } = renderHook(() => useMonitorTheme('light'));
      const { result: autoResult } = renderHook(() => useMonitorTheme('auto'));

      expect(['light', 'dark']).toContain(darkResult.current.resolvedTheme);
      expect(['light', 'dark']).toContain(lightResult.current.resolvedTheme);
      expect(['light', 'dark']).toContain(autoResult.current.resolvedTheme);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================
  describe('Edge Cases', () => {
    it('behandelt undefined theme', () => {
      const { result } = renderHook(() => useMonitorTheme(undefined as unknown as 'dark'));

      // Should fall back to dark
      expect(result.current.resolvedTheme).toBe('dark');
    });

    it('bereinigt Event Listener bei Unmount', () => {
      const removeEventListener = vi.fn();

      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: true,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener,
        dispatchEvent: vi.fn(),
      }));

      const { unmount } = renderHook(() => useMonitorTheme('auto'));

      unmount();

      expect(removeEventListener).toHaveBeenCalled();
    });
  });
});
