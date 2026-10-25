/**
 * R3-3 Sicherung wiederherstellen nach dem Abschluss: Die Wiederherstellung überschriebe das abgeschlossene Turnier
 * (volles Speichern, der Server lehnt es mit 55000 ab). @LZ-036 „bietet die App das nicht an“; @LZ-037: nur öffentliche
 * Ansicht und Ablage (Sicherung herunterladen, Drucken) bleiben. Gegenbeispiel: offen -- Dateiauswahl da.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// echte Kette useCan -> Rolle -> hasPermission (Review #394 M-2): nur die Rolle ist gemockt
const role = vi.hoisted((): { current: string } => ({ current: 'owner' }));
vi.mock('../../../../auth/hooks/useMyTournamentRole', () => ({ useMyTournamentRole: () => ({ role: role.current, isLoading: false }) }));
// Der PDF-Dialog: hier nur, ob die Aushang-Karte (canCreateNotice) angeboten wird
const dialogProps = vi.hoisted((): { current: Record<string, unknown> } => ({ current: {} }));
vi.mock('../../../../../components/dialogs/PDFExportDialog', () => ({
  PDFExportDialog: (props: Record<string, unknown>) => { dialogProps.current = props; return null; },
}));
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
beforeEach(() => { vi.stubGlobal('indexedDB', new IDBFactory()); resetClosedTournaments(); role.current = 'owner'; dialogProps.current = {}; });
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

  it('@LZ-037 Z. 5 abgeschlossen: der Aushang (QR-Code der öffentlichen Ansicht) bleibt angeboten', async () => {
    h = await makeScheduleEngine();
    setTournamentClosed(scheduleTournament({}).id, true);
    await renderExports();
    expect(dialogProps.current.canCreateNotice).toBe(true);
  });

  it('abgeschlossen, Helfer ohne Recht (@ZM-019): der Aushang bleibt ohne Recht aus', async () => {
    role.current = 'collaborator';
    h = await makeScheduleEngine();
    setTournamentClosed(scheduleTournament({}).id, true);
    await renderExports();
    expect(dialogProps.current.canCreateNotice).toBe(false);
  });

  it('Gegenbeispiel: offen – Olli bietet den Aushang an', async () => {
    await renderExports();
    expect(dialogProps.current.canCreateNotice).toBe(true);
  });
});
