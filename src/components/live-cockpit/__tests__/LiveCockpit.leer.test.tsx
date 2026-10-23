/**
 * Cockpit ohne Spiel (Plan LT-2, Befund C4 aus dem Review Teil 1): Im Zustand „wartet auf Teams“ (Rahmen aktiv, @SL-140) steht die Leiste nur mit
 * „Mehr“, und „Mehr → Einstellungen“ ist erreichbar (Spec § 6, Zeile `wartetAufHerkunft`). „Kein Spiel mehr“ hat keine Leiste und keinen Rahmen:
 * die Einstellungen liegen dann im Reiter „Einstellungen“ der App-Navigation.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { LiveCockpit } from '../LiveCockpit';
import { makeProps } from './cockpitFixtures';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

vi.mock('../../../hooks/useMatchSound', () => ({
  useMatchSound: () => ({ play: vi.fn(), stop: vi.fn(), testPlay: vi.fn(), activate: vi.fn(), isPlaying: false, isLoading: false, isReady: true, isActivated: true, error: null }),
}));
vi.mock('../../../hooks/useSyncStatus', () => ({
  useSyncStatus: () => ({
    status: 'synced', isSyncing: false, pendingChanges: 0, failedChanges: 0, failedMutations: [],
    syncTournament: vi.fn(), retryFailedMutation: vi.fn(), discardFailedMutation: vi.fn(), isCloudSyncAvailable: false,
  }),
}));
vi.mock('../../../hooks/useActorRole', () => ({ useActorRole: () => 'helper' }));

const wartet = { art: 'wartetAufHerkunft' as const, gruende: ['Abschluss von Gruppe B'], paarung: 'FC Nord – Zweiter Gruppe B', spielLabel: 'Halbfinale 1 · Feld 1' };

describe('C4 wartet auf Teams: Leiste nur mit „Mehr“, Einstellungen erreichbar', () => {
  it('@SL-052 die Leiste hat genau einen Knopf „Mehr“, keinen Anpfiff', () => {
    render(<LiveCockpit {...makeProps(null, { leer: wartet })} />);
    const leiste = screen.getByRole('toolbar');
    expect(within(leiste).getAllByRole('button')).toHaveLength(1);
    expect(screen.getByTestId('cockpit-more-button')).toBeInTheDocument();
    expect(screen.queryByTestId('match-start-button')).toBeNull();
  });

  it('Mehr bietet nur „Einstellungen“ (kein Seiten tauschen, keine Uhr) und öffnet den Einstellungs-Dialog', async () => {
    const user = userEvent.setup();
    render(<LiveCockpit {...makeProps(null, { leer: wartet })} />);
    await user.click(screen.getByTestId('cockpit-more-button'));
    const blatt = screen.getByTestId('more-sheet');
    expect(within(blatt).queryByTestId('mehr-seiten-tauschen')).toBeNull();
    expect(within(blatt).queryByTestId('mehr-uhr-korrigieren')).toBeNull();
    await user.click(within(blatt).getByTestId('mehr-einstellungen'));
    expect(screen.getByText('Cockpit Einstellungen')).toBeInTheDocument();
  });

  it('Nur-Lesen: „Mehr“ bleibt (Einstellungen gesperrt sichtbar), keine Werkzeugleiste', async () => {
    const user = userEvent.setup();
    render(<LiveCockpit {...makeProps(null, { leer: wartet, kannSteuern: false })} />);
    expect(screen.queryByRole('toolbar')).toBeNull();
    await user.click(screen.getByTestId('cockpit-more-button'));
    expect(screen.getByTestId('mehr-einstellungen')).toBeInTheDocument();
  });

  it('@SL-054 Gegenbeispiel: „kein Spiel mehr“ hat weder Leiste noch „Mehr“', () => {
    render(<LiveCockpit {...makeProps(null, { leer: { art: 'keinSpiel', feldName: 'Feld 2' } })} />);
    expect(screen.queryByRole('toolbar')).toBeNull();
    expect(screen.queryByTestId('cockpit-more-button')).toBeNull();
  });
});
