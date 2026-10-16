/**
 * GoalAnimation Unit Tests
 *
 * Tests for goal celebration animation, queue system, and accessibility
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GoalAnimation, GoalFlash } from '../GoalAnimation';
import type { GoalEventInfo } from '../../../hooks/useLiveMatches';

const VOLL = 'Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921';

function goalEvent(teamName: string): GoalEventInfo {
  return {
    matchId: 'm1',
    teamId: 'teamA',
    teamName,
    side: 'home',
    timestamp: Date.now(),
    newScore: { home: 1, away: 0 },
  };
}

// =============================================================================
// @ZM-087 Tor-Einblendung zeigt das Vereinskürzel nach Liste (MS1)
// =============================================================================
describe('@ZM-087 Tor-Einblendung am Monitor', () => {
  it('Listenwort wird gekürzt: „SG FF Nordheim-Süd 1921“ und kein voller Name', async () => {
    const { container } = render(<GoalAnimation goalEvent={goalEvent(VOLL)} onAnimationComplete={vi.fn()} />);
    expect(await screen.findByText('SG FF Nordheim-Süd 1921')).toBeInTheDocument();
    expect(container.textContent).not.toContain(VOLL);
    expect(container.textContent).not.toContain('…');
  });

  it('Gegenbeispiel: ohne Listenwort bleibt der volle Name („Eintracht Oberweiler-Niederstetten 1919“)', async () => {
    render(<GoalAnimation goalEvent={goalEvent('Eintracht Oberweiler-Niederstetten 1919')} onAnimationComplete={vi.fn()} />);
    expect(await screen.findByText('Eintracht Oberweiler-Niederstetten 1919')).toBeInTheDocument();
  });
});

describe('GoalAnimation', () => {
  // ==========================================================================
  // Basic Rendering
  // ==========================================================================
  describe('Basic Rendering', () => {
    it('rendert nichts wenn goalEvent null', () => {
      const onComplete = vi.fn();
      const { container } = render(
        <GoalAnimation goalEvent={null} onAnimationComplete={onComplete} />
      );

      expect(container.firstChild).toBeNull();
    });

    // Note: Animation rendering tests are complex due to useEffect + setTimeout interaction
    // The component uses queue-based rendering which doesn't immediately show content
    // These are better tested via E2E tests
  });

  // Note: Animation lifecycle and positioning tests require complex timer/state management
  // These are better suited for E2E tests where the full React lifecycle runs naturally
});

// =============================================================================
// GoalFlash Tests
// =============================================================================
describe('GoalFlash', () => {
  it('rendert nichts wenn show=false', () => {
    const { container } = render(<GoalFlash show={false} side="home" />);
    expect(container.firstChild).toBeNull();
  });

  it('rendert Flash wenn show=true', () => {
    const { container } = render(<GoalFlash show={true} side="home" />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('positioniert auf linker Seite für home', () => {
    const { container } = render(<GoalFlash show={true} side="home" />);
    const flash = container.firstChild as HTMLElement;
    expect(flash.style.left).toBe('0px');
    expect(flash.style.right).toBe('50%');
  });

  it('positioniert auf rechter Seite für away', () => {
    const { container } = render(<GoalFlash show={true} side="away" />);
    const flash = container.firstChild as HTMLElement;
    expect(flash.style.left).toBe('50%');
    expect(flash.style.right).toBe('0px');
  });
});
