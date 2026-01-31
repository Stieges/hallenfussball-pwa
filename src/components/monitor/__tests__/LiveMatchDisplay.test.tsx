/**
 * LiveMatchDisplay Unit Tests
 *
 * Tests for MON-A01: Monitor-Display zeigt Live-Spiel
 * Tests for MON-B03: Live-Slide ohne laufendes Spiel
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LiveMatchDisplay, NoMatchDisplay } from '../LiveMatchDisplay';
import type { LiveMatch } from '../../../hooks/useLiveMatches';

// Mock useMonitorTheme
vi.mock('../../../hooks', () => ({
  useMonitorTheme: vi.fn(() => ({
    resolvedTheme: 'dark',
    themeColors: {
      text: '#FFFFFF',
      textSecondary: '#A0A0A0',
      textMuted: '#666666',
      background: '#0a0a0f',
      backgroundGradient: 'linear-gradient(180deg, #0a0a0f 0%, #1a1a2e 100%)',
      surface: '#1a1a2e',
      border: '#2a2a4e',
      borderActive: '#00E676',
      score: '#FFFFFF',
      scoreShadow: '0 0 30px rgba(0, 230, 118, 0.5)',
      liveBadgeBg: 'rgba(0, 230, 118, 0.2)',
      liveBadgeText: '#00E676',
      pauseBadgeBg: 'rgba(255, 193, 7, 0.2)',
      pauseBadgeText: '#FFC107',
      liveDot: '#00E676',
      glow: '0 0 20px rgba(0, 230, 118, 0.3)',
      glowActive: '0 0 40px rgba(0, 230, 118, 0.5)',
      textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)',
      textShadowScore: '0 4px 8px rgba(0, 0, 0, 0.5)',
      textShadowLight: '0 1px 2px rgba(0, 0, 0, 0.3)',
    },
  })),
}));

// Helper to create mock match data
function createMockMatch(overrides: Partial<LiveMatch> = {}): LiveMatch {
  return {
    id: 'match-1',
    number: 1,
    phaseLabel: 'Gruppenphase',
    fieldId: 'field-1',
    field: 1,
    scheduledKickoff: new Date().toISOString(),
    homeTeam: { id: 'team-1', name: 'FC Bayern' },
    awayTeam: { id: 'team-2', name: 'Borussia Dortmund' },
    homeScore: 2,
    awayScore: 1,
    status: 'RUNNING',
    elapsedSeconds: 300,
    durationSeconds: 600,
    events: [],
    ...overrides,
  };
}

describe('LiveMatchDisplay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // MON-A01: Monitor-Display zeigt Live-Spiel
  // ==========================================================================
  describe('MON-A01: Live-Spiel Anzeige', () => {
    it('zeigt Team-Namen korrekt an', () => {
      const match = createMockMatch();
      render(<LiveMatchDisplay match={match} />);

      expect(screen.getByText('FC Bayern')).toBeInTheDocument();
      expect(screen.getByText('Borussia Dortmund')).toBeInTheDocument();
    });

    it('zeigt Score korrekt an', () => {
      const match = createMockMatch({ homeScore: 3, awayScore: 2 });
      render(<LiveMatchDisplay match={match} />);

      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText(':')).toBeInTheDocument();
    });

    it('zeigt LIVE-Badge bei laufendem Spiel', () => {
      const match = createMockMatch({ status: 'RUNNING' });
      render(<LiveMatchDisplay match={match} />);

      expect(screen.getByText('LIVE')).toBeInTheDocument();
    });

    it('zeigt Feld und Spielnummer', () => {
      const match = createMockMatch({ field: 2, number: 5 });
      render(<LiveMatchDisplay match={match} />);

      expect(screen.getByText(/Feld 2/)).toBeInTheDocument();
      expect(screen.getByText(/Spiel 5/)).toBeInTheDocument();
    });

    it('zeigt Gruppeninfo wenn vorhanden', () => {
      const match = createMockMatch({ group: 'A' });
      render(<LiveMatchDisplay match={match} group="A" />);

      expect(screen.getByText(/Gruppe A/)).toBeInTheDocument();
    });

    it('zeigt Schiedsrichter-Info wenn vorhanden', () => {
      const match = createMockMatch({ refereeName: 'Max Mustermann' });
      render(<LiveMatchDisplay match={match} />);

      expect(screen.getByText(/Schiedsrichter: Max Mustermann/)).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Status-Varianten
  // ==========================================================================
  describe('Status-Varianten', () => {
    it('zeigt PAUSE-Badge bei pausiertem Spiel', () => {
      const match = createMockMatch({ status: 'PAUSED' });
      render(<LiveMatchDisplay match={match} />);

      expect(screen.getByText('PAUSE')).toBeInTheDocument();
    });

    it('zeigt BEENDET-Badge bei abgeschlossenem Spiel', () => {
      const match = createMockMatch({ status: 'FINISHED' });
      render(<LiveMatchDisplay match={match} />);

      expect(screen.getByText('BEENDET')).toBeInTheDocument();
    });

    it('zeigt WARTET-Badge bei nicht gestartetem Spiel', () => {
      const match = createMockMatch({ status: 'NOT_STARTED' });
      render(<LiveMatchDisplay match={match} />);

      expect(screen.getByText('WARTET')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Size-Varianten
  // ==========================================================================
  describe('Size-Varianten', () => {
    it('rendert mit size="md"', () => {
      const match = createMockMatch();
      const { container } = render(<LiveMatchDisplay match={match} size="md" />);
      expect(container.firstChild).toBeInTheDocument();
    });

    it('rendert mit size="lg"', () => {
      const match = createMockMatch();
      const { container } = render(<LiveMatchDisplay match={match} size="lg" />);
      expect(container.firstChild).toBeInTheDocument();
    });

    it('rendert mit size="xl" (default)', () => {
      const match = createMockMatch();
      const { container } = render(<LiveMatchDisplay match={match} size="xl" />);
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Theme-Support
  // ==========================================================================
  describe('Theme-Support', () => {
    it('akzeptiert theme prop', () => {
      const match = createMockMatch();
      const { container } = render(<LiveMatchDisplay match={match} theme="light" />);
      expect(container.firstChild).toBeInTheDocument();
    });

    it('akzeptiert theme="auto"', () => {
      const match = createMockMatch();
      const { container } = render(<LiveMatchDisplay match={match} theme="auto" />);
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================
  describe('Edge Cases', () => {
    it('zeigt 0:0 Score korrekt', () => {
      const match = createMockMatch({ homeScore: 0, awayScore: 0 });
      render(<LiveMatchDisplay match={match} />);

      const zeros = screen.getAllByText('0');
      expect(zeros).toHaveLength(2);
    });

    it('zeigt hohen Score (99:99) ohne Layout-Probleme', () => {
      const match = createMockMatch({ homeScore: 99, awayScore: 99 });
      render(<LiveMatchDisplay match={match} />);

      const ninetyNines = screen.getAllByText('99');
      expect(ninetyNines).toHaveLength(2);
    });

    it('rendert mit langem Team-Namen', () => {
      const fullName = 'FC Sportfreunde 1897 Düsseldorf-Oberkassel e.V.';
      const match = createMockMatch({
        homeTeam: { id: 'team-1', name: fullName },
      });
      render(<LiveMatchDisplay match={match} />);

      // TeamNameDisplay abbreviates long names; full name is in title attribute
      expect(screen.getByTitle(fullName)).toBeInTheDocument();
    });

    it('rendert mit Emoji im Team-Namen', () => {
      const match = createMockMatch({
        homeTeam: { id: 'team-1', name: '⚽ Lions 🦁' },
      });
      render(<LiveMatchDisplay match={match} />);

      expect(screen.getByText('⚽ Lions 🦁')).toBeInTheDocument();
    });
  });
});

// =============================================================================
// NoMatchDisplay Tests
// =============================================================================
describe('NoMatchDisplay', () => {
  // MON-B03: Live-Slide ohne laufendes Spiel
  describe('MON-B03: Kein laufendes Spiel', () => {
    it('zeigt Standard-Nachricht', () => {
      render(<NoMatchDisplay />);

      expect(screen.getByText('Kein laufendes Spiel')).toBeInTheDocument();
    });

    it('zeigt Hinweis auf Tabellen-Anzeige', () => {
      render(<NoMatchDisplay />);

      expect(screen.getByText(/Tabellen werden angezeigt/i)).toBeInTheDocument();
    });

    it('zeigt custom Nachricht', () => {
      render(<NoMatchDisplay message="Pause - Gleich geht es weiter" />);

      expect(screen.getByText('Pause - Gleich geht es weiter')).toBeInTheDocument();
    });

    it('rendert mit verschiedenen Größen', () => {
      const { rerender, container } = render(<NoMatchDisplay size="md" />);
      expect(container.firstChild).toBeInTheDocument();

      rerender(<NoMatchDisplay size="lg" />);
      expect(container.firstChild).toBeInTheDocument();

      rerender(<NoMatchDisplay size="xl" />);
      expect(container.firstChild).toBeInTheDocument();
    });

    it('rendert im Fullscreen-Modus', () => {
      const { container } = render(<NoMatchDisplay fullscreen />);
      expect(container.firstChild).toBeInTheDocument();
    });
  });
});
