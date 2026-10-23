/**
 * useScheduleView (A-36c): die gemeinsame Ansicht der Leitung für den Spielplan – EINE Statusquelle für Karten, Filter und
 * „läuft gerade“. Der Zwischenspeicher des Turniers trägt den Engine-Stand (Overlay); der Feinstatus der Engine hat Vorrang
 * (Engine beendet, Zwischenspeicher noch „läuft“). Die Spielzeit eines laufenden Spiels kommt aus der Uhr der Engine (@OB-064).
 */
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { buildTournamentView, badgeDetailFromEngineState, toTournamentLocal, TOURNAMENT_TIME_ZONE, type TournamentView, type ViewLocale } from '../../../core/view';
import { elapsedAt } from '../../../core/match';
import { useMatchEngineContextOptional } from '../../match-engine/useMatchEngineContext';
import type { Tournament } from '../../../types/tournament';

export interface ScheduleView {
  view: TournamentView;
  locale: ViewLocale;
  /** Spiele, die laufen oder unterbrochen sind */
  liveMatchIds: Set<string>;
  elapsedSeconds: (matchId: string) => number | undefined;
}

export function useScheduleView(tournament: Tournament): ScheduleView {
  const { i18n } = useTranslation('tournament');
  const engine = useMatchEngineContextOptional()?.engine;
  const locale: ViewLocale = i18n.language.startsWith('en') ? 'en' : 'de';
  const engineStatus = useCallback((matchId: string) => engine?.view(matchId)?.result.state.status, [engine]);
  const engineDetail = useCallback((matchId: string) => {
    const state = engine?.view(matchId)?.result.state;
    return state === undefined ? undefined : badgeDetailFromEngineState(state, new Date().getTime());
  }, [engine]);
  const view = useMemo(
    () => buildTournamentView({ ...tournament, engineStatus, engineDetail }, {
      audience: 'organizer',
      medium: 'app',
      locale,
      now: toTournamentLocal(new Date(), TOURNAMENT_TIME_ZONE),
    }),
    [tournament, engineStatus, engineDetail, locale],
  );
  const liveMatchIds = useMemo(() => new Set(view.current.live.map((m) => m.id)), [view]);
  const elapsedSeconds = useCallback((matchId: string): number | undefined => {
    const state = engine?.view(matchId)?.result.state;
    return state === undefined ? undefined : Math.floor(elapsedAt(state.clock, Date.now()) / 1000);
  }, [engine]);
  return { view, locale, liveMatchIds, elapsedSeconds };
}
