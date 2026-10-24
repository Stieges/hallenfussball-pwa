/**
 * B3 – Rückfragen und Hinweise im Dialog der App, nie als Fenster des Browsers.
 * Szenarien: docs/anforderungen/2026-10-02_oberflaeche.md @OB-017 (Beispiele je Stelle), @OB-014 (Fokus bei Gefahr),
 * @OB-073 (Team umbenennen fragt nicht nach). Befund C-WINDOW-CONFIRM.
 * Die drei Beispielzeilen aus @OB-017 prüft B03.platzhalterListe.ob017.test.tsx; hier die übrigen ersetzten Stellen
 * und der Wächter über den ganzen Produktcode.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { Match, Tournament } from '../types/tournament';
import type { ScheduledMatch } from '../core/generators';
import { looseVs } from '../test/matchSlotFixtures';
import { ToastProvider } from '../components/ui/Toast';

vi.mock('../features/auth/hooks/useCan', () => ({ useCan: () => true }));
// LocationForm zieht Ort-Vorschläge aus useTournaments (RepositoryContext) – hier ohne Turniere
vi.mock('../hooks/useTournaments', () => ({ useTournaments: () => ({ tournaments: [], loading: false, saveTournament: vi.fn() }) }));
// localStorage ist in der Testumgebung ersetzt: die Einwilligung kommt aus dem Modul
vi.mock('../lib/consent', async (orig) => ({
  ...(await orig<typeof import('../lib/consent')>()),
  getConsentStatus: () => ({ errorTracking: true, sessionReplay: false, timestamp: 1, version: 1 }),
  revokeConsent: vi.fn(),
}));
vi.mock('../features/auth/hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: false }) }));
vi.mock('../features/auth/hooks/useTournamentMembers', () => ({ useTournamentMembers: () => ({ myMembership: null, isLoading: false }) }));

import { TeamsTab } from '../features/tournament-management/TeamsTab';
import { SettingsTab } from '../features/tournament-management/SettingsTab';
import { MetadataCategory } from '../features/tournament-admin/categories/Metadata';
import { SettingsScreen } from '../features/settings/components/SettingsScreen';
import { RefereeAssignmentEditor } from '../components/RefereeAssignmentEditor';

let browserConfirm: ReturnType<typeof vi.spyOn>;
let browserAlert: ReturnType<typeof vi.spyOn>;
let browserPrompt: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  browserConfirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
  browserAlert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
  browserPrompt = vi.spyOn(window, 'prompt').mockReturnValue(null);
});
afterEach(() => vi.restoreAllMocks());

/** Kein Fenster des Browsers hat sich geöffnet. */
function expectKeinBrowserFenster() {
  expect(browserConfirm).not.toHaveBeenCalled();
  expect(browserAlert).not.toHaveBeenCalled();
  expect(browserPrompt).not.toHaveBeenCalled();
}

function tournamentWith(teams: Array<{ id: string; name: string; isRemoved?: boolean }>, matches: Array<Partial<Match> & { id: string }> = []): Tournament {
  return {
    id: 't1', title: 'Wintercup', status: 'published', date: '2030-03-01', timeSlot: '10:00',
    location: { name: 'Halle Süd', city: 'Musterstadt' }, teams, matches,
  } as unknown as Tournament;
}

describe('@OB-017 Wächter: im Produktcode steht kein Fenster des Browsers mehr', () => {
  const SRC = join(__dirname, '..');
  const isTest = (p: string) => /(\.test\.|\.spec\.)/.test(p) || /(^|\/)(__tests__|test)\//.test(p);
  function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) { walk(full, out); continue; }
      const rel = relative(SRC, full);
      if (/\.(ts|tsx)$/.test(name) && !isTest(rel)) { out.push(full); }
    }
    return out;
  }
  /** Kommentare entfernen, damit Hinweise wie „statt window.confirm“ nicht anschlagen. */
  const ohneKommentare = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

  it('kein window.confirm|alert|prompt und kein loses confirm(/alert(/prompt( in src/ (ohne Tests)', () => {
    const treffer: string[] = [];
    for (const file of walk(SRC)) {
      const code = ohneKommentare(readFileSync(file, 'utf8'));
      const lokalesConfirm = /(const|let|function)\s+confirm\b/.test(code);
      const muster = [/\b(window|globalThis|self)\.(confirm|alert|prompt)\b/, /(^|[^\w.$])(alert|prompt)\(/, lokalesConfirm ? null : /(^|[^\w.$])confirm\(/];
      for (const m of muster) { if (m?.test(code)) { treffer.push(`${relative(SRC, file)}: ${m}`); } }
    }
    expect(treffer).toEqual([]);
  });
});

