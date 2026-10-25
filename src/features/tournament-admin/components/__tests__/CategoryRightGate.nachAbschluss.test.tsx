/**
 * R3-3 Admin Center nach dem Abschluss: Metadaten (Name, Datum, Ort, Logo), Einstellungen (Punkteschema, Kindermodus, Felder),
 * Sponsoren und die Cockpit-Regeln sind gesperrt (@LZ-036 Z. 6, @LZ-037 Z. 1–3: „erst nach dem Wiederöffnen“), dafür steht der
 * Hinweis „Das Turnier ist abgeschlossen“ statt „Ändern nur durch die Turnierleitung“. Die Kategorie „Sichtbarkeit“ (öffentliche
 * Ansicht beenden/teilen) und „Team & Helfer“ (Helfer entfernen, Code erneuern) bleiben offen (@LZ-037 Z. 5, 7).
 * Echte Kette useCan -> Rolle (Eigentümer) -> Verzeichnis der abgeschlossenen Turniere. Gegenbeispiel: offen.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.unmock('i18next');
vi.unmock('react-i18next');

vi.mock('../../../auth/hooks/useMyTournamentRole', () => ({
  useMyTournamentRole: () => ({ role: 'owner', isLoading: false }),
}));

import { initRealDeI18n } from '../../../../test/realDeI18n';
import { setTournamentClosed, resetClosedTournaments } from '../../../../core/services/closedTournaments';
import { CategoryRightGate } from '../CategoryRightGate';
import type { AdminCategoryId } from '../../types/admin.types';

await initRealDeI18n();

const LOCKED: AdminCategoryId[] = ['metadata', 'settings', 'sponsors', 'match-cockpit'];
const OPEN: AdminCategoryId[] = ['visibility', 'team-helpers', 'exports', 'dashboard', 'activity-log'];

function renderGate(category: AdminCategoryId) {
  render(<CategoryRightGate category={category} tournamentId="cup"><div data-testid="inhalt">Inhalt</div></CategoryRightGate>);
}

beforeEach(() => resetClosedTournaments());
afterEach(() => resetClosedTournaments());

describe('@LZ-036 @LZ-037 Kategorien des Admin Centers nach dem Abschluss', () => {
  it.each(LOCKED)('abgeschlossen: %s zeigt statt der Bearbeitung den Hinweis „abgeschlossen“', (category) => {
    setTournamentClosed('cup', true);
    renderGate(category);
    expect(screen.queryByTestId('inhalt')).not.toBeInTheDocument();
    expect(screen.getByTestId('tournament-closed-hint')).toHaveTextContent('Das Turnier ist abgeschlossen');
    expect(screen.queryByTestId('lead-only-hint')).not.toBeInTheDocument();
  });

  it.each(OPEN)('abgeschlossen: %s bleibt offen (öffentliche Ansicht, Helfer, Ablage, Übersicht)', (category) => {
    setTournamentClosed('cup', true);
    renderGate(category);
    expect(screen.getByTestId('inhalt')).toBeInTheDocument();
  });

  it.each([...LOCKED, ...OPEN])('Gegenbeispiel: offen – %s zeigt den Inhalt', (category) => {
    renderGate(category);
    expect(screen.getByTestId('inhalt')).toBeInTheDocument();
    expect(screen.queryByTestId('tournament-closed-hint')).not.toBeInTheDocument();
  });
});
