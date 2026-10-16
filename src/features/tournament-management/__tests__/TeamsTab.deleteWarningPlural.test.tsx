/**
 * @W5-009: Der Lösch-Dialog nennt im echten DE-i18n die richtige Anzahl und die richtige Einzahl/Mehrzahl.
 * Team mit 1 Spiel mit halbem Ergebnis + 2 Spielen ohne Ergebnis: „1 Spiel … bleibt erhalten“ und
 * „2 Spiele … werden entfernt“. Gegenbeispiel: genau 1 ungeschütztes Spiel → Einzahl.
 * Gegenprobe (manuell): Plural-Schlüssel entfernen bzw. Analyse auf matchesWithResults umstellen → rot.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Match, Tournament } from '../../../types/tournament';
import { testUuid } from '../../../test/testIds';
import { vs } from '../../../test/matchSlotFixtures';

// Echtes i18n statt der Passthrough-Mocks aus src/test/setup.ts.
vi.unmock('i18next');
vi.unmock('react-i18next');

import i18n from '../../../i18n';
import { TeamsTab } from '../TeamsTab';

const NORD = testUuid(1);
const SUED = testUuid(2);
const OST = testUuid(3);
const WEST = testUuid(4);

function tournamentWith(matches: Match[]): Tournament {
  return {
    id: 't1',
    title: 'Wintercup',
    status: 'published',
    teams: [
      { id: NORD, name: 'FC Nord' },
      { id: SUED, name: 'SV Sued' },
      { id: OST, name: 'TSV Ost' },
      { id: WEST, name: 'SV West' },
    ],
    matches,
  } as unknown as Tournament;
}

const match = (id: string, sides: ReturnType<typeof vs>, extra: Partial<Match> = {}): Match => ({
  id,
  round: 1,
  field: 1,
  ...sides,
  ...extra,
});

async function openLoeschenFuerNord() {
  const user = userEvent.setup();
  render(<TeamsTab tournament={tournamentWith(currentMatches)} onTournamentUpdate={vi.fn()} />);
  await user.click(screen.getByTestId(`team-expand-toggle-${NORD}`));
  await user.click(screen.getAllByRole('button', { name: /Löschen/ })[0]);
  return screen.getByTestId('team-delete-dialog');
}

let currentMatches: Match[] = [];

beforeAll(async () => {
  await i18n.changeLanguage('de');
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TeamsTab – Lösch-Dialog Warnung Einzahl/Mehrzahl (@W5-009)', () => {
  it('1 Spiel mit halbem Ergebnis + 2 Spiele ohne Ergebnis: Anzahl und Mehrzahl stimmen', async () => {
    currentMatches = [
      match('m-half', vs(NORD, SUED), { scoreA: 2 }),
      match('m-p1', vs(NORD, OST)),
      match('m-p2', vs(NORD, WEST)),
    ];
    const dialog = await openLoeschenFuerNord();
    expect(dialog).toHaveTextContent('1 Spiel mit Ergebnis oder Ereignissen bleibt erhalten');
    expect(dialog).toHaveTextContent('2 Spiele ohne Ergebnis und ohne Ereignisse werden entfernt');
  });

  it('Gegenbeispiel: genau 1 ungeschütztes Spiel → Einzahl', async () => {
    currentMatches = [match('m-p1', vs(NORD, SUED))];
    const dialog = await openLoeschenFuerNord();
    expect(dialog).toHaveTextContent('hat ein geplantes Spiel ohne Ergebnis und ohne Ereignisse');
    expect(dialog).toHaveTextContent('Es wird aus dem Spielplan entfernt.');
    expect(dialog).not.toHaveTextContent('Spiele');
  });
});