describe('@OB-017 Dialog der App statt Browser-Fenster – ersetzte Stellen', () => {
  it('Team wiederherstellen (TeamsTab) fragt im Dialog der App nach', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(<TeamsTab tournament={tournamentWith([{ id: 'alt', name: 'Alt FC', isRemoved: true }])} onTournamentUpdate={onUpdate} />);

    await user.click(screen.getByRole('button', { name: /teams\.restore/ }));

    expect(await screen.findByTestId('confirm-dialog-confirm')).toBeInTheDocument();
    expect(onUpdate).not.toHaveBeenCalled();
    expectKeinBrowserFenster();
  });

  it('Einstellungen: Zurücksetzen mit Änderungen fragt im Dialog der App nach, „Abbrechen“ behält die Änderung', async () => {
    const user = userEvent.setup();
    render(<SettingsTab tournament={tournamentWith([], [{ id: 'm1', matchStatus: 'scheduled' }])} onTournamentUpdate={vi.fn()} />);
    await user.click(screen.getByText('tournament:settings.editMetadata'));
    const title = screen.getByDisplayValue('Wintercup');
    await user.clear(title);
    await user.type(title, 'Neuer Titel');

    await user.click(screen.getByRole('button', { name: 'tournament:settings.reset' }));
    await user.click(await screen.findByTestId('confirm-dialog-cancel'));

    expect(screen.getByDisplayValue('Neuer Titel')).toBeInTheDocument();
    expectKeinBrowserFenster();
  });

  it('Einstellungen: „Im Wizard bearbeiten“ ist eine gefährliche Rückfrage – Fokus zuerst auf „Abbrechen“ (@OB-014)', async () => {
    const user = userEvent.setup();
    const onEditInWizard = vi.fn();
    render(<SettingsTab tournament={tournamentWith([], [{ id: 'm1', matchStatus: 'scheduled' }])} onTournamentUpdate={vi.fn()} onEditInWizard={onEditInWizard} />);

    await user.click(screen.getByRole('button', { name: /settings\.advancedEditing\.editTeams/ }));

    // Das Fixture gilt als „ungespeichert“: erst kommt die einfache Rückfrage „Zum Wizard wechseln“ (warning) …
    expect(await screen.findByText('tournament:settings.confirmDialog.leaveTitle')).toBeInTheDocument();
    await user.click(screen.getByTestId('confirm-dialog-confirm'));
    // … dann die gefährliche („Spielplan wird neu erzeugt, Ergebnisse gehen verloren“)
    expect(await screen.findByText('tournament:settings.confirmDialog.wizardTitle')).toBeInTheDocument();
    const cancel = screen.getByTestId('confirm-dialog-cancel');
    // Erst nach der Fokusfalle (bei warning springt der Fokus nach 50 ms auf „Bestätigen“) prüfen
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(cancel).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onEditInWizard).not.toHaveBeenCalled();
    expect(screen.getByTestId('confirm-dialog-cancel')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByTestId('confirm-dialog-cancel')).not.toBeInTheDocument());
    expect(onEditInWizard).not.toHaveBeenCalled();
    expectKeinBrowserFenster();
  });

  it('Metadaten (Admin): Zurücksetzen mit Änderungen fragt im Dialog der App nach', async () => {
    const user = userEvent.setup();
    render(<MetadataCategory tournamentId="t1" tournament={tournamentWith([])} onTournamentUpdate={vi.fn()} />);
    const title = screen.getAllByRole('textbox').find((el) => (el as HTMLInputElement).value === 'Wintercup') as HTMLInputElement;
    await user.clear(title);
    await user.type(title, 'Anders');

    await user.click(screen.getByRole('button', { name: 'admin:metadata.reset' }));

    expect(await screen.findByTestId('confirm-dialog-confirm')).toBeInTheDocument();
    expectKeinBrowserFenster();
  });

  const renderSettings = () => render(
    <MemoryRouter><ToastProvider><SettingsScreen onBack={vi.fn()} /></ToastProvider></MemoryRouter>
  );

  it('App-Einstellungen: „App-Update erzwingen“ fragt im Dialog der App nach, „Abbrechen“ tut nichts', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole('button', { name: 'settings:data.forceUpdate.action' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('settings:data.forceUpdate.confirmMessage')).toBeInTheDocument();
    await user.click(screen.getByTestId('confirm-dialog-cancel'));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expectKeinBrowserFenster();
  });

  it('App-Einstellungen: „Einwilligung widerrufen“ fragt im Dialog der App nach und meldet danach in der App', async () => {
    const user = userEvent.setup();
    const { container } = renderSettings();
    container.querySelectorAll('[role="button"][aria-expanded="false"]').forEach((abschnitt) => fireEvent.click(abschnitt));

    await user.click(await screen.findByRole('button', { name: 'settings:privacy.revoke.action' }));
    await user.click(await screen.findByTestId('confirm-dialog-confirm'));

    expect(await screen.findByText('settings:privacy.revoke.successMessage')).toBeInTheDocument();
    expectKeinBrowserFenster();
  });

  it('App-Einstellungen: „Cache leeren“ und „Changelog“ melden in der App, nicht im Browser-Fenster', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole('button', { name: 'settings:data.clearCache.action' }));
    expect(await screen.findByText('settings:data.clearCache.success')).toBeInTheDocument();
    // Der Knopf der Zeile sitzt neben dem Namen; vom Namen nach oben bis zur Zeile mit Knopf
    let zeile: HTMLElement | null = screen.getByText('settings:about.changelog.label');
    while (zeile && !zeile.querySelector('button')) { zeile = zeile.parentElement; }
    await user.click(within(zeile!).getByRole('button'));

    expect(await screen.findByText(/settings:about\.changelog\.content/)).toBeInTheDocument();
    expectKeinBrowserFenster();
  });

  describe('Schiedsrichter-Zeitkonflikt (RefereeAssignmentEditor)', () => {
    const at = (h: number, m: number) => new Date(2030, 2, 1, h, m);
    const spiel = (id: string, matchNumber: number, referee: number | undefined): ScheduledMatch => ({
      id, matchNumber, time: '10:00', field: 1, homeTeam: 'A', awayTeam: 'B', referee,
      startTime: at(10, 0), endTime: at(10, 12),
    } as unknown as ScheduledMatch);
    const config = { mode: 'organizer', numberOfReferees: 2, refereeNames: { 1: 'Tom' } } as never;

    async function waehleSr1FuerSpiel2(onChange: (id: string, ref: number | null) => void) {
      render(<RefereeAssignmentEditor matches={[spiel('m1', 1, 1), spiel('m2', 2, undefined)]} refereeConfig={config} onAssignmentChange={onChange} onResetAssignments={vi.fn()} />);
      fireEvent.click(screen.getByText(/Manuelle Schiedsrichter-Zuweisung/));
      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[1], { target: { value: '1' } });
    }

    it('Konflikt: Rückfrage im Dialog der App; „Trotzdem zuweisen“ weist zu', async () => {
      const onChange = vi.fn();
      await waehleSr1FuerSpiel2(onChange);

      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      expect(onChange).not.toHaveBeenCalled();
      fireEvent.click(screen.getByTestId('confirm-dialog-confirm'));

      await waitFor(() => expect(onChange).toHaveBeenCalledWith('m2', 1));
      expectKeinBrowserFenster();
    });

    it('Gegenbeispiel: „Abbrechen“ weist nicht zu', async () => {
      const onChange = vi.fn();
      await waehleSr1FuerSpiel2(onChange);

      fireEvent.click(await screen.findByTestId('confirm-dialog-cancel'));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(onChange).not.toHaveBeenCalled();
      expectKeinBrowserFenster();
    });
  });
});

