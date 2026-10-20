/**
 * useCockpitLeerGrund (Cockpit 2.5, R5: neue Logik von `ManagementTab` in einen Hook): was das Cockpit zeigt, wenn kein Spiel im
 * Cockpit steht – wartet auf die Herkunft einer offenen Seite (@SL-052, @TM-033, @TM-035) oder kein weiteres Spiel auf dem Feld
 * (@SL-054) – sowie die Sperr-Hinweise nach Rot für das Spiel im Cockpit (@SL-089, L6). Die Tafel nennt den Grund.
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { SperrHinweis } from '../../../core/match';
import type { ScheduledMatch } from '../../../core/generators';
import { awaitingLabel } from '../../../core/models/slotLabel';
import type { Tournament } from '../../../types/tournament';
import type { LeerGrund } from '../../../components/live-cockpit/model/cockpitPhase';
import type { LiveCockpitProps, MatchSummary } from '../../../components/live-cockpit/types';
import { sideName, type SideContext } from '../../../components/schedule/matchSides';
import { useRedCardSuspensions } from '../../../hooks/useRedCardSuspensions';

export interface CockpitLeerGrundArgs {
  tournament: Tournament;
  allMatches: readonly ScheduledMatch[];
  /** Das Spiel, das im Cockpit stehen sollte (gewählt, laufend oder nächstes ohne Ergebnis); `undefined`: keins mehr. */
  currentMatchData: ScheduledMatch | undefined;
  awaitingTeams: boolean;
  isOnline: boolean;
  sides: SideContext;
  selectedFieldNumber: number;
  upcomingMatches: MatchSummary[];
  onLoadNextMatch: (fieldId: string) => void;
}

export interface CockpitLeerGrund {
  leer: LeerGrund | null;
  sperrHinweise: SperrHinweis[];
  /** Props des Cockpits ohne Spiel: nur die Tafel; die Rückrufe sind Pflicht des Typs, ohne Spiel aber nie erreichbar. */
  leerProps: LiveCockpitProps;
}

export function useCockpitLeerGrund(args: CockpitLeerGrundArgs): CockpitLeerGrund {
  const { tournament, allMatches, currentMatchData, awaitingTeams, isOnline, sides, selectedFieldNumber, upcomingMatches, onLoadNextMatch } = args;
  const { t } = useTranslation('tournament');
  const { t: tCockpit } = useTranslation('cockpit');

  // @TM-033: Wartegründe der offenen Seiten des gewählten Spiels
  const awaitingReasons = useMemo(() => {
    if (!currentMatchData) { return []; }
    const ctx = { teams: tournament.teams, matches: allMatches, groups: tournament.groups };
    const reasons = [awaitingLabel(currentMatchData.slotA, ctx), awaitingLabel(currentMatchData.slotB, ctx)]
      .filter((reason): reason is string => reason !== undefined);
    return Array.from(new Set(reasons));
  }, [currentMatchData, tournament.teams, tournament.groups, allMatches]);

  const sperrHinweise = useRedCardSuspensions(tournament, currentMatchData?.id ?? '');

  const leer = useMemo((): LeerGrund | null => {
    const feldName = t('management.field', { number: selectedFieldNumber });
    if (awaitingTeams && currentMatchData) {
      return {
        art: 'wartetAufHerkunft', gruende: awaitingReasons, offline: !isOnline,
        paarung: `${sideName(currentMatchData, 'A', sides)} – ${sideName(currentMatchData, 'B', sides)}`,
        spielLabel: tCockpit('tafel.vor.spielFeld', { nummer: currentMatchData.matchNumber, feld: feldName }),
      };
    }
    return currentMatchData ? null : { art: 'keinSpiel', feldName };
  }, [awaitingTeams, currentMatchData, awaitingReasons, isOnline, sides, tCockpit, t, selectedFieldNumber]);

  const leerProps: LiveCockpitProps = {
    fieldName: t('management.field', { number: selectedFieldNumber }), tournamentName: tournament.title, tournamentId: tournament.id,
    // ohne Spiel gibt es nichts zu steuern: nur die Tafel mit dem Grund
    cockpitSettings: tournament.matchCockpitSettings, kannSteuern: false, currentMatch: null, leer, upcomingMatches,
    onStart: () => undefined, onPause: () => undefined, onResume: () => undefined, onFinish: () => undefined,
    onGoal: () => Promise.resolve(null), onLoadNextMatch,
  };
  return { leer, sperrHinweise, leerProps };
}
