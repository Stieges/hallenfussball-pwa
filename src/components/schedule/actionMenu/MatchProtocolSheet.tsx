/**
 * MatchProtocolSheet (@SL-193, Befund C-PROTOKOLL-OHNE-EINSTIEG, @FU-080, @FU-082): „Protokoll ansehen“ am Spiel – dieselbe
 * Protokoll-Liste wie im Cockpit (`EventLogBottomSheet`), nur lesend. Die Ereignisse kommen vom Spielplan, der `useLiveMatches` schon
 * abonniert hat: ein zweites Abonnement auf demselben Kanal würde beim Schließen das des Spielplans mitnehmen.
 */
import type { LiveMatch } from '../../live-cockpit/types';
import { EventLogBottomSheet } from '../../live-cockpit/components/EventLogBottomSheet';

export interface MatchProtocolSheetProps {
  liveMatches: ReadonlyMap<string, LiveMatch>;
  matchId: string;
  home: { id: string; name: string };
  away: { id: string; name: string };
  onClose: () => void;
}

export function MatchProtocolSheet({ liveMatches, matchId, home, away, onClose }: MatchProtocolSheetProps) {
  const live = liveMatches.get(matchId);
  return (
    <EventLogBottomSheet
      isOpen
      onClose={onClose}
      events={live?.events ?? []}
      homeTeamName={live?.homeTeam.name ?? home.name}
      awayTeamName={live?.awayTeam.name ?? away.name}
      homeTeamId={live?.homeTeam.id ?? home.id}
      awayTeamId={live?.awayTeam.id ?? away.id}
      matchId={matchId}
    />
  );
}
