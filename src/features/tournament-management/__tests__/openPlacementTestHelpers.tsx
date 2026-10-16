/**
 * Test-Helfer A-36b Fixrunde 1c (@ET-042, Regel T2-UI): Turnier mit Finale + Spiel um Platz 3 und echte
 * i18next-Instanz (DE/EN, tournament + wizard) für RankingTab/TabellenTab.
 */
import type { ReactNode } from 'react';
import deWizard from '../../../i18n/locales/de/wizard.json';
import deTournament from '../../../i18n/locales/de/tournament.json';
import enWizard from '../../../i18n/locales/en/wizard.json';
import enTournament from '../../../i18n/locales/en/tournament.json';
import { MOCK_TOURNAMENT } from '../../../test-data/mockTournament';
import { calculateStandings } from '../../../utils/calculations';
import { generateFullSchedule, type GeneratedSchedule } from '../../../core/generators';
import { vs } from '../../../test/matchSlotFixtures';
import type { Match, Standing, Tournament } from '../../../types/tournament';

export type FinalState = 'running' | 'decided';

/** Finale (Team 1 gegen Team 5) laufend 2:0 bzw. entschieden 2:0; Spiel um Platz 3 (Team 2 gegen Team 6) entschieden 1:0. */
export function tournamentWithFinal(state: FinalState): Tournament {
  const [t1, t2, , , t5, t6] = MOCK_TOURNAMENT.teams;
  const finale: Match = {
    id: 'a36b-finale', round: 20, field: 1, ...vs(t1.id, t5.id), isFinal: true, finalType: 'final', label: 'Finale',
    scoreA: 2, scoreB: 0, matchStatus: state === 'running' ? 'running' : 'finished',
    ...(state === 'decided' ? { decidedBy: 'regular' as const } : {}),
  };
  const third: Match = {
    id: 'a36b-platz3', round: 19, field: 1, ...vs(t2.id, t6.id), isFinal: true, finalType: 'thirdPlace',
    scoreA: 1, scoreB: 0, matchStatus: 'finished', decidedBy: 'regular',
  };
  return {
    ...MOCK_TOURNAMENT,
    // Bestehender Schalter der Tabs: Finalrunden-Platzierung nur bei `finals.enabled`, das das Turniermodell nicht kennt.
    // Der Cast verdeckt C-FINALS-ENABLED-FEHLT, bis das Freischalten entschieden ist (Daniel); er fällt mit dem Fix weg.
    finals: { ...MOCK_TOURNAMENT.finals, enabled: true } as Tournament['finals'],
    matches: [...MOCK_TOURNAMENT.matches.filter((m) => m.isFinal !== true), third, finale],
  };
}

export function scheduleAndStandings(tournament: Tournament): { schedule: GeneratedSchedule; standings: Standing[] } {
  const groups = Array.from(new Set(tournament.teams.map((t) => t.group).filter(Boolean))) as string[];
  const standings = groups.flatMap((group) =>
    calculateStandings(tournament.teams.filter((t) => t.group === group), tournament.matches, tournament, group),
  );
  return { schedule: generateFullSchedule(tournament), standings };
}

export async function realI18nWrapper(lng: 'de' | 'en'): Promise<({ children }: { children: ReactNode }) => ReactNode> {
  const { createInstance } = await import('i18next');
  const { initReactI18next, I18nextProvider } = await import('react-i18next');
  const instance = createInstance();
  await instance.use(initReactI18next).init({
    lng,
    fallbackLng: false,
    defaultNS: 'tournament',
    ns: ['tournament', 'wizard'],
    resources: {
      de: { tournament: deTournament, wizard: deWizard },
      en: { tournament: enTournament, wizard: enWizard },
    },
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  return ({ children }: { children: ReactNode }) => <I18nextProvider i18n={instance}>{children}</I18nextProvider>;
}

/** Erwarteter Kennzeichen-Text aus der Sprachdatei (kein fester Text im Test): „Finale – offen“ / „Final – open“. */
export function openLabel(lng: 'de' | 'en', finalType: 'final' | 'thirdPlace'): string {
  const source = lng === 'de' ? deTournament : enTournament;
  return source.ranking.open.replace('{{match}}', source.finals.labels[finalType]);
}

export function rankingTitle(lng: 'de' | 'en'): string {
  return (lng === 'de' ? deTournament : enTournament).ranking.title;
}
