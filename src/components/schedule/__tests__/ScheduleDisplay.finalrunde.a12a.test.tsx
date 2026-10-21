/**
 * A-12a Gegenbeispiel Impact (Plan GA4 v2 Auflage 15), Admin-Spielplan: Halbfinale tragen `phase: 'semifinal'`
 * (C-FINALPHASE-AUS-ID behoben). Der Spielplan zeigt die Finalrunde trotzdem als EINEN Block in der Reihenfolge
 * HF1, HF2, Platz 3, Finale – frisch erzeugt und nach dem Speichern (gespeicherte Phase).
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.unmock('i18next');
vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../test/realDeI18n';
await initRealDeI18n();

import { generateFullSchedule } from '../../../core/generators';
import type { Match, Team } from '../../../types/tournament';
import { createMockTournament } from '../../../test/factories';
import { testUuid } from '../../../test/testIds';
import { ScheduleDisplay } from '../../ScheduleDisplay';
import { viewOf } from './scheduleViewFixture';

vi.mock('../../../hooks/useLiveMatches', () => ({ useLiveMatches: () => ({ liveMatches: new Map() }) }));

const ORDER = ['1. Halbfinale', '2. Halbfinale', 'Spiel um Platz 3', 'Finale'];
const teams: Team[] = ['A', 'B'].flatMap((group, g) =>
  [1, 2, 3, 4].map((n) => ({ id: testUuid(g * 10 + n), name: `Team ${group}${n}`, group })),
);
const tournament = createMockTournament({
  teams, numberOfTeams: 8, numberOfGroups: 2, numberOfFields: 2, groupSystem: 'groupsAndFinals',
  finalsConfig: { preset: 'top-4' },
});

/** Finalkarten in der Reihenfolge des Dokuments, als Bezeichnung der Spiele. */
function finalCardOrder(container: HTMLElement, matches: readonly { id: string; label?: string }[]): string[] {
  const ids = [...container.querySelectorAll('[data-testid^="final-card-"]')].map((el) =>
    (el.getAttribute('data-testid') ?? '').replace('final-card-', ''));
  return ids.map((id) => matches.find((m) => m.id === id)?.label ?? id);
}

describe('A-12a Admin-Spielplan: Finalrunde als ein Block (Halbfinale in Phase semifinal)', () => {
  it('A-12a frisch erzeugt: HF1, HF2, Platz 3, Finale, Halbfinale tragen semifinal', () => {
    const schedule = generateFullSchedule(tournament);
    const current = schedule.allMatches as unknown as Match[];
    const { container } = render(<ScheduleDisplay schedule={schedule} currentMatches={current} view={viewOf(current, teams)} />);

    expect(schedule.allMatches.filter((m) => m.phase === 'semifinal').map((m) => m.label)).toEqual(ORDER.slice(0, 2));
    expect(finalCardOrder(container, schedule.allMatches)).toEqual(ORDER);
  });

  it('A-12a nach dem Speichern (gespeicherte Phase je Spiel): dieselbe Reihenfolge, ein Block', () => {
    const fresh = generateFullSchedule(tournament);
    const stored: Match[] = fresh.allMatches.map((m, i) => ({
      id: m.id, round: i + 1, field: m.field, slot: m.slot, slotA: m.slotA, slotB: m.slotB, originA: m.originA, originB: m.originB,
      group: m.group, isFinal: m.phase !== 'groupStage', phase: m.phase, finalType: m.finalType, label: m.label,
      matchNumber: m.matchNumber, scheduledTime: m.startTime,
    }));
    const schedule = generateFullSchedule({ ...tournament, matches: stored });
    const { container } = render(<ScheduleDisplay schedule={schedule} currentMatches={stored} view={viewOf(stored, teams)} />);

    expect(schedule.phases.filter((p) => p.name !== 'groupStage')).toHaveLength(1);
    expect(finalCardOrder(container, stored)).toEqual(ORDER);
  });
});
