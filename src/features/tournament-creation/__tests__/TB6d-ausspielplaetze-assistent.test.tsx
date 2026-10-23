/**
 * Paket TB-B, Task TB-6d/TB-6d' (Assistent, Schritt „Tabellenregeln“): vier Kriterien in BFV-Reihenfolge, feste letzte Zeile
 * „danach: Strafstoßschießen (Entscheidung der Turnierleitung)“ ohne Schalter (@W2A-056, @W2A-046), und die Auswahl „Diese
 * Plätze müssen bei Gleichstand ausgespielt werden“ (@W2A-066, @W2A-073): vorbelegt nur Platz 1, nur vorhandene Plätze,
 * jeder Platz an- und abhakbar, die Einstellung landet im gespeicherten Turnier. Echter Bedienweg: `useTournamentWizard` →
 * `Step2_ModeAndSystem` → `mapTournamentToSupabase`. Regel T2-UI; Bild gegen Mockup v3 in der Playwright-Spec.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import { useTournamentWizard } from '../../../hooks/useTournamentWizard';
import { Step2_ModeAndSystem } from '../Step2_ModeAndSystem';
import { mapTournamentToSupabase } from '../../../core/repositories/supabaseMappers';
import { defaultPlacementLogic } from '../../../core/standings/placementDefaults';
import { hydrateTournament } from '../../../core/repositories/hydration';
import type { Tournament } from '../../../types/tournament';
import { ToastProvider } from '../../../components/ui/Toast/ToastContext';
import { i18nWrapper } from '../../tournament-management/standings/__tests__/tieTestKit';

vi.unmock('i18next');
vi.unmock('react-i18next');

vi.mock('../../../hooks/useRepository', () => ({
  useRepository: () => ({
    get: vi.fn(() => Promise.resolve(null)),
    getAll: vi.fn(() => Promise.resolve([])),
    save: vi.fn(() => Promise.resolve()),
    delete: vi.fn(() => Promise.resolve()),
  }),
}));

const entwurf = (over: Partial<Tournament> = {}): Tournament => ({
  id: 'turnier-tb6d',
  title: 'Nikolausturnier',
  date: '2030-01-01',
  location: { name: 'Halle' },
  numberOfTeams: 6,
  numberOfGroups: 1,
  mode: 'classic',
  placementLogic: defaultPlacementLogic(),
  groupSystem: 'roundRobin',
  teams: [],
  matches: [],
  status: 'draft',
  lastVisitedStep: 3,
  ...over,
}) as unknown as Tournament;

async function zeigeSchritt(tournament: Tournament) {
  const Wrapper = await i18nWrapper('de');
  const wizard = renderHook(() => useTournamentWizard(tournament));
  const props = () => ({
    formData: wizard.result.current.formData,
    onUpdate: wizard.result.current.updateForm,
    onMovePlacementLogic: wizard.result.current.movePlacementLogic,
    onTogglePlacementLogic: wizard.result.current.togglePlacementLogic,
    onReorderPlacementLogic: wizard.result.current.reorderPlacementLogic,
  });
  const view = render(<Wrapper><ToastProvider><Step2_ModeAndSystem {...props()} /></ToastProvider></Wrapper>);
  const sync = () => view.rerender(<Wrapper><ToastProvider><Step2_ModeAndSystem {...props()} /></ToastProvider></Wrapper>);
  fireEvent.click(screen.getByRole('button', { name: /Tabellenregeln/ })); // Abschnitt öffnen (zugeklappt)
  return { wizard, sync };
}

describe('Assistent: Reihenfolge bei Punktgleichheit mit fester letzter Zeile (@W2A-046, @W2A-056)', () => {
  it('@W2A-056 vier Kriterien in BFV-Reihenfolge, alle aktiv; die Zeile „danach: Strafstoßschießen …“ steht außerhalb der Liste und hat keinen Schalter', async () => {
    await zeigeSchritt(entwurf());
    const list = screen.getByRole('list', { name: 'Platzierungskriterien, sortierbar' });
    const items = within(list).getAllByRole('listitem');
    expect(items.map((li) => (li.getAttribute('aria-label') ?? '').replace(/, Position.*$/, ''))).toEqual(['Punkte', 'Direkter Vergleich', 'Tordifferenz', 'Erzielte Tore']);
    expect(screen.getAllByRole('button', { name: 'Kriterium deaktivieren' })).toHaveLength(4); // alle aktiv, die feste Zeile zählt nicht
    const after = screen.getByTestId('placement-after-row');
    expect(after).toHaveTextContent('danach: Strafstoßschießen (Entscheidung der Turnierleitung)');
    expect(list.contains(after)).toBe(false); // nicht in der sortierbaren Liste (die Zählung der Kriterien bleibt 4)
    expect(within(after).queryByRole('button')).toBeNull(); // kein Schalter, nicht abschaltbar
    expect(within(after).queryByRole('switch')).toBeNull();
  });

  it('@W2A-056 nach dem Umstellen („Direkter Vergleich“ nach unten) steht die feste Zeile weiter hinter der Liste und die Liste hat weiter genau 4 Einträge', async () => {
    const { wizard, sync } = await zeigeSchritt(entwurf());
    act(() => { wizard.result.current.movePlacementLogic(1, 1); });
    act(() => { wizard.result.current.movePlacementLogic(2, 1); });
    sync();
    const list = screen.getByRole('list', { name: 'Platzierungskriterien, sortierbar' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(4);
    const labels = within(list).getAllByRole('listitem').map((li) => (li.getAttribute('aria-label') ?? '').replace(/, Position.*$/, ''));
    expect(labels.indexOf('Direkter Vergleich')).toBe(3); // wirklich umgestellt
    const after = screen.getByTestId('placement-after-row');
    expect(after.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy(); // die feste Zeile folgt der Liste
  });

  it('der Hilfetext zum direkten Vergleich nennt die Sondertabelle bei drei und mehr Teams', async () => {
    await zeigeSchritt(entwurf());
    expect(screen.getByText('Bei drei und mehr Teams eine Sondertabelle aus ihren Spielen untereinander.')).toBeInTheDocument();
    expect(screen.getByText(/Vorbelegt nach den BFV-Regeln für private Hallenturniere/)).toBeInTheDocument();
  });
});

describe('Assistent: Auswahl der auszuspielenden Plätze (@W2A-066, @W2A-073)', () => {
  it('@W2A-066 Nikolaus (6 Teams): Platz 1 bis 6 zur Auswahl, nur Platz 1 angehakt, die Zeile nennt die Wirkung', async () => {
    await zeigeSchritt(entwurf());
    const picker = screen.getByTestId('playout-places');
    expect(within(picker).getAllByRole('checkbox')).toHaveLength(6);
    expect(screen.getByTestId('playout-place-1')).toBeChecked();
    for (const place of [2, 3, 4, 5, 6]) {
      expect(screen.getByTestId(`playout-place-${String(place)}`)).not.toBeChecked();
    }
    expect(screen.getByTestId('playout-summary')).toHaveTextContent('Gleichstand auf Platz 1: Strafstoßschießen nötig. Auf Platz 2 bis 6 darf die Turnierleitung den Platz teilen.') // Wortlaut „Platz teilen“ (Daniel 23.10.);
  });

  it('@W2A-066 Platz 3 anhaken: die Einstellung wird [1, 3], die Zeile nennt beide Bereiche; Platz 1 abhaken: nur Platz 3', async () => {
    const { wizard, sync } = await zeigeSchritt(entwurf());
    fireEvent.click(screen.getByTestId('playout-place-3'));
    sync();
    expect(wizard.result.current.formData.placementsToPlayOut).toEqual([1, 3]);
    expect(screen.getByTestId('playout-summary')).toHaveTextContent('Gleichstand auf Platz 1 und Platz 3: Strafstoßschießen nötig. Auf Platz 2 und Platz 4 bis 6 darf');
    fireEvent.click(screen.getByTestId('playout-place-1'));
    sync();
    expect(wizard.result.current.formData.placementsToPlayOut).toEqual([3]);
    expect(screen.getByTestId('playout-place-1')).not.toBeChecked(); // auch Platz 1 ist abwählbar
  });

  it('@W2A-066 alle Plätze abgehakt: „Kein Platz ist eingestellt …“; alle angehakt: „Alle Plätze sind eingestellt …“', async () => {
    const { wizard, sync } = await zeigeSchritt(entwurf());
    fireEvent.click(screen.getByTestId('playout-place-1'));
    sync();
    expect(wizard.result.current.formData.placementsToPlayOut).toEqual([]);
    expect(screen.getByTestId('playout-summary')).toHaveTextContent('Kein Platz ist eingestellt');
    for (const place of [1, 2, 3, 4, 5, 6]) {
      fireEvent.click(screen.getByTestId(`playout-place-${String(place)}`));
      sync();
    }
    expect(screen.getByTestId('playout-summary')).toHaveTextContent('Alle Plätze sind eingestellt');
  });

  it('@W2A-073 mit 5 Teams nur Platz 1 bis 5; Gegenbeispiel: 6 Teams bieten Platz 6 an; die gespeicherte Auswahl [1, 6] bleibt, wird aber nicht angezeigt', async () => {
    await zeigeSchritt(entwurf({ numberOfTeams: 5 }));
    expect(screen.getAllByRole('checkbox', { name: /^Platz/ })).toHaveLength(5);
    expect(screen.queryByTestId('playout-place-6')).toBeNull();
  });

  it('@W2A-073 Gruppen mit Finalrunde: 8 Teams in 2 Gruppen bieten Platz 1 bis 4 an', async () => {
    await zeigeSchritt(entwurf({ numberOfTeams: 8, numberOfGroups: 2, groupSystem: 'groupsAndFinals' }));
    expect(screen.getByTestId('playout-places')).toBeInTheDocument();
    expect(within(screen.getByTestId('playout-places')).getAllByRole('checkbox')).toHaveLength(4);
  });

  it('@W2A-066 Die Einstellung kommt im gespeicherten Turnier an (Cloud-config) und überlebt das Lesen; fehlt sie, gilt nur Platz 1', async () => {
    const { wizard, sync } = await zeigeSchritt(entwurf());
    fireEvent.click(screen.getByTestId('playout-place-2'));
    sync();
    const gespeichert = { ...wizard.result.current.formData, id: 'turnier-tb6d', teams: [], matches: [] } as Tournament;
    const { tournamentRow } = mapTournamentToSupabase(gespeichert, 'owner-1');
    expect((tournamentRow.config as { placementsToPlayOut?: number[] }).placementsToPlayOut).toEqual([1, 2]);
    // Gegenbeispiel: ohne die Einstellung liest ein Turnier nur Platz 1
    expect(hydrateTournament({ ...gespeichert, placementsToPlayOut: undefined }).placementsToPlayOut).toEqual([1]);
  });
});
