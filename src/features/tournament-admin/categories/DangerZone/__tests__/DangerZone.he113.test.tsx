/**
 * @HE-113 (`2026-09-24_helfer-am-turniertag.md`): „Ein Handy ohne Konto bietet nichts an, was nur die Turnierleitung darf“ --
 * Zeilen „Gefahrenbereich“, „Sicherung wiederherstellen“ und „lädt die Rolle noch“. Die Rolle kommt über die echte Kette
 * useCan -> Rechtematrix (nur `useMyTournamentRole` ist ersetzt), nie über eine nachgebaute Prüfung.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.unmock('i18next');
vi.unmock('react-i18next');
const role = vi.hoisted((): { current: string | null; loading: boolean } => ({ current: 'helper', loading: false }));
vi.mock('../../../../auth/hooks/useMyTournamentRole', () => ({
  useMyTournamentRole: () => ({ role: role.current, isLoading: role.loading }),
}));

import { initRealDeI18n } from '../../../../../test/realDeI18n';
import { ToastProvider } from '../../../../../components/ui/Toast';
import { DangerZoneCategory } from '../index';
import { ExportsCategory } from '../../Exports';
import { scheduleTournament } from '../../../../../test/scheduleEngineHarness';
import type { Tournament } from '../../../../../types/tournament';

await initRealDeI18n();

const HINT = 'Ändern nur durch die Turnierleitung';
const tournament: Tournament = scheduleTournament();

function renderDanger() {
  render(<ToastProvider><DangerZoneCategory tournamentId={tournament.id} tournament={tournament} onTournamentUpdate={vi.fn()} onLocalTournamentUpdate={vi.fn()} /></ToastProvider>);
}
function renderExports() {
  render(<ToastProvider><ExportsCategory tournamentId={tournament.id} tournament={tournament} onTournamentUpdate={vi.fn()} onMatchesUpdate={vi.fn()} /></ToastProvider>);
}

beforeEach(() => { role.current = 'helper'; role.loading = false; localStorage.clear(); });

describe('@HE-113 Gefahrenbereich: „Spielplan zurücksetzen“ nur mit Recht leadMatches', () => {
  it.each(['helper', 'collaborator'])('@HE-113 %s liest „Ändern nur durch die Turnierleitung“ statt der Taste', (r) => {
    role.current = r;
    renderDanger();
    expect(screen.getByTestId('right-slot-hint')).toHaveTextContent(HINT);
    expect(screen.queryByRole('button', { name: 'Spielplan zurücksetzen' })).not.toBeInTheDocument();
  });

  it.each(['owner', 'co-admin'])('@HE-113 %s sieht die Taste wie bisher, ohne Hinweis', (r) => {
    role.current = r;
    renderDanger();
    expect(screen.getByRole('button', { name: 'Spielplan zurücksetzen' })).toBeInTheDocument();
    expect(screen.queryByText(HINT)).not.toBeInTheDocument();
  });

  it('@HE-113 „Turnier löschen“ bleibt für den Eigentümer unverändert (nur vor dem ersten Anpfiff)', () => {
    role.current = 'owner';
    renderDanger();
    expect(screen.getByTestId('danger-zone-delete')).toBeInTheDocument();
  });

  it('@HE-113 lädt die Rolle noch, steht ein Platzhalter und nicht der Hinweis', () => {
    role.current = null; role.loading = true;
    renderDanger();
    expect(screen.getByTestId('right-slot-loading')).toBeInTheDocument();
    expect(screen.queryByText(HINT)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Spielplan zurücksetzen' })).not.toBeInTheDocument();
  });
});

describe('@HE-113 Exportieren: „Sicherung wiederherstellen“ nur mit Recht tournamentSettings', () => {
  it.each(['helper', 'collaborator'])('@HE-113 %s findet kein „Backup wiederherstellen“ (Sicherung wiederherstellen), dafür den Hinweis; die Sicherung laden bleibt', (r) => {
    role.current = r;
    renderExports();
    expect(screen.queryByText('Backup wiederherstellen')).not.toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).toBeNull();
    expect(screen.getByTestId('right-slot-hint')).toHaveTextContent(HINT);
  });

  it.each(['owner', 'co-admin'])('@HE-113 %s sieht „Sicherung wiederherstellen“ wie bisher', (r) => {
    role.current = r;
    renderExports();
    expect(screen.getByText('Backup wiederherstellen')).toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).not.toBeNull();
  });

  it('@HE-113 lädt die Rolle noch, steht ein Platzhalter und nicht der Hinweis', () => {
    role.current = null; role.loading = true;
    renderExports();
    expect(screen.getByTestId('right-slot-loading')).toBeInTheDocument();
    expect(screen.queryByText(HINT)).not.toBeInTheDocument();
  });
});
