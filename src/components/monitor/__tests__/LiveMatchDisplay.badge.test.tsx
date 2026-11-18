/**
 * Aufgabe 1.2 (Spielanzeige): das Abzeichen im Kopf der Monitor-Live-Folie (@OB-065, @OB-066) mit echten DE-Texten.
 * Aus `LiveMatchDisplay.test.tsx` und `LiveMatchDisplay.b44a2.test.tsx` hierher verschoben (Register W5, W6): sie
 * brauchten den Wortlaut, der Schlüssel-Mock dort liefert nur Schlüssel. Erwartungen unverändert.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.unmock('i18next');
vi.unmock('react-i18next');

import { initRealDeI18n } from '../../../test/realDeI18n';
import { LiveMatchDisplay } from '../LiveMatchDisplay';
import type { LiveMatch } from '../../../hooks/useLiveMatches';
import { monitorThemes } from '../../../design-tokens';

vi.mock('../../../hooks', async () => {
  const { monitorThemes: themes } = await import('../../../design-tokens');
  return { useMonitorTheme: vi.fn(() => ({ resolvedTheme: 'dark', themeColors: themes.dark })) };
});

await initRealDeI18n();

function createMatch(overrides: Partial<LiveMatch> = {}): LiveMatch {
  return {
    id: 'm1', number: 11, phaseLabel: 'Gruppe A', fieldId: 'f1', field: 1,
    scheduledKickoff: '2026-11-28T15:05', homeTeam: { id: 't1', name: 'FC Nord' },
    awayTeam: { id: 't2', name: 'DJK Berg' }, homeScore: 2, awayScore: 1,
    status: 'RUNNING', elapsedSeconds: 100, durationSeconds: 600, events: [], group: 'A',
    ...overrides,
  };
}

describe('Abzeichen im Kopf der Live-Folie', () => {
  it('@OB-066 zeigt Abzeichen „Live“ bei laufendem Spiel', () => {
    render(<LiveMatchDisplay match={createMatch({ status: 'RUNNING' })} />);
    expect(screen.getByTestId('match-status-badge')).toHaveTextContent('Live');
  });

  // Umgestellt wegen @ZM-215 (Daniel 2026-11-19: „jede Angabe nur an einer Stelle“): bei angehaltener Uhr bleibt das Abzeichen oben links „Live“, „Pause“ steht als Symbol an der Uhr
  it('@ZM-215 Gegenbeispiel: bei pausiertem Spiel steht oben links „Live“, nicht „Pause“', () => {
    render(<LiveMatchDisplay match={createMatch({ status: 'PAUSED' })} />);
    expect(screen.getByTestId('match-status-badge')).toHaveTextContent('Live');
    expect(screen.getByTestId('match-status-badge')).not.toHaveTextContent('Pause');
  });

  it('@OB-066 zeigt Abzeichen „Ende“ bei abgeschlossenem Spiel', () => {
    render(<LiveMatchDisplay match={createMatch({ status: 'FINISHED' })} />);
    expect(screen.getByTestId('match-status-badge')).toHaveTextContent('Ende');
  });

  it('@OB-066 geplantes Spiel trägt kein Abzeichen, sondern seine Anstoßzeit „15:05“', () => {
    render(<LiveMatchDisplay match={createMatch({ status: 'NOT_STARTED' })} />);
    expect(screen.queryByTestId('match-status-badge')).toBeNull();
    expect(screen.getByTestId('match-kickoff')).toHaveTextContent('15:05');
  });

  // Umgestellt wegen @ZM-215 (Daniel 2026-11-19): Halbzeitpause, Pause und Verlängerung gehören der Uhr (Symbol), das Abzeichen bleibt „Live“; das Strafstoßschießen bleibt im Abzeichen
  it('@OB-066 @ZM-215 die Ansicht gibt den Feinstatus vor: „Strafstoßschießen“ steht im Abzeichen, Halbzeit, Pause und Verlängerung nicht (dort bleibt „Live“)', () => {
    for (const [state, wort] of [['halftime', 'Live'], ['pause', 'Live'], ['overtime', 'Live'], ['shootout', 'Strafstoßschießen']] as const) {
      const { unmount } = render(<LiveMatchDisplay match={createMatch({ status: 'PAUSED' })} badge={{ kind: 'badge', state }} />);
      expect(screen.getByTestId('match-status-badge')).toHaveTextContent(wort);
      for (const gemieden of ['Halbzeit', 'Pause', 'Verlängerung']) { expect(screen.getByTestId('match-status-badge')).not.toHaveTextContent(gemieden); }
      unmount();
    }
  });

  it('@OB-066 @ZM-167 Marke: Live (auch bei angehaltener Uhr) und Ende stehen links, jedes nur so breit wie sein Wort (keine feste Spaltenbreite)', () => {
    const marken = (['RUNNING', 'PAUSED', 'FINISHED'] as const).map((status) => {
      const { unmount } = render(<LiveMatchDisplay match={createMatch({ status })} />);
      const slot = screen.getByTestId('live-badge');
      const badge = screen.getByTestId('match-status-badge');
      const marke = { wort: slot.textContent, slotBreite: slot.style.width, badgeBreite: badge.style.width, ausrichtung: slot.style.justifySelf };
      unmount();
      return marke;
    });
    expect(marken.map((m) => m.wort)).toEqual(['Live', 'Live', 'Ende']);
    expect(marken.every((m) => m.slotBreite === '' && m.badgeBreite === '' && m.ausrichtung === 'start')).toBe(true);
  });

  it('@OB-065 Gegenbeispiel: das Abzeichen enthält keine Uhrzeit oder Spielzeit', () => {
    render(<LiveMatchDisplay match={createMatch({ status: 'RUNNING', elapsedSeconds: 323 })} />);
    expect(screen.getByTestId('match-status-badge').textContent).not.toMatch(/\d{1,2}:\d{2}/);
  });

  it('@OB-039 Live im Live-Rot des Monitor-Themes, nicht grün', () => {
    render(<LiveMatchDisplay match={createMatch({ status: 'RUNNING' })} />);
    const badge = screen.getByTestId('match-status-badge');
    expect(badge).toHaveStyle({ background: monitorThemes.dark.liveBadgeFill });
    expect(badge).not.toHaveStyle({ background: monitorThemes.dark.liveBadgeText });
  });
});
