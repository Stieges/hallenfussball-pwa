/**
 * @HE-113 (`2026-09-24_helfer-am-turniertag.md`): „Ein Handy ohne Konto bietet nichts an, was nur die Turnierleitung darf“ --
 * Zeilen „Gefahrenbereich“, „Sicherung wiederherstellen“ und „lädt die Rolle noch“. Die Rolle kommt über die echte Kette
 * useCan -> Rechtematrix (nur `useMyTournamentRole` ist ersetzt), nie über eine nachgebaute Prüfung.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.unmock('i18next');
vi.unmock('react-i18next');
const role = vi.hoisted((): { current: string | null; loading: boolean; unknown: boolean } => ({ current: 'helper', loading: false, unknown: false }));
vi.mock('../../../../auth/hooks/useMyTournamentRole', () => ({
  useMyTournamentRole: () => ({ role: role.current, isLoading: role.loading, ...(role.unknown ? { isUnknown: true } : {}) }),
}));

import { initRealDeI18n } from '../../../../../test/realDeI18n';
import { ToastProvider } from '../../../../../components/ui/Toast';
import { AuthContext } from '../../../../auth/context/authContextInstance';
import type { AuthContextValue } from '../../../../auth/context/authContextValue';
import { DangerZoneCategory } from '../index';
import { ExportsCategory } from '../../Exports';
import { scheduleTournament } from '../../../../../test/scheduleEngineHarness';
import type { Tournament } from '../../../../../types/tournament';

await initRealDeI18n();

const HINT = 'Ändern nur durch die Turnierleitung';
const tournament: Tournament = scheduleTournament();

/** Sitzungsart: anonym (Helfer-Handy) oder Konto; ohne Angabe wie ein lokaler Gast ohne Kontext. */
const session = { anonymous: undefined as boolean | undefined };
function mitSitzung(inhalt: ReactNode) {
  return session.anonymous === undefined ? inhalt : <AuthContext.Provider value={{ isAnonymous: session.anonymous } as AuthContextValue}>{inhalt}</AuthContext.Provider>;
}
function renderDanger() {
  render(mitSitzung(<ToastProvider><DangerZoneCategory tournamentId={tournament.id} tournament={tournament} onTournamentUpdate={vi.fn()} onLocalTournamentUpdate={vi.fn()} /></ToastProvider>));
}
function renderExports() {
  render(mitSitzung(<ToastProvider><ExportsCategory tournamentId={tournament.id} tournament={tournament} onTournamentUpdate={vi.fn()} onMatchesUpdate={vi.fn()} /></ToastProvider>));
}

beforeEach(() => { role.current = 'helper'; role.loading = false; role.unknown = false; session.anonymous = undefined; localStorage.clear(); });

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

describe('@HE-113 Rolle unbekannt (Prüfung scheitert, auf diesem Gerät nie gelernt): die Turnierleitung verliert den Notfall-Weg nicht', () => {
  beforeEach(() => { role.current = null; role.unknown = true; });

  it('@HE-113 Konto + Rolle unbekannt: Gefahrenbereich zeigt die Karte', () => {
    session.anonymous = false;
    renderDanger();
    expect(screen.getByRole('button', { name: 'Spielplan zurücksetzen' })).toBeInTheDocument();
    expect(screen.queryByText(HINT)).not.toBeInTheDocument();
  });

  it('@HE-113 Konto + Rolle unbekannt: „Backup wiederherstellen“ bleibt sichtbar', () => {
    session.anonymous = false;
    renderExports();
    expect(screen.getByText('Backup wiederherstellen')).toBeInTheDocument();
  });

  it('@HE-113 anonym + Rolle unbekannt: Hinweis, nie der Inhalt (Gefahrenbereich und Exporte)', () => {
    session.anonymous = true;
    renderDanger();
    expect(screen.getByTestId('right-slot-hint')).toHaveTextContent(HINT);
    expect(screen.queryByRole('button', { name: 'Spielplan zurücksetzen' })).not.toBeInTheDocument();
    renderExports();
    expect(screen.queryByText('Backup wiederherstellen')).not.toBeInTheDocument();
  });
});

describe('@HE-113 Konto: Rolle lädt oder ist als Helfer bestätigt', () => {
  beforeEach(() => { session.anonymous = false; });

  it('@HE-113 Konto + Rolle lädt: Platzhalter statt Hinweis und Inhalt', () => {
    role.current = null; role.loading = true;
    renderDanger();
    expect(screen.getByTestId('right-slot-loading')).toBeInTheDocument();
    expect(screen.queryByText(HINT)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Spielplan zurücksetzen' })).not.toBeInTheDocument();
  });

  it.each(['helper', 'collaborator'])('@HE-113 Konto + Rolle bestätigt %s: Hinweis, kein Inhalt', (r) => {
    role.current = r;
    renderDanger();
    expect(screen.getByTestId('right-slot-hint')).toHaveTextContent(HINT);
    expect(screen.queryByRole('button', { name: 'Spielplan zurücksetzen' })).not.toBeInTheDocument();
  });
});

describe('@HE-113 Gefahrenbereich: der Warnkasten steht nur, wenn eine Aktion angeboten wird', () => {
  it('@HE-113 Helfer: nur Überschrift und Hinweis, kein „Vorsicht!“', () => {
    role.current = 'helper';
    renderDanger();
    expect(screen.queryByText(/Vorsicht!/)).not.toBeInTheDocument();
    expect(screen.getByTestId('right-slot-hint')).toBeInTheDocument();
  });

  it.each(['owner', 'co-admin'])('@HE-113 %s: Warnkasten wie bisher', (r) => {
    role.current = r;
    renderDanger();
    expect(screen.getByText(/Vorsicht!/)).toBeInTheDocument();
  });
});
