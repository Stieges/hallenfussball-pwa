/**
 * A-04b (MVP-Bauplan, Spur A) – die Spielkarte des Schedule-Editors zeigt die Seiten über `slotLabel`.
 * @TM-015 „Ein unbesetzter Platz zeigt seine Herkunft“ – Ansicht „der Spielplan-Editor der Turnierleitung“.
 *
 * Das Übergangsfeld `teamA/teamB` ist in den Fixtures absichtlich VERALTET (alter Name): Liest die Karte es,
 * erscheint der alte Text (Mutation „Karte liest `match.teamA`“).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import i18next from 'i18next';
import type { Match, Team } from '../../../../types/tournament';
import { vs, slots, groupRank, resultOf, testUuid } from '../../../../test/matchSlotFixtures';
import { DraggableMatch } from '../DraggableMatch';
import { mapMatchFromSupabase } from '../../../../core/repositories/supabaseMappers';
import { createMatchRow } from '../../../../../tests/factories/supabase';

vi.mock('i18next', async () => {
  const actual = await vi.importActual<typeof import('i18next')>('i18next');
  const de = (await import('../../../../i18n/locales/de/tournament.json')).default;
  const en = (await import('../../../../i18n/locales/en/tournament.json')).default;
  const instance = actual.default.createInstance();
  await instance.init({
    lng: 'de',
    fallbackLng: false,
    resources: { de: { tournament: de }, en: { tournament: en } },
    interpolation: { escapeValue: false },
  });
  return { default: instance };
});

const NORD = testUuid(1);
const UFER = testUuid(2);
const SEMI1 = testUuid(101);
const teams: Team[] = [
  { id: NORD, name: 'FC Nord' },
  { id: UFER, name: 'VfB Ufer' },
];

const card = (match: Match, source: Parameters<typeof DraggableMatch>[0]['tournament'] = { teams }) =>
  render(<DraggableMatch match={match} teams={teams} tournament={source} isEditing={false} draggable={false} />);

const base = { id: SEMI1, round: 1, field: 1, matchStatus: 'scheduled' as const };

describe('DraggableMatch – Seiten aus den Slots (A-04b)', () => {
  it('A-04b besetzte Seiten zeigen den aktuellen Teamnamen, nicht das Übergangsfeld', () => {
    card({ ...base, ...vs(NORD, UFER), teamA: 'ALTER NAME HEIM', teamB: 'ALTER NAME GAST' });

    expect(screen.getByText('FC Nord')).toBeTruthy();
    expect(screen.getByText('VfB Ufer')).toBeTruthy();
    expect(screen.queryByText(/ALTER NAME/)).toBeNull();
  });

  it('A-04b Gegenbeispiel: nach dem Umbenennen zeigt die Karte den neuen Namen', () => {
    card({ ...base, ...vs(NORD, UFER) }, { teams: [{ id: NORD, name: 'FC Nordlicht' }, teams[1]] });

    expect(screen.getByText('FC Nordlicht')).toBeTruthy();
    expect(screen.queryByText('FC Nord')).toBeNull();
  });

  it('@TM-015 offene Seiten zeigen ihre Herkunft in der Sprache der Oberfläche (DE) – kein „TBD“', () => {
    const semi = { ...base, ...slots(groupRank('A', 1), groupRank('B', 2)), label: '1. Halbfinale' };
    const final: Match = { ...base, id: testUuid(102), ...slots(resultOf(SEMI1, 'winner'), resultOf(SEMI1, 'loser')) };

    card(final, { teams, matches: [semi, final] });

    expect(i18next.language).toBe('de');
    expect(screen.queryByText('TBD')).toBeNull();
    expect(screen.getByText(/Sieger/)).toBeTruthy();
    expect(screen.getByText(/Verlierer/)).toBeTruthy();
  });

  // Nur der Anzeige-Teil von @TM-027: Cloud-Zeile -> Mapper -> Editor zeigt „FC Nord“. Der Mehrgeräte-Teil
  // („Olli schließt Gruppe A ab, drei Geräte zeigen dieselbe Besetzung“) gehört in den Durchstich (A-23/A-24).
  it('@TM-027 (Anzeige-Teil) eine aufgelöste Cloud-Zeile zeigt im Halbfinale 1 auf der Heimseite „FC Nord“', () => {
    // Gruppe A ist abgeschlossen: die Cloud-Zeile trägt die aufgelöste Seite (Team-ID + Herkunft)
    // Cast nötig: `src/types/supabase.ts` kennt `slot_*_source` erst nach der Regenerierung auf main (Bauplan § 2 Nr. 7).
    const row = createMatchRow({
      id: SEMI1, team_a_id: NORD, slot_a_source: { kind: 'groupRank', group: 'A', rank: 1 },
      team_b_id: UFER, slot_b_source: { kind: 'groupRank', group: 'B', rank: 2 },
    });
    const fromCloud = mapMatchFromSupabase(row);

    card(fromCloud, { teams });

    expect(screen.getAllByText('FC Nord')).toHaveLength(1);
    expect(screen.queryByText('TBD')).toBeNull();
  });
});