describe('@OB-073 Ein Team umbenennen fragt nicht nach, auch wenn es schon gespielt hat', () => {
  it('TSV Petting mit zwei Ergebnissen: Umbenennen speichert sofort, kein Dialog, Ergebnisse und Spiele unverändert', async () => {
    const user = userEvent.setup();
    const matches = [
      { id: 'm1', ...looseVs('petting', 'ufer'), scoreA: 2, scoreB: 1, matchStatus: 'finished' as const },
      { id: 'm2', ...looseVs('ufer', 'petting'), scoreA: 0, scoreB: 0, matchStatus: 'finished' as const },
    ];
    const tournament = tournamentWith([{ id: 'petting', name: 'TSV Petting' }, { id: 'ufer', name: 'VfB Ufer' }], matches);
    const onUpdate = vi.fn();
    render(<TeamsTab tournament={tournament} onTournamentUpdate={onUpdate} />);

    await user.click(screen.getByTestId('team-expand-toggle-petting'));
    await user.click(screen.getByTestId('team-edit-button-petting'));
    const eingabe = screen.getByTestId('team-rename-input-petting');
    await user.clear(eingabe);
    await user.type(eingabe, 'TSV Petting I');
    await user.click(screen.getByTestId('team-rename-save-petting'));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onUpdate).toHaveBeenCalledTimes(1);
    const gespeichert = onUpdate.mock.calls[0][0] as Tournament;
    expect(gespeichert.teams.find((t) => t.id === 'petting')?.name).toBe('TSV Petting I');
    expect(gespeichert.teams.find((t) => t.id === 'ufer')?.name).toBe('VfB Ufer');
    expect(gespeichert.matches).toEqual(matches);
    expectKeinBrowserFenster();
  });
});
