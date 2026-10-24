import { describe, it, expect, vi } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { LiveCockpit } from '../LiveCockpit';
import { makeLiveMatch, makeProps } from './cockpitFixtures';

vi.mock('../../../hooks/useMatchSound', () => ({
  useMatchSound: () => ({ play: vi.fn(), stop: vi.fn(), testPlay: vi.fn(), activate: vi.fn(), isPlaying: false, isLoading: false, isReady: true, isActivated: true, error: null }),
}));
vi.mock('../../../hooks/useSyncStatus', () => ({
  useSyncStatus: () => ({ status: 'synced', isSyncing: false, pendingChanges: 0, failedChanges: 0, failedMutations: [], syncTournament: vi.fn(), retryFailedMutation: vi.fn(), discardFailedMutation: vi.fn(), isCloudSyncAvailable: false }),
}));
vi.mock('../../../hooks/useActorRole', () => ({ useActorRole: () => 'helper' }));
// Echte DE-Texte (Global Constraint „Echte DE-Texte in Tests“): der Leerhinweis kommt über i18n.
vi.unmock('i18next');
vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../test/realDeI18n';
await initRealDeI18n();

const dir = resolve(__dirname, '..');
const lines = (p: string) => readFileSync(resolve(dir, p), 'utf8').split('\n').length;

describe('Cockpit-Hülle – Struktur (Scheibe 1, ohne Sichtänderung)', () => {
  it.each([['areas/ScoreboardArea.tsx'], ['areas/LegacyPlayArea.tsx'], ['areas/CockpitOverlays.tsx']])(
    '%s existiert und hat weniger als 300 Zeilen',
    (file) => {
      expect(existsSync(resolve(dir, file))).toBe(true);
      expect(lines(file)).toBeLessThan(300);
    },
  );

  it('LiveCockpit.tsx enthält keine Inline-Stilobjekte mehr', () => {
    const src = readFileSync(resolve(dir, 'LiveCockpit.tsx'), 'utf8');
    expect(src).not.toMatch(/:\s*CSSProperties\s*=\s*\{/);
  });

  it('dieselben Bedienelemente wie vorher sind da (Tor je Team, Zustand, Uhr)', () => {
    render(<LiveCockpit {...makeProps(makeLiveMatch())} />);
    expect(screen.getByTestId('goal-button-home')).toBeInTheDocument();
    expect(screen.getByTestId('goal-button-away')).toBeInTheDocument();
    expect(screen.getByTestId('scoreboard-state')).toHaveTextContent(/live/i);
    expect(screen.getByTestId('scoreboard-clock')).toBeInTheDocument();
  });

  it('@SL-061 Handy: nur die Tastenfläche scrollt – Tore und Tasten liegen darin, Tafel und Zeile „Nächstes“ stehen außerhalb (fest)', () => {
    const alt = window.innerWidth;
    try {
      window.innerWidth = 360;
      render(<LiveCockpit {...makeProps(makeLiveMatch(), { upcomingMatches: [{ id: 'm12', number: 12, phaseLabel: 'Gruppe', scheduledKickoff: '10:15', fieldId: 'field-1', homeTeam: { id: 'a', name: 'DJK Berg' }, awayTeam: { id: 'b', name: 'TuS Tal' } }] })} />);
      const flaeche = screen.getByTestId('cockpit-tastenflaeche');
      expect(flaeche).toContainElement(screen.getByTestId('goal-button-home'));
      expect(flaeche).toContainElement(screen.getByTestId('goal-button-away'));
      expect(flaeche).not.toContainElement(screen.getByTestId('scoreboard'));
      expect(flaeche).not.toContainElement(screen.getByTestId('cockpit-naechstes'));
      expect(screen.getByTestId('cockpit-naechstes')).toHaveAttribute('data-verborgen', 'true'); // Platz reserviert, Zeile erst ab 3:00
    } finally {
      window.innerWidth = alt;
    }
  });

  it('LiveCockpit.tsx hat höchstens 300 Zeilen (Spec § 1 Nr. 4)', () => {
    expect(lines('LiveCockpit.tsx')).toBeLessThanOrEqual(300);
  });

  it('Gegenbeispiel: ohne Spiel steht weiter der Leerhinweis und kein Tor-Knopf', () => {
    render(<LiveCockpit {...makeProps(null)} />);
    expect(screen.queryByTestId('goal-button-home')).toBeNull();
    expect(screen.getByText('Kein Spiel ausgewählt')).toBeInTheDocument(); // über i18n `leer.keinSpielGewaehlt`
  });
});
