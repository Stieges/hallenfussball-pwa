/**
 * MonitorsConfigTab Unit Tests
 *
 * Tests for MON-A06: Monitor erstellen
 * Tests for MON-A08: URL kopieren
 * Tests for MON-A09: Monitor duplizieren
 * Tests for MON-B01: Keine Monitore konfiguriert
 * Tests for MON-C10: Doppelter Monitor-Name
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MonitorsConfigTab } from '../MonitorsConfigTab';
import type { Tournament } from '../../../types/tournament';
import type { TournamentMonitor } from '../../../types/monitor';

// Mock useMonitors hook
const mockCreateMonitor = vi.fn();
const mockDeleteMonitor = vi.fn();
const mockDuplicateMonitor = vi.fn();
const mockGetDisplayUrl = vi.fn();

vi.mock('../../../hooks', () => ({
  useMonitors: vi.fn(() => ({
    monitors: [],
    createMonitor: mockCreateMonitor,
    deleteMonitor: mockDeleteMonitor,
    duplicateMonitor: mockDuplicateMonitor,
    getDisplayUrl: mockGetDisplayUrl,
  })),
}));

// Helper to create mock tournament (using unknown cast for test simplicity)
function createMockTournament(monitors: TournamentMonitor[] = []): Tournament {
  return {
    id: 'tournament-1',
    name: 'Test Turnier',
    teams: [],
    matches: [],
    monitors,
  } as unknown as Tournament;
}

// Helper to create mock monitor
function createMockMonitor(overrides: Partial<TournamentMonitor> = {}): TournamentMonitor {
  return {
    id: 'monitor-1',
    name: 'Haupthalle',
    defaultSlideDuration: 15,
    transition: 'fade',
    transitionDuration: 500,
    theme: 'dark',
    performanceMode: 'auto',
    slides: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('MonitorsConfigTab', () => {
  const mockOnTournamentUpdate = vi.fn();
  const mockOnEditMonitor = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDisplayUrl.mockReturnValue('/display/tournament-1/monitor-1');

    // Mock clipboard
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      writable: true,
      configurable: true,
    });
  });

  // ==========================================================================
  // MON-B01: Keine Monitore konfiguriert
  // ==========================================================================
  describe('MON-B01: Empty State', () => {
    it('zeigt Empty-State wenn keine Monitore vorhanden', () => {
      const tournament = createMockTournament();

      render(
        <MonitorsConfigTab
          tournament={tournament}
          onTournamentUpdate={mockOnTournamentUpdate}
        />
      );

      expect(screen.getByText('tournament:monitors.emptyState')).toBeInTheDocument();
      expect(screen.getByText(/monitors\.emptyStateHint/)).toBeInTheDocument();
    });

    it('zeigt TV-Emoji im Empty-State', () => {
      const tournament = createMockTournament();

      render(
        <MonitorsConfigTab
          tournament={tournament}
          onTournamentUpdate={mockOnTournamentUpdate}
        />
      );

      expect(screen.getByText('📺')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // MON-A06: Monitor erstellen
  // ==========================================================================
  describe('MON-A06: Monitor erstellen', () => {
    it('zeigt Create-Form nach Klick auf "Neuer Monitor"', async () => {
      const user = userEvent.setup();
      const tournament = createMockTournament();

      render(
        <MonitorsConfigTab
          tournament={tournament}
          onTournamentUpdate={mockOnTournamentUpdate}
        />
      );

      await user.click(screen.getByText(/monitors\.addMonitor/));

      expect(screen.getByText('tournament:monitors.createTitle')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/monitors\.namePlaceholder/)).toBeInTheDocument();
    });

    it('versteckt "Neuer Monitor" Button im Create-Modus', async () => {
      const user = userEvent.setup();
      const tournament = createMockTournament();

      render(
        <MonitorsConfigTab
          tournament={tournament}
          onTournamentUpdate={mockOnTournamentUpdate}
        />
      );

      await user.click(screen.getByText(/monitors\.addMonitor/));

      expect(screen.queryByRole('button', { name: /monitors\.addMonitor/ })).not.toBeInTheDocument();
    });

    it('ruft createMonitor mit Name auf', async () => {
      const user = userEvent.setup();
      const tournament = createMockTournament();

      mockCreateMonitor.mockResolvedValue(createMockMonitor({ id: 'new-monitor' }));

      render(
        <MonitorsConfigTab
          tournament={tournament}
          onTournamentUpdate={mockOnTournamentUpdate}
          onEditMonitor={mockOnEditMonitor}
        />
      );

      await user.click(screen.getByText(/monitors\.addMonitor/));
      await user.type(screen.getByPlaceholderText(/monitors\.namePlaceholder/), 'Neuer Test Monitor');
      await user.click(screen.getByText(/monitors\.createAndEdit/));

      expect(mockCreateMonitor).toHaveBeenCalledWith('Neuer Test Monitor');
    });

    it('öffnet Editor nach erfolgreicher Erstellung', async () => {
      const user = userEvent.setup();
      const tournament = createMockTournament();

      mockCreateMonitor.mockResolvedValue(createMockMonitor({ id: 'new-monitor' }));

      render(
        <MonitorsConfigTab
          tournament={tournament}
          onTournamentUpdate={mockOnTournamentUpdate}
          onEditMonitor={mockOnEditMonitor}
        />
      );

      await user.click(screen.getByText(/monitors\.addMonitor/));
      await user.type(screen.getByPlaceholderText(/monitors\.namePlaceholder/), 'Test');
      await user.click(screen.getByText(/monitors\.createAndEdit/));

      await waitFor(() => {
        expect(mockOnEditMonitor).toHaveBeenCalledWith('new-monitor');
      });
    });

    it('schließt Form bei Abbrechen', async () => {
      const user = userEvent.setup();
      const tournament = createMockTournament();

      render(
        <MonitorsConfigTab
          tournament={tournament}
          onTournamentUpdate={mockOnTournamentUpdate}
        />
      );

      await user.click(screen.getByText(/monitors\.addMonitor/));
      await user.click(screen.getByText('tournament:monitors.cancel'));

      expect(screen.queryByText('tournament:monitors.createTitle')).not.toBeInTheDocument();
    });

    it('schließt Form bei Escape', async () => {
      const user = userEvent.setup();
      const tournament = createMockTournament();

      render(
        <MonitorsConfigTab
          tournament={tournament}
          onTournamentUpdate={mockOnTournamentUpdate}
        />
      );

      await user.click(screen.getByText(/monitors\.addMonitor/));
      await user.keyboard('{Escape}');

      expect(screen.queryByText('tournament:monitors.createTitle')).not.toBeInTheDocument();
    });

    it('erstellt bei Enter', async () => {
      const user = userEvent.setup();
      const tournament = createMockTournament();

      mockCreateMonitor.mockResolvedValue(createMockMonitor({ id: 'new-monitor' }));

      render(
        <MonitorsConfigTab
          tournament={tournament}
          onTournamentUpdate={mockOnTournamentUpdate}
        />
      );

      await user.click(screen.getByText(/monitors\.addMonitor/));
      await user.type(screen.getByPlaceholderText(/monitors\.namePlaceholder/), 'Test{Enter}');

      expect(mockCreateMonitor).toHaveBeenCalledWith('Test');
    });
  });

  // ==========================================================================
  // Validation
  // ==========================================================================
  describe('Validation', () => {
    it('zeigt Error bei leerem Namen', async () => {
      const user = userEvent.setup();
      const tournament = createMockTournament();

      render(
        <MonitorsConfigTab
          tournament={tournament}
          onTournamentUpdate={mockOnTournamentUpdate}
        />
      );

      await user.click(screen.getByText(/monitors\.addMonitor/));
      await user.click(screen.getByText(/monitors\.createAndEdit/));

      expect(screen.getByText('tournament:monitors.errors.nameRequired')).toBeInTheDocument();
    });

    it('zeigt Error bei zu langem Namen (>50 Zeichen)', async () => {
      const user = userEvent.setup();
      const tournament = createMockTournament();

      render(
        <MonitorsConfigTab
          tournament={tournament}
          onTournamentUpdate={mockOnTournamentUpdate}
        />
      );

      await user.click(screen.getByText(/monitors\.addMonitor/));
      await user.type(
        screen.getByPlaceholderText(/monitors\.namePlaceholder/),
        'A'.repeat(51)
      );
      await user.click(screen.getByText(/monitors\.createAndEdit/));

      expect(screen.getByText('tournament:monitors.errors.nameTooLong')).toBeInTheDocument();
    });
  });

});
