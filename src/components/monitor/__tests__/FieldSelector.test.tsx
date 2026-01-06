/**
 * FieldSelector Unit Tests
 *
 * Tests for field selection tabs, live indicators, and accessibility
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FieldSelector } from '../FieldSelector';

// Mock useMonitorTheme
vi.mock('../../../hooks', () => ({
  useMonitorTheme: vi.fn(() => ({
    resolvedTheme: 'dark',
    themeColors: {
      text: '#FFFFFF',
      border: '#2a2a4e',
      liveBadgeText: '#00E676',
      liveDot: '#00E676',
      fieldSelected: 'rgba(0, 230, 118, 0.15)',
      fieldDefault: 'rgba(26, 26, 46, 0.8)',
      fieldHover: 'rgba(0, 230, 118, 0.1)',
    },
  })),
}));

describe('FieldSelector', () => {
  // ==========================================================================
  // Basic Rendering
  // ==========================================================================
  describe('Basic Rendering', () => {
    it('rendert Buttons für alle Felder', () => {
      const onSelect = vi.fn();
      render(
        <FieldSelector
          numberOfFields={3}
          selectedField={1}
          onSelectField={onSelect}
        />
      );

      expect(screen.getByText('Feld 1')).toBeInTheDocument();
      expect(screen.getByText('Feld 2')).toBeInTheDocument();
      expect(screen.getByText('Feld 3')).toBeInTheDocument();
    });

    it('rendert nichts bei nur einem Feld', () => {
      const onSelect = vi.fn();
      const { container } = render(
        <FieldSelector
          numberOfFields={1}
          selectedField={1}
          onSelectField={onSelect}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('rendert nichts bei 0 Feldern', () => {
      const onSelect = vi.fn();
      const { container } = render(
        <FieldSelector
          numberOfFields={0}
          selectedField={1}
          onSelectField={onSelect}
        />
      );

      expect(container.firstChild).toBeNull();
    });
  });

  // ==========================================================================
  // Selection Behavior
  // ==========================================================================
  describe('Selection Behavior', () => {
    it('ruft onSelectField bei Klick auf', () => {
      const onSelect = vi.fn();
      render(
        <FieldSelector
          numberOfFields={3}
          selectedField={1}
          onSelectField={onSelect}
        />
      );

      fireEvent.click(screen.getByText('Feld 2'));
      expect(onSelect).toHaveBeenCalledWith(2);
    });

    it('zeigt korrekten Selected-State', () => {
      const onSelect = vi.fn();
      render(
        <FieldSelector
          numberOfFields={3}
          selectedField={2}
          onSelectField={onSelect}
        />
      );

      const field2Button = screen.getByText('Feld 2').closest('button');
      expect(field2Button).toHaveAttribute('aria-pressed', 'true');
    });

    it('zeigt nicht-selektierte Felder als unselected', () => {
      const onSelect = vi.fn();
      render(
        <FieldSelector
          numberOfFields={3}
          selectedField={2}
          onSelectField={onSelect}
        />
      );

      const field1Button = screen.getByText('Feld 1').closest('button');
      const field3Button = screen.getByText('Feld 3').closest('button');

      expect(field1Button).toHaveAttribute('aria-pressed', 'false');
      expect(field3Button).toHaveAttribute('aria-pressed', 'false');
    });
  });

  // ==========================================================================
  // Live Indicator
  // ==========================================================================
  describe('Live Indicator', () => {
    it('zeigt Live-Dot bei Feldern mit laufenden Spielen', () => {
      const onSelect = vi.fn();
      const runningFields = new Set([2]);

      const { container } = render(
        <FieldSelector
          numberOfFields={3}
          selectedField={1}
          onSelectField={onSelect}
          fieldsWithRunningMatches={runningFields}
        />
      );

      // Feld 2 should have live dot animation
      const buttons = container.querySelectorAll('button');
      const field2Button = buttons[1]; // Second button = Feld 2

      expect(field2Button.querySelector('[style*="animation"]')).toBeInTheDocument();
    });

    it('zeigt keinen Live-Dot bei Feldern ohne laufende Spiele', () => {
      const onSelect = vi.fn();
      const runningFields = new Set([2]);

      const { container } = render(
        <FieldSelector
          numberOfFields={3}
          selectedField={1}
          onSelectField={onSelect}
          fieldsWithRunningMatches={runningFields}
        />
      );

      // Feld 1 should not have live dot
      const buttons = container.querySelectorAll('button');
      const field1Button = buttons[0];

      expect(field1Button.querySelector('[style*="liveDot"]')).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Accessibility
  // ==========================================================================
  describe('Accessibility', () => {
    it('hat aria-pressed auf allen Buttons', () => {
      const onSelect = vi.fn();
      render(
        <FieldSelector
          numberOfFields={3}
          selectedField={1}
          onSelectField={onSelect}
        />
      );

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toHaveAttribute('aria-pressed');
      });
    });

    it('hat aria-label mit Live-Info', () => {
      const onSelect = vi.fn();
      const runningFields = new Set([2]);

      render(
        <FieldSelector
          numberOfFields={3}
          selectedField={1}
          onSelectField={onSelect}
          fieldsWithRunningMatches={runningFields}
        />
      );

      const field2Button = screen.getByText('Feld 2').closest('button');
      expect(field2Button).toHaveAttribute('aria-label', 'Feld 2 (Spiel läuft)');
    });

    it('hat aria-label ohne Live-Info wenn kein Spiel läuft', () => {
      const onSelect = vi.fn();

      render(
        <FieldSelector
          numberOfFields={3}
          selectedField={1}
          onSelectField={onSelect}
        />
      );

      const field1Button = screen.getByText('Feld 1').closest('button');
      expect(field1Button).toHaveAttribute('aria-label', 'Feld 1');
    });
  });

  // ==========================================================================
  // Hidden State
  // ==========================================================================
  describe('Hidden State', () => {
    it('ist unsichtbar aber noch im DOM wenn hidden=true', () => {
      const onSelect = vi.fn();
      const { container } = render(
        <FieldSelector
          numberOfFields={3}
          selectedField={1}
          onSelectField={onSelect}
          hidden={true}
        />
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.style.opacity).toBe('0');
      expect(wrapper.style.pointerEvents).toBe('none');
    });

    it('ist sichtbar wenn hidden=false', () => {
      const onSelect = vi.fn();
      const { container } = render(
        <FieldSelector
          numberOfFields={3}
          selectedField={1}
          onSelectField={onSelect}
          hidden={false}
        />
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.style.opacity).toBe('1');
      expect(wrapper.style.pointerEvents).toBe('auto');
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================
  describe('Edge Cases', () => {
    it('behandelt viele Felder (10+)', () => {
      const onSelect = vi.fn();
      render(
        <FieldSelector
          numberOfFields={10}
          selectedField={1}
          onSelectField={onSelect}
        />
      );

      expect(screen.getByText('Feld 10')).toBeInTheDocument();
    });

    it('behandelt selectedField außerhalb des Bereichs', () => {
      const onSelect = vi.fn();
      render(
        <FieldSelector
          numberOfFields={3}
          selectedField={99}
          onSelectField={onSelect}
        />
      );

      // Should render without errors
      expect(screen.getByText('Feld 1')).toBeInTheDocument();
    });
  });
});
