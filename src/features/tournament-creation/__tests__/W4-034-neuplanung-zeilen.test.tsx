/**
 * Fenster „Neuplanung prüfen“ nennt Mannschaften des Veranstalters, Art, Spiel des Vereinsduells und Zahl der Folgen
 * (@W4-034, @W4-048, @W4-050, @W4-049). Echter Plan aus `buildReplanPreview`, echte deutsche Texte.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Team, Tournament } from '../../../types/tournament';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { TournamentCreationService } from '../../../core/services/TournamentCreationService';
import { matchSideTeamId } from '../../../core/models/matchSlot';
import { testUuid } from '../../../test/testIds';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

vi.mock('../../../components/dialogs/Dialog', () => ({
  Dialog: ({ isOpen, title, children }: { isOpen: boolean; title: string; children: React.ReactNode }) =>
    isOpen ? <div role="dialog" aria-label={title}>{children}</div> : null,
}));

import { ReplanPanel } from '../components/ReplanPanel';
import { buildReplanPreview } from '../utils/replan';

const NAMES = ['TSV Petting', 'SV Kirchanschöring', 'TSV Palling', 'DJK Otting', 'TSV Waging 1', 'TSV Waging 2'];
const TEAMS: Team[] = NAMES.map((name, i) => ({ id: testUuid(i + 1), name }));
const [W1, W2] = [TEAMS[4].id, TEAMS[5].id];

function turnier(overrides: Partial<Tournament>): Tournament {
  return new TournamentCreationService({} as never).createDraft({
    title: 'G-Jugend', ageClass: 'G', teams: TEAMS, numberOfTeams: 6, numberOfFields: 1, groupSystem: 'roundRobin',
    date: '2026-11-28', startTime: '10:00', groupPhaseGameDuration: 10, groupPhaseBreakDuration: 2, location: { name: 'Halle' },
    status: 'published', publishedAt: '2026-11-15T10:00:00Z', ...overrides,
  });
}

function oeffne(t: Tournament): void {
  const preview = buildReplanPreview(t);
  if (preview.status !== 'preview') { throw new Error('keine Vorschau'); }
  render(
    <ReplanPanel
      isOpen preview={preview} previousMatches={[]} teams={t.teams} onConfirm={vi.fn()} onCancel={vi.fn()}
      hostInput={{ teams: t.teams, hostTeamIds: t.hostTeamIds, openingMode: t.openingMode, groupSystem: t.groupSystem }}
    />,
  );
}

/** Unabhängig gezählt: Nummer des Spiels W1 gegen W2 und Folgen in Spielreihenfolge. */
function messen(t: Tournament): { duel: number; folgen: number } {
  const preview = buildReplanPreview(t);
  if (preview.status !== 'preview') { throw new Error('keine Vorschau'); }
  const reihe = [...preview.schedule.allMatches].sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0) || a.field - b.field)
    .map((m): Array<string | undefined> => [matchSideTeamId(m, 'A'), matchSideTeamId(m, 'B')]);
  const duel = reihe.findIndex((p) => p.includes(W1) && p.includes(W2)) + 1;
  let folgen = 0;
  const nur = (p: Array<string | undefined>, id: string, anderer: string): boolean => p.includes(id) && !p.includes(anderer);
  for (let i = 0; i + 1 < reihe.length; i++) {
    if ((nur(reihe[i], W1, W2) && nur(reihe[i + 1], W2, W1)) || (nur(reihe[i], W2, W1) && nur(reihe[i + 1], W1, W2))) { folgen++; }
  }
  return { duel, folgen };
}

describe('@W4-034 @W4-048 @W4-050 Fenster „Neuplanung prüfen“ nennt die Angaben zu den Mannschaften des Veranstalters', () => {
  it('Mannschaften, Art, Spiel des Vereinsduells und Zahl der Folgen stimmen mit dem Plan überein, der festgelegt wird', () => {
    const t = turnier({ hostTeamIds: [W1, W2], openingMode: 'both-home' });
    oeffne(t);
    const { duel, folgen } = messen(t);

    const box = screen.getByTestId('replan-host');
    expect(box.textContent).toContain('TSV Waging 1, TSV Waging 2');
    expect(screen.getByTestId('host-summary-mode').textContent).toBe('Eröffnung: Beide beginnen als Heim');
    expect(screen.getByTestId('host-summary-duel').textContent).toBe(`Das Vereinsduell ist Spiel ${duel}.`);
    expect(screen.getByTestId('host-summary-follows').textContent).toContain(`${folgen} Mal`);
  });

  it('bei „Vereinsduell eröffnet“ steht die Art, aber keine Duell-Zeile', () => {
    oeffne(turnier({ hostTeamIds: [W1, W2], openingMode: 'club-derby' }));

    expect(screen.getByTestId('host-summary-mode').textContent).toBe('Eröffnung: Vereinsduell eröffnet');
    expect(screen.queryByTestId('host-summary-duel')).toBeNull();
  });

  it('Gegenbeispiel: ohne Markierung gibt es keinen Abschnitt im Fenster', () => {
    oeffne(turnier({}));

    expect(screen.queryByTestId('replan-host')).toBeNull();
  });

  it('Gegenbeispiel: ohne hostInput (Aufrufer ohne Angabe) bleibt das Fenster wie vorher', () => {
    const preview = buildReplanPreview(turnier({ hostTeamIds: [W1, W2] }));
    if (preview.status !== 'preview') { throw new Error('keine Vorschau'); }
    render(<ReplanPanel isOpen preview={preview} previousMatches={[]} teams={TEAMS} onConfirm={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.queryByTestId('replan-host')).toBeNull();
  });
});
