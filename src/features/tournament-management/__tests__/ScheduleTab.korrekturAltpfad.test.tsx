/**
 * A-08e (Frage 1 = A, Daniel 15.10.): kein Korrektur-Knopf im Spielplan bis B-24.
 * Pflichttest echter Weg: ScheduleTab mit echten Hooks und echtem Spielplan (alle Spiele beendet, Turnierleitung
 * mit Berechtigung): kein Korrektur-Einstieg, kein CorrectionDialog, onMatchesUpdate 0x.
 * Der Hook behaelt Zustand + Start/Abbruch fuer B-24 (useCorrectionMode.test.tsx).
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { generateFullSchedule } from '../../../core/generators';
import type { Team, Tournament } from '../../../types/tournament';
import { createMockTournament } from '../../../test/factories';
import { testUuid } from '../../../test/testIds';
import { ToastProvider } from '../../../components/ui/Toast';

// A-08f3e2: die Schnelleingabe fragt die Akteursrolle ab (useActorRole braucht sonst den AuthProvider).
vi.mock('../../../hooks/useActorRole', () => ({ useActorRole: () => 'leitung' }));
vi.mock('../../../hooks/usePermissions', () => ({
  usePermissions: () => ({ canCorrectResults: true, hasPermission: () => true }),
}));
vi.mock('../../../hooks/useLiveMatches', () => ({ useLiveMatches: () => ({ liveMatches: new Map() }) }));
vi.mock('../hooks/useRunningMatchIds', () => ({ useRunningMatchIds: () => new Set<string>() }));

import { ScheduleTab } from '../ScheduleTab';

const teams: Team[] = ['A', 'B'].flatMap((group, g) =>
  [1, 2, 3, 4].map((n) => ({ id: testUuid(g * 10 + n), name: `Team ${group}${n}`, group })),
);

describe('ScheduleTab ohne Korrektur-Altpfad (A-08e, Frage 1 = A)', () => {
  it('beendete Spiele: kein Korrektur-Knopf, kein Korrektur-Dialog, onMatchesUpdate 0x', () => {
    const base = createMockTournament({
      teams, numberOfTeams: 8, numberOfGroups: 2, numberOfFields: 1, groupSystem: 'groupsAndFinals',
      finalsConfig: { preset: 'top-4', tiebreakerByRound: { final: 'overtime-then-shootout', placement: 'shootout' } },
    });
    const schedule = generateFullSchedule(base);
    const tournament: Tournament = {
      ...base,
      matches: schedule.allMatches.map((m) => ({ ...m, scoreA: 2, scoreB: 1, matchStatus: 'finished' as const })) as unknown as Tournament['matches'],
    };
    const onMatchesUpdate = vi.fn();

    const { container, queryByTestId } = render(
      <MemoryRouter><ToastProvider>
        <ScheduleTab
          tournament={tournament} schedule={schedule} currentStandings={[]}
          onTournamentUpdate={vi.fn()} onLocalTournamentUpdate={vi.fn()} onMatchesUpdate={onMatchesUpdate}
        />
      </ToastProvider></MemoryRouter>,
    );

    expect(container.querySelectorAll('[data-testid^="correction-button-"], .correction-btn-mobile')).toHaveLength(0);
    expect(queryByTestId('correction-confirm-button')).toBeNull();
    expect(onMatchesUpdate).not.toHaveBeenCalled();
    // Gegenprobe: der Spielplan ist wirklich gerendert (beendete Ergebnisse stehen da)
    // @OB-064: das Ergebnis steht waagerecht ohne Leerzeichen („2:1“)
    expect(container.textContent).toContain('2:1');
  });
});
