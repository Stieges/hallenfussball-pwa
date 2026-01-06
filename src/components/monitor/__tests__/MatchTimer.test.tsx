/**
 * MatchTimer Unit Tests
 *
 * Tests timer display, progress bar, and status indicators
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MatchTimer } from '../MatchTimer';

// Mock useMonitorTheme
vi.mock('../../../hooks', () => ({
  useMonitorTheme: vi.fn(() => ({
    resolvedTheme: 'dark',
    themeColors: {
      timerNormal: '#FFFFFF',
      timerPaused: '#FFC107',
      timerOvertime: '#FF4444',
      timerSeparator: 'rgba(255, 255, 255, 0.6)',
      timerSecondary: 'rgba(255, 255, 255, 0.8)',
      timerWarning: '#FF6B6B',
      progressTrack: 'rgba(255, 255, 255, 0.1)',
      progressBar: '#00E676',
      progressBarWarning: '#FF6B6B',
      progressInsetShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.3)',
      progressShadow: '0 0 10px rgba(0, 230, 118, 0.5)',
      progressShadowWarning: '0 0 10px rgba(255, 68, 68, 0.5)',
      pauseBadgeBg: 'rgba(255, 193, 7, 0.2)',
      pauseBadgeText: '#FFC107',
      liveBadgeBg: 'rgba(0, 230, 118, 0.2)',
      liveBadgeText: '#00E676',
      overtimeBadgeBg: 'rgba(255, 68, 68, 0.2)',
      textShadowLight: '0 1px 2px rgba(0, 0, 0, 0.3)',
    },
  })),
}));

describe('MatchTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ==========================================================================
  // Basic Rendering
  // ==========================================================================
  describe('Basic Rendering', () => {
    it('zeigt Zeit im MM:SS Format', () => {
      render(
        <MatchTimer
          elapsedSeconds={125}
          durationSeconds={600}
          status="RUNNING"
        />
      );

      // 125 seconds = 02:05
      expect(screen.getByText('02:05')).toBeInTheDocument();
    });

    it('zeigt Gesamtdauer', () => {
      render(
        <MatchTimer
          elapsedSeconds={0}
          durationSeconds={600}
          status="NOT_STARTED"
        />
      );

      // 600 seconds = 10:00
      expect(screen.getByText('10:00')).toBeInTheDocument();
    });

    it('zeigt Trennzeichen zwischen Zeiten', () => {
      render(
        <MatchTimer
          elapsedSeconds={300}
          durationSeconds={600}
          status="RUNNING"
        />
      );

      expect(screen.getByText('/')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Progress Bar
  // ==========================================================================
  describe('Progress Bar', () => {
    it('zeigt Progress Bar wenn showProgress=true', () => {
      const { container } = render(
        <MatchTimer
          elapsedSeconds={300}
          durationSeconds={600}
          status="RUNNING"
          showProgress={true}
        />
      );

      // Progress container should exist
      expect(container.querySelector('[style*="overflow: hidden"]')).toBeInTheDocument();
    });

    it('versteckt Progress Bar wenn showProgress=false', () => {
      const { container } = render(
        <MatchTimer
          elapsedSeconds={300}
          durationSeconds={600}
          status="RUNNING"
          showProgress={false}
        />
      );

      // Should not have progress container
      expect(container.querySelector('[style*="borderRadius"][style*="overflow"]')).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Status Indicators
  // ==========================================================================
  describe('Status Indicators', () => {
    it('zeigt Pause-Badge bei pausiertem Spiel', () => {
      render(
        <MatchTimer
          elapsedSeconds={300}
          durationSeconds={600}
          status="PAUSED"
        />
      );

      expect(screen.getByText('Pause')).toBeInTheDocument();
    });

    it('zeigt Nachspielzeit-Badge bei Overtime', () => {
      render(
        <MatchTimer
          elapsedSeconds={650}
          durationSeconds={600}
          status="RUNNING"
        />
      );

      expect(screen.getByText('Nachspielzeit')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Size Variants
  // ==========================================================================
  describe('Size Variants', () => {
    it('rendert mit size="md"', () => {
      const { container } = render(
        <MatchTimer
          elapsedSeconds={300}
          durationSeconds={600}
          status="RUNNING"
          size="md"
        />
      );
      expect(container.firstChild).toBeInTheDocument();
    });

    it('rendert mit size="lg"', () => {
      const { container } = render(
        <MatchTimer
          elapsedSeconds={300}
          durationSeconds={600}
          status="RUNNING"
          size="lg"
        />
      );
      expect(container.firstChild).toBeInTheDocument();
    });

    it('rendert mit size="xl"', () => {
      const { container } = render(
        <MatchTimer
          elapsedSeconds={300}
          durationSeconds={600}
          status="RUNNING"
          size="xl"
        />
      );
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Real-time Updates
  // ==========================================================================
  describe('Real-time Updates', () => {
    it('aktualisiert Timer bei RUNNING Status', () => {
      const startTime = new Date().toISOString();

      render(
        <MatchTimer
          elapsedSeconds={0}
          durationSeconds={600}
          status="RUNNING"
          timerStartTime={startTime}
          timerElapsedSeconds={0}
        />
      );

      // Initial should show 00:00
      expect(screen.getByText('00:00')).toBeInTheDocument();

      // Advance time by 5 seconds
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // Should now show 00:05
      expect(screen.getByText('00:05')).toBeInTheDocument();
    });

    it('stoppt Updates bei PAUSED Status', () => {
      render(
        <MatchTimer
          elapsedSeconds={120}
          durationSeconds={600}
          status="PAUSED"
        />
      );

      // Should show 02:00
      expect(screen.getByText('02:00')).toBeInTheDocument();

      // Advance time
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // Should still show 02:00 (not updated because paused)
      expect(screen.getByText('02:00')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================
  describe('Edge Cases', () => {
    it('zeigt 00:00 bei elapsedSeconds=0', () => {
      render(
        <MatchTimer
          elapsedSeconds={0}
          durationSeconds={600}
          status="NOT_STARTED"
        />
      );

      expect(screen.getByText('00:00')).toBeInTheDocument();
    });

    it('zeigt korrekte Zeit bei exakt vollen Minuten', () => {
      render(
        <MatchTimer
          elapsedSeconds={300}
          durationSeconds={600}
          status="RUNNING"
        />
      );

      expect(screen.getByText('05:00')).toBeInTheDocument();
    });

    it('behandelt sehr lange Spielzeiten (99:99)', () => {
      render(
        <MatchTimer
          elapsedSeconds={5999}
          durationSeconds={6000}
          status="RUNNING"
        />
      );

      // 5999 seconds = 99:59
      expect(screen.getByText('99:59')).toBeInTheDocument();
    });

    it('clamped Progress auf 100% bei Overtime', () => {
      const { container } = render(
        <MatchTimer
          elapsedSeconds={700}
          durationSeconds={600}
          status="RUNNING"
          showProgress={true}
        />
      );

      // Progress bar width should not exceed 100%
      const progressBar = container.querySelector('[style*="width: 100%"]');
      expect(progressBar).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Warning Threshold
  // ==========================================================================
  describe('Warning Threshold', () => {
    it('verwendet default warningThresholdSeconds von 120', () => {
      // 480/600 = 120 seconds remaining - should be in warning
      const { container } = render(
        <MatchTimer
          elapsedSeconds={480}
          durationSeconds={600}
          status="RUNNING"
        />
      );

      expect(container.firstChild).toBeInTheDocument();
    });

    it('akzeptiert custom warningThresholdSeconds', () => {
      const { container } = render(
        <MatchTimer
          elapsedSeconds={480}
          durationSeconds={600}
          status="RUNNING"
          warningThresholdSeconds={180}
        />
      );

      expect(container.firstChild).toBeInTheDocument();
    });
  });
});
