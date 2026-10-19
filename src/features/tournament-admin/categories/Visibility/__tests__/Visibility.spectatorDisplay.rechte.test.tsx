/**
 * @ZM-019 Wer „Teamfarben in den Ergebniskästen“ und die Standardfarben stellt (Anzeige für Zuschauer):
 * Olli (Turnierleitung/Eigentümer) und Maria (Co-Admin) können es, Tom (Helfer an Feld 1) bietet die App es nicht an.
 * Die Rolle kommt über `useCan('tournamentSettings')` (A-11), nicht über einen eigenen Rechte-Satz.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

vi.unmock('i18next'); vi.unmock('react-i18next');
const rolle = vi.hoisted(() => ({ aktuell: 'owner' }));
vi.mock('../../../../auth/hooks/useMyTournamentRole', () => ({
  useMyTournamentRole: () => ({ role: rolle.aktuell, isLoading: false }),
}));
vi.mock('../../../../../hooks/useRepository', () => ({ useRepository: () => ({}) }));
vi.mock('../../../../../lib/supabase', () => ({ isSupabaseConfigured: true }));

import { initRealDeI18n } from '../../../../../test/realDeI18n';
import { ToastProvider } from '../../../../../components/ui/Toast';
import { VisibilityCategory } from '../index';
import type { Tournament } from '../../../../../types/tournament';

await initRealDeI18n();

const turnier = { id: 'hallencup-nord', title: 'Hallencup Nord', status: 'published', publishedAt: '2026-10-01T10:00:00.000Z', teams: [], matches: [] } as unknown as Tournament;

function zeige() {
  const onUpdate = vi.fn<(t: Tournament) => void>();
  render(
    <ToastProvider>
      <VisibilityCategory tournamentId={turnier.id} tournament={turnier} onTournamentUpdate={onUpdate} />
    </ToastProvider>,
  );
  return onUpdate;
}

beforeEach(() => vi.clearAllMocks());

describe('@ZM-019 Anzeige für Zuschauer: wer die Farben stellt', () => {
  it.each([
    ['Olli', 'owner'],
    ['Maria', 'co-admin'],
  ] as const)('@ZM-019 %s (%s) kann „Teamfarben in den Ergebniskästen“ ausschalten: gelingt es', (_name, role) => {
    rolle.aktuell = role;
    const onUpdate = zeige();
    fireEvent.click(screen.getByRole('switch', { name: /Teamfarben in den Ergebniskästen/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(onUpdate.mock.calls.at(-1)![0].spectatorDisplay?.teamColors).toBe(false);
  });

  it('@ZM-019 Maria (co-admin) kann „Standardfarbe Heim“ ändern: gelingt es', () => {
    rolle.aktuell = 'co-admin';
    const onUpdate = zeige();
    fireEvent.click(within(screen.getByTestId('spectator-display-home-color')).getAllByRole('button')[0]);
    fireEvent.click(screen.getByRole('option', { name: 'Farbe #FACC15' }));
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(onUpdate.mock.calls.at(-1)![0].spectatorDisplay?.homeColor).toBe('#FACC15');
  });

  it('@ZM-019 Tom (collaborator) „Teamfarben in den Ergebniskästen“ ausschalten: bietet die App das nicht an', () => {
    rolle.aktuell = 'collaborator';
    zeige();
    expect(screen.queryByRole('switch', { name: /Teamfarben/ })).toBeNull();
    expect(screen.queryByTestId('spectator-display-home-color')).toBeNull();
    expect(screen.queryByTestId('spectator-display-away-color')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Speichern' })).toBeNull();
    expect(screen.getByTestId('spectator-display-lead-only')).toHaveTextContent('Ändern nur durch die Turnierleitung');
  });

  it('@ZM-019 Gegenbeispiel Tom: die Vorschau bleibt lesbar (nur die Eingaben fehlen)', () => {
    rolle.aktuell = 'collaborator';
    zeige();
    expect(screen.getByTestId('spectator-display-preview')).toBeInTheDocument();
  });
});
