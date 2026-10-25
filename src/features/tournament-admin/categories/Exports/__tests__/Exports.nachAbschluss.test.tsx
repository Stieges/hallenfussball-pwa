/**
 * R3-3 Sicherung wiederherstellen nach dem Abschluss: Die Wiederherstellung überschriebe das abgeschlossene Turnier
 * (volles Speichern, der Server lehnt es mit 55000 ab). @LZ-036 „bietet die App das nicht an“; @LZ-037: nur öffentliche
 * Ansicht und Ablage (Sicherung herunterladen, Drucken) bleiben. Gegenbeispiel: offen -- Dateiauswahl da.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
vi.mock('../../../../auth/hooks/useCan', () => ({ useCan: () => true }));
import { render, screen } from '@testing-library/react';

vi.unmock('i18next');
vi.unmock('react-i18next');

import { initRealDeI18n } from '../../../../../test/realDeI18n';
import { ToastProvider } from '../../../../../components/ui/Toast';
import { MatchEngineContext } from '../../../../match-engine/matchEngineContextInstance';
import { makeScheduleEngine, scheduleTournament, type ScheduleEngine } from '../../../../../test/scheduleEngineHarness';
import { setTournamentClosed, resetClosedTournaments } from '../../../../../core/services/closedTournaments';
import { ExportsCategory } from '../index';

await initRealDeI18n();

let h: ScheduleEngine;
beforeEach(() => { vi.stubGlobal('indexedDB', new IDBFactory()); resetClosedTournaments(); });
afterEach(() => { h.engine.stop(); vi.unstubAllGlobals(); resetClosedTournaments(); });

async function renderExports() {
  h = await makeScheduleEngine();
  const tournament = scheduleTournament({});
  const view = render(
    <ToastProvider>
      <MatchEngineContext.Provider value={h.value}>
        <ExportsCategory tournamentId={tournament.id} tournament={tournament} onTournamentUpdate={vi.fn()} />
      </MatchEngineContext.Provider>
    </ToastProvider>,
  );
  return { tournament, container: view.container };
}

describe('@LZ-036 Sicherung wiederherstellen nach dem Abschluss', () => {
  it('abgeschlossen: keine Dateiauswahl zum Wiederherstellen, dafür der Hinweis „abgeschlossen“', async () => {
    h = await makeScheduleEngine();
    setTournamentClosed(scheduleTournament({}).id, true);
    const { container } = await renderExports();
    expect(container.querySelector('input[type="file"]')).toBeNull();
    expect(screen.getByTestId('tournament-closed-hint')).toHaveTextContent('Das Turnier ist abgeschlossen');
  });

  it('Gegenbeispiel: offen – die Dateiauswahl zum Wiederherstellen ist da, kein Hinweis', async () => {
    const { container } = await renderExports();
    expect(container.querySelector('input[type="file"]')).not.toBeNull();
    expect(screen.queryByTestId('tournament-closed-hint')).not.toBeInTheDocument();
  });
});
