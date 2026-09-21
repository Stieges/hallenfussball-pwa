/**
 * Test-Helfer für die Platzierungskriterien-Regression (Abschluss-Review
 * feat/terminologie-zentral, Befund 1).
 *
 * TournamentCreationService/tournamentImporter setzen bei neuen bzw.
 * importierten Turnieren nur noch `{ id, enabled }` — kein `label` mehr.
 * TabellenTab und RankingTab müssen die Beschriftung trotzdem über
 * `resolvePlacementCriterionLabel` (wizard.json) auflösen, mit Rückfall
 * auf ein evtl. noch gespeichertes `label` für Altdaten/Importe ohne
 * passenden Schlüssel.
 *
 * Der globale Passthrough-Mock aus `src/test/setup.ts` gibt Schlüssel
 * unverändert zurück und ignoriert `defaultValue` — gegen den wäre der
 * "ohne label"-Fall vakuum-grün, ohne die echte Auflösung zu prüfen.
 * Deshalb hier eine echte i18next-Instanz (analog
 * `src/hooks/__tests__/useSportConfig.terms.test.tsx`).
 */
import type { ReactNode } from 'react';
import deWizard from '../../../i18n/locales/de/wizard.json';
import deTournament from '../../../i18n/locales/de/tournament.json';
import { MOCK_TOURNAMENT } from '../../../test-data/mockTournament';
import { calculateStandings } from '../../../utils/calculations';
import { generateFullSchedule, type GeneratedSchedule } from '../../../core/generators';
import type { PlacementCriterion, Standing, Tournament } from '../../../types/tournament';

export function buildTestTournament(placementLogic: PlacementCriterion[]): Tournament {
  return {
    ...MOCK_TOURNAMENT,
    placementLogic,
  };
}

export function buildScheduleAndStandings(
  tournament: Tournament
): { schedule: GeneratedSchedule; standings: Standing[] } {
  const schedule = generateFullSchedule(tournament);

  const uniqueGroups = Array.from(
    new Set(tournament.teams.map(t => t.group).filter(Boolean))
  ) as string[];

  const standings: Standing[] = [];
  uniqueGroups.forEach(group => {
    const teamsInGroup = tournament.teams.filter(t => t.group === group);
    standings.push(...calculateStandings(teamsInGroup, tournament.matches, tournament, group));
  });

  return { schedule, standings };
}

export async function createRealI18nWrapper(): Promise<
  ({ children }: { children: ReactNode }) => ReactNode
> {
  const { createInstance } = await import('i18next');
  const { initReactI18next, I18nextProvider } = await import('react-i18next');

  const instance = createInstance();
  await instance.use(initReactI18next).init({
    lng: 'de',
    fallbackLng: 'de',
    defaultNS: 'tournament',
    ns: ['tournament', 'wizard'],
    resources: {
      de: { tournament: deTournament, wizard: deWizard },
    },
    interpolation: { escapeValue: false },
    returnNull: false,
  });

  return ({ children }: { children: ReactNode }) => (
    <I18nextProvider i18n={instance}>{children}</I18nextProvider>
  );
}
