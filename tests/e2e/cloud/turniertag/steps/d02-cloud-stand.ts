/**
 * D2 Cloud-Stand. Besitzer: A-02 (Spielseiten als Slots in der Cloud). Läuft grün: jedes
 * Gruppenspiel trägt beide Team-IDs aus den Teams des Turniers, jedes Finalrunden-Spiel eine
 * strukturierte Herkunft (Gruppenrang bzw. Spielergebnis mit echter Spiel-ID, nie einen Text),
 * und ein frisch geöffnetes zweites Gerät des Veranstalters sieht denselben Spielplan.
 */
import { expect } from '@playwright/test';
import { fetchTurniertagBracket, fetchTurniertagTeams, matchRow, openSpielplanFinalrunde } from './shared';
import type { StepContext, TurniertagStep } from './types';

async function cloudStand({ asRole }: StepContext): Promise<void> {
  const teamIds = new Set((await fetchTurniertagTeams()).map((team) => team.id));
  const { groupMatches, finals } = await fetchTurniertagBracket();
  for (const match of groupMatches) {
    expect(teamIds.has(match.team_a_id ?? ''), `Gruppenspiel ${match.id}: team_a_id`).toBe(true);
    expect(teamIds.has(match.team_b_id ?? ''), `Gruppenspiel ${match.id}: team_b_id`).toBe(true);
    expect(match.team_a_id).not.toBe(match.team_b_id);
  }
  const matchIds = new Set([...groupMatches, ...finals].map((match) => match.id));
  for (const match of finals) {
    expect(match.team_a_id, `Finalrunde ${match.id} ist noch unbesetzt`).toBeNull();
    for (const source of [match.slot_a_source, match.slot_b_source]) {
      expect(source, `Finalrunde ${match.id} trägt eine Herkunft`).not.toBeNull();
      if (source?.kind === 'groupRank') {
        expect(['A', 'B']).toContain(source.group);
      } else {
        expect(source?.kind).toBe('matchResult');
        expect(matchIds.has(source?.matchId ?? ''), 'Herkunft verweist auf ein echtes Spiel (UUID, nie "semi1")').toBe(true);
      }
    }
  }

  // Ein frisch geöffnetes zweites Gerät zeigt die Herkunft der Finalrunde aus der Cloud-Zeile.
  const label = (source: NonNullable<(typeof finals)[number]['slot_a_source']>): string =>
    source.kind === 'groupRank' ? `${source.rank === 1 ? 'Erster' : 'Zweiter'} Gruppe ${source.group}` : '';
  const hf1 = finals[0];
  const secondDevice = await asRole('owner');
  await openSpielplanFinalrunde(secondDevice);
  const expectedLabel = new RegExp(`^Spiel \\d+: ${label(hf1.slot_a_source ?? { kind: 'none' })} gegen ${label(hf1.slot_b_source ?? { kind: 'none' })}$`);
  await expect(matchRow(secondDevice, hf1.id)).toHaveAttribute('aria-label', expectedLabel, { timeout: 15000 });
}

export const steps: readonly TurniertagStep[] = [
  { id: 'D2', title: 'Cloud-Stand: Team-IDs, Herkunft der Finalrunde, zweites Gerät sieht denselben Spielplan', scenarios: ['@TM-015'], owner: 'A-02', expectedFail: false, run: cloudStand },
];
