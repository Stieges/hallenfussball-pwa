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
  it.each([['areas/LegacyMatchHeader.tsx'], ['areas/LegacyPlayArea.tsx'], ['areas/CockpitOverlays.tsx']])(
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

  it('dieselben Bedienelemente wie vorher sind da (Tor je Team, Status, Uhr)', () => {
    render(<LiveCockpit {...makeProps(makeLiveMatch())} />);
    expect(screen.getByTestId('goal-button-home')).toBeInTheDocument();
    expect(screen.getByTestId('goal-button-away')).toBeInTheDocument();
    expect(screen.getByTestId('match-status-badge')).toHaveTextContent(/läuft/i);
    expect(screen.getByTestId('match-timer-display')).toBeInTheDocument();
  });

  it('Gegenbeispiel: ohne Spiel steht weiter der Leerhinweis und kein Tor-Knopf', () => {
    render(<LiveCockpit {...makeProps(null)} />);
    expect(screen.queryByTestId('goal-button-home')).toBeNull();
    expect(screen.getByText('Kein Spiel ausgewählt')).toBeInTheDocument(); // über i18n `leer.keinSpielGewaehlt`
  });
});
