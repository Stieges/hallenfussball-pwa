/**
 * App-Ebene der Startseite (useDashboardActions, aus App.tsx herausgelöst).
 * @W1-041 Gescheitertes Speichern beim Import: der Dialog meldet kein „Import erfolgreich“, der Fehler ist sichtbar; Import mit Spielplan
 * wird „Bereit“ (published), ohne Spielplan ein Entwurf mit Schritt 2. @LZ-094 Papierkorb leeren: die Meldung nennt das Turnier mit Namen,
 * die übrigen sind gelöscht. Szenarien: docs/anforderungen/2026-09-27_wizard-einstieg-und-fuehrung.md, 2026-10-01_turnier-lebenszyklus.md.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { Tournament } from '../../types/tournament';

const hoisted = vi.hoisted(() => ({
  showError: vi.fn(),
  parsed: { tournament: undefined as object | undefined, isValid: true, errors: [] as unknown[], warnings: [] as unknown[] },
}));
vi.mock('../../components/ui/Toast', () => ({ useToast: () => ({ showError: hoisted.showError }) }));
// t gibt Schlüssel und Werte zurück, damit die genannten Turnier-Namen sichtbar sind
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, opts?: { names?: string }) => (opts?.names ? `${key}: ${opts.names}` : key) }),
}));
vi.mock('../../lib/sentry', () => ({ captureFeatureError: vi.fn() }));
vi.mock('../../utils/tournamentImporter', () => ({
  detectImportFormat: () => 'json',
  validateAndParseTournamentImport: () => hoisted.parsed,
}));

import { useDashboardActions } from '../useDashboardActions';
import { ImportDialog } from '../../components/dialogs/ImportDialog';

const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter>{children}</MemoryRouter>;
const turnier = (id: string, matches: unknown[]): Tournament =>
  ({ id, title: 'F2-Junioren Hallenturnier', matches, teams: [], externalSource: 'Datei', location: { name: 'Halle' } } as unknown as Tournament);

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.parsed = { tournament: undefined, isValid: true, errors: [], warnings: [] };
});

describe('@W1-041 Import speichern (App-Ebene)', () => {
  it('mit Spielplan wird „Bereit“ (status published) gespeichert', async () => {
    const saveTournament = vi.fn(() => Promise.resolve());
    const { result } = renderHook(() => useDashboardActions({ saveTournament, emptyTrash: vi.fn() }), { wrapper });
    await act(async () => { await result.current.importTournament(turnier('a', [{ id: 'm1' }])); });
    expect(saveTournament).toHaveBeenCalledWith(expect.objectContaining({ id: 'a', status: 'published' }));
  });

  it('ohne Spielplan wird mit Schritt 2 gespeichert, „Weiter“ öffnet den Assistenten bei Schritt 2', async () => {
    const saveTournament = vi.fn(() => Promise.resolve());
    const { result } = renderHook(() => ({ a: useDashboardActions({ saveTournament, emptyTrash: vi.fn() }), ort: useLocation() }), { wrapper });
    await act(async () => { await result.current.a.importTournament(turnier('b', [])); });
    expect(saveTournament).toHaveBeenCalledWith(expect.objectContaining({ id: 'b', lastVisitedStep: 2 }));
    act(() => result.current.a.continueImport(turnier('b', [])));
    expect(result.current.ort.pathname + result.current.ort.search).toBe('/tournament/b/edit?step=2');
  });

  it('Gegenbeispiel: scheitert das Speichern, wirft die Funktion; der Dialog zeigt den Fehler und nie „Import erfolgreich“', async () => {
    hoisted.parsed = { tournament: turnier('c', []), isValid: true, errors: [], warnings: [] };
    const saveTournament = vi.fn(() => Promise.reject(new Error('Speicher voll')));
    function Harness() {
      const actions = useDashboardActions({ saveTournament, emptyTrash: vi.fn() });
      return <ImportDialog isOpen onClose={vi.fn()} onImport={actions.importTournament} onContinue={actions.continueImport} />;
    }
    const user = userEvent.setup();
    render(<Harness />, { wrapper });
    await user.upload(screen.getByTestId('import-file-input'), new File(['{}'], 'f2.json'));
    await user.click(await screen.findByTestId('import-confirm'));
    expect(await screen.findByTestId('import-save-error')).toBeTruthy();
    expect(screen.queryByTestId('import-success-go')).toBeNull();
    expect(saveTournament).toHaveBeenCalledTimes(1);
  });
});

describe('@LZ-094 Papierkorb leeren (App-Ebene)', () => {
  it('alles gelöscht: keine Meldung', async () => {
    const emptyTrash = vi.fn(() => Promise.resolve({ deleted: 2, failed: [] }));
    const { result } = renderHook(() => useDashboardActions({ saveTournament: vi.fn(), emptyTrash }), { wrapper });
    await act(async () => { await result.current.emptyTrashWithReport(); });
    expect(emptyTrash).toHaveBeenCalledTimes(1);
    expect(hoisted.showError).not.toHaveBeenCalled();
  });

  it('lässt sich „Wintercup“ nicht löschen, nennt die Meldung ihn mit Namen', async () => {
    const emptyTrash = vi.fn(() => Promise.resolve({ deleted: 1, failed: [{ id: 'wc', title: 'Wintercup' }] }));
    const { result } = renderHook(() => useDashboardActions({ saveTournament: vi.fn(), emptyTrash }), { wrapper });
    await act(async () => { await result.current.emptyTrashWithReport(); });
    expect(hoisted.showError).toHaveBeenCalledTimes(1);
    expect(String(hoisted.showError.mock.calls[0][0])).toContain('„Wintercup“');
    expect(String(hoisted.showError.mock.calls[0][0])).toContain('errors.emptyTrashFailed');
    expect(String(hoisted.showError.mock.calls[0][0])).not.toContain('Testturnier alt');
  });

  it('mehrere Turniere stehen alle mit Namen in der Meldung', async () => {
    const emptyTrash = vi.fn(() => Promise.resolve({ deleted: 0, failed: [{ id: 'a', title: 'Wintercup' }, { id: 'b', title: 'Testturnier alt' }] }));
    const { result } = renderHook(() => useDashboardActions({ saveTournament: vi.fn(), emptyTrash }), { wrapper });
    await act(async () => { await result.current.emptyTrashWithReport(); });
    const text = String(hoisted.showError.mock.calls[0][0]);
    expect(text).toContain('„Wintercup“');
    expect(text).toContain('„Testturnier alt“');
  });

  it('Gegenbeispiel: wirft emptyTrash selbst, kommt die allgemeine Löschen-Meldung (kein Absturz)', async () => {
    const emptyTrash = vi.fn(() => Promise.reject(new Error('Netz weg')));
    const { result } = renderHook(() => useDashboardActions({ saveTournament: vi.fn(), emptyTrash }), { wrapper });
    await act(async () => { await result.current.emptyTrashWithReport(); });
    expect(hoisted.showError).toHaveBeenCalledWith('errors.deleteTournament');
  });
});
