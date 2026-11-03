/**
 * useSpielplanKorrektur (@EK-063, @SL-193): „Ergebnis korrigieren“ in der Aktionsauswahl des Spielplans. Kein eigener Weg:
 * derselbe Dialog und dieselbe Korrektur wie im Cockpit (`useKorrekturEinstieg`), das bisherige Ergebnis kommt aus der Ansicht.
 */
import { useCallback } from 'react';
import type { TournamentView } from '../../../core/view';
import type { KnownScore } from './useScheduleResultEntry';
import { useKorrekturEinstieg, type KorrekturEinstieg, type KorrekturSpiel } from './useKorrekturEinstieg';

export function useSpielplanKorrektur(options: {
  view: TournamentView;
  enterScore: (matchId: string, home: number, away: number, knownScore?: KnownScore) => Promise<boolean>;
  /** Turnierleitung (`leadMatches`); der Helfer bekommt keinen Handler (@HE-042, @FU-113) */
  istLeitung: boolean;
}): KorrekturEinstieg {
  const { view, enterScore, istLeitung } = options;
  const spielOf = useCallback((matchId: string): KorrekturSpiel | null => {
    const match = view.byId.get(matchId);
    if (match?.score === undefined) { return null; }
    return { number: match.matchNumber ?? 0, homeName: match.home.label, awayName: match.away.label, scoreHome: match.score.a, scoreAway: match.score.b };
  }, [view]);
  return useKorrekturEinstieg({ enterScore, spielOf, istLeitung });
}
