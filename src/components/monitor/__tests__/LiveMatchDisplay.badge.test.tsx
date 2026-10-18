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
import { displayLayout, monitorThemes } from '../../../design-tokens';

vi.mock('../../../hooks', async () => {
  const { monitorThemes: themes } = await import('../../../design-tokens');
  return { useMonitorTheme: vi.fn(() => ({ resolvedTheme: 'dark', themeColors: themes.dark })) };
});

await initRealDeI18n();

const L = displayLayout.scoreArea;

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

  it('@OB-066 zeigt Abzeichen „Pause“ bei pausiertem Spiel', () => {
    render(<LiveMatchDisplay match={createMatch({ status: 'PAUSED' })} />);
    expect(screen.getByTestId('match-status-badge')).toHaveTextContent('Pause');
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

  it('@OB-066 die Ansicht gibt den Feinstatus vor: Abzeichen „Halbzeit“, „Strafstoßschießen“, „Verlängerung“ statt „Pause“', () => {
    for (const [state, wort] of [['halftime', 'Halbzeit'], ['shootout', 'Strafstoßschießen'], ['overtime', 'Verlängerung']] as const) {
      const { unmount } = render(<LiveMatchDisplay match={createMatch({ status: 'PAUSED' })} badge={{ kind: 'badge', state }} />);
      expect(screen.getByTestId('match-status-badge')).toHaveTextContent(wort);
      expect(screen.getByTestId('match-status-badge')).not.toHaveTextContent('Pause');
      unmount();
    }
  });

  it('@OB-066 Marke: dieselbe Breite für Live, Pause, Ende', () => {
    const marken = (['RUNNING', 'PAUSED', 'FINISHED'] as const).map((status) => {
      const { unmount } = render(<LiveMatchDisplay match={createMatch({ status })} />);
      const badge = screen.getByTestId('live-badge');
      const marke = { breite: badge.style.width, wort: badge.textContent };
      unmount();
      return marke;
    });
    expect(marken.map((m) => m.wort)).toEqual(['Live', 'Pause', 'Ende']);
    expect(new Set(marken.map((m) => m.breite)).size).toBe(1);
    expect(marken[0].breite).toBe(L.badgeWidth);
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
