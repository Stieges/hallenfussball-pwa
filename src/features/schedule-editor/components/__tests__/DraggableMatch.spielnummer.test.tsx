/**
 * Spielkarte im Spielplan-Editor der Turnierleitung (Befund C-FINALRUNDE-REIHENFOLGE, erweitert durch
 * C-SPIELNUMMER-FEHLT): beide Halbfinale hießen „Spiel 7“ – die Karte zeigte die Runde statt der Spielnummer.
 * @TM-142: Halbfinale 1 und Halbfinale 2 sind zwei Spiele; @SL-049: Spielnummern gelten wörtlich.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Match, Team } from '../../../../types/tournament';
import { slots, groupRank, testUuid } from '../../../../test/matchSlotFixtures';
import { DraggableMatch } from '../DraggableMatch';

vi.mock('i18next', async () => {
  const actual = await vi.importActual<typeof import('i18next')>('i18next');
  const de = (await import('../../../../i18n/locales/de/tournament.json')).default;
  const instance = actual.default.createInstance();
  await instance.init({ lng: 'de', fallbackLng: false, resources: { de: { tournament: de } }, interpolation: { escapeValue: false } });
  return { default: instance };
});

const teams: Team[] = [];
const halbfinale = (n: 1 | 2, matchNumber: number): Match => ({
  id: testUuid(100 + n), round: 7, field: n, matchStatus: 'scheduled', isFinal: true, phase: 'semifinal',
  label: `${n}. Halbfinale`, matchNumber,
  ...(n === 1 ? slots(groupRank('A', 1), groupRank('B', 2)) : slots(groupRank('B', 1), groupRank('A', 2))),
});

const card = (match: Match) =>
  render(<DraggableMatch match={match} teams={teams} tournament={{ teams }} isEditing={false} draggable={false} />);

describe('Spielplan-Editor: die Karte zeigt die Spielnummer, nicht die Runde', () => {
  it('@TM-142 C-FINALRUNDE-REIHENFOLGE C-SPIELNUMMER-FEHLT: Halbfinale 1 heißt „Spiel 13“, Halbfinale 2 „Spiel 14“ – nicht beide „Spiel 7“', () => {
    const { unmount } = card(halbfinale(1, 13));
    expect(screen.getByText('Spiel 13')).toBeTruthy();
    expect(screen.queryByText('Spiel 7')).toBeNull();
    unmount();

    card(halbfinale(2, 14));
    expect(screen.getByText('Spiel 14')).toBeTruthy();
    expect(screen.queryByText('Spiel 7')).toBeNull();
  });
});
