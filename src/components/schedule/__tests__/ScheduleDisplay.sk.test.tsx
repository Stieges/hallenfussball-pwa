/**
 * Paket SK, durchgehende Kette: Spielplan (ScheduleDisplay) mit aktuellen Spielen → Karten und Tabellen.
 *  - @OB-064: Verlängerung/Strafstoß/Entscheidung am Spiel (Engine-Zwischenspeicher) erreichen Karte und Tabelle.
 *  - Gegenbeispiel „Gruppenphase bleibt unverändert“: die Gruppenphase trägt keine Eingabefelder der Finalrunden-Karte.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.unmock('i18next');
vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../test/realDeI18n';
await initRealDeI18n();

import { generateFullSchedule } from '../../../core/generators';
import type { Match, Team } from '../../../types/tournament';
import { createMockTournament } from '../../../test/factories';
import { testUuid } from '../../../test/testIds';
import { ScheduleDisplay } from '../../ScheduleDisplay';

vi.mock('../../../hooks/useLiveMatches', () => ({ useLiveMatches: () => ({ liveMatches: new Map() }) }));

const teams: Team[] = ['A', 'B'].flatMap((group, g) =>
  [1, 2, 3, 4].map((n) => ({ id: testUuid(g * 10 + n), name: `Team ${group}${n}`, group })),
);
const schedule = generateFullSchedule(createMockTournament({
  teams, numberOfTeams: 8, numberOfGroups: 2, numberOfFields: 1, groupSystem: 'groupsAndFinals',
  finalsConfig: { preset: 'top-4', tiebreakerByRound: { final: 'overtime-then-shootout', placement: 'shootout' } },
}));
const finals = schedule.phases.filter((p) => p.name !== 'groupStage').flatMap((p) => p.matches);
const groupMatch = schedule.phases.find((p) => p.name === 'groupStage')?.matches[0];
const HF1 = finals[0];

function aktuell(overrides: Record<string, Partial<Match>>): Match[] {
  return schedule.allMatches.map((m) => ({ ...m, ...(overrides[m.id] ?? {}) }) as unknown as Match);
}

describe('@OB-064 durchgehend: Spielplan → Finalrunden-Karte und -Tabelle', () => {
  it('Strafstoßschießen am Spiel: Karte zeigt (4)/(3) und „beendet i. E.“, Tabelle „2:2 (4:3 i. E.)“', () => {
    const currentMatches = aktuell({
      [HF1.id]: { scoreA: 2, scoreB: 2, penaltyScoreA: 4, penaltyScoreB: 3, decidedBy: 'penalty', matchStatus: 'finished' },
    });
    const { container } = render(
      <ScheduleDisplay schedule={schedule} currentMatches={currentMatches} finishedMatches={new Set([HF1.id])} />,
    );
    expect(screen.getByTestId(`final-penalty-${HF1.id}-home`).textContent).toBe('(4)');
    expect(screen.getByTestId(`final-penalty-${HF1.id}-away`).textContent).toBe('(3)');
    expect(screen.getByTestId(`final-decision-${HF1.id}`).textContent).toBe('beendet i. E.');
    expect(container.textContent).toContain('2:2 (4:3 i. E.)');
  });

  it('Verlängerung am Spiel: Tore 3 und 2, „n. V.“, Tabelle „3:2 n. V.“', () => {
    const currentMatches = aktuell({
      [HF1.id]: { scoreA: 2, scoreB: 2, overtimeScoreA: 1, overtimeScoreB: 0, decidedBy: 'overtime', matchStatus: 'finished' },
    });
    const { container } = render(
      <ScheduleDisplay schedule={schedule} currentMatches={currentMatches} finishedMatches={new Set([HF1.id])} />,
    );
    expect(screen.getByTestId(`final-goals-${HF1.id}-home`).textContent).toBe('3');
    expect(screen.getByTestId(`final-decision-${HF1.id}`).textContent).toBe('n. V.');
    expect(container.textContent).toContain('3:2 n. V.');
  });

  it('Gegenbeispiel: ohne Verlängerung und Strafstoß steht beim Finalrunden-Spiel kein Zusatz', () => {
    const currentMatches = aktuell({ [HF1.id]: { scoreA: 1, scoreB: 0, matchStatus: 'finished' } });
    const { container } = render(
      <ScheduleDisplay schedule={schedule} currentMatches={currentMatches} finishedMatches={new Set([HF1.id])} />,
    );
    expect(screen.queryByTestId(`final-decision-${HF1.id}`)).toBeNull();
    expect(container.textContent).not.toMatch(/n\. V\.|i\. E\./);
  });
});

describe('Gegenbeispiel: Gruppenphase bleibt unverändert', () => {
  it('Gruppenspiel 3:1: Spielkarte mit Tore je Zeile, keine Eingabefelder der Finalrunden-Karte', () => {
    expect(groupMatch).toBeDefined();
    const id = (groupMatch as { id: string }).id;
    const currentMatches = aktuell({ [id]: { scoreA: 3, scoreB: 1, matchStatus: 'finished' } });
    const { container } = render(
      <ScheduleDisplay schedule={schedule} currentMatches={currentMatches} finishedMatches={new Set([id])} editable onScoreChange={vi.fn()} />,
    );
    expect(screen.getByTestId(`match-goals-${id}-home`).textContent).toBe('3');
    expect(screen.getByTestId(`match-goals-${id}-away`).textContent).toBe('1');
    const gruppenKarte = screen.getByTestId(`match-goals-${id}-home`).closest('[data-match-card]');
    expect(gruppenKarte?.querySelector('input')).toBeNull();
    expect(gruppenKarte?.querySelector('[data-testid^="final-score-input"]')).toBeNull();
    // Finalrunde: noch offen, editierbar → Eingabefelder nur dort
    expect(container.querySelectorAll('[data-testid^="final-score-input"]').length).toBeGreaterThan(0);
  });
});
