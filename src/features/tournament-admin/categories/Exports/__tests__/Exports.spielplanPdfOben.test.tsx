/**
 * @DR-029 Gegeben das Admin Center · Wenn Olli „Exporte“ öffnet · Dann steht dort oben „Spielplan als PDF“
 * · Und die Beschreibung verspricht nur, was das PDF enthält.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
vi.mock('../../../../auth/hooks/useCan', () => ({ useCan: () => true }));
import { render, screen } from '@testing-library/react';

vi.unmock('i18next');
vi.unmock('react-i18next');

import { initRealDeI18n } from '../../../../../test/realDeI18n';
import { ToastProvider } from '../../../../../components/ui/Toast';
import { scheduleTournament } from '../../../../../test/scheduleEngineHarness';
import { ExportsCategory } from '../index';

await initRealDeI18n();

describe('@DR-029 Exporte: Spielplan als PDF steht oben', () => {
  it('der erste Abschnitt heißt „Spielplan als PDF“, es gibt keine „Turnier-Zusammenfassung“', () => {
    render(
      <ToastProvider>
        <ExportsCategory tournamentId="T" tournament={scheduleTournament({})} onTournamentUpdate={vi.fn()} onMatchesUpdate={vi.fn()} />
      </ToastProvider>,
    );
    const titel = screen.getByText('Spielplan als PDF');
    const anderer = screen.getByText('Spielereignisse exportieren');
    expect(titel.compareDocumentPosition(anderer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText('Turnier-Zusammenfassung')).toBeNull();
    expect(screen.queryByText(/Statistiken/, { selector: 'p' })).toBeNull();
  });
});
