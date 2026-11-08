/**
 * @ZM-184 Auf der Zuschauer-Seite steht eine laufende Zeitstrafe mit Restzeit beim Team: Spiel 7 „FC Nord – SV Süd“, SV Süd
 * hat in der 4. Minute eine Zeitstrafe von 2 Minuten für die Rückennummer 5, sie läuft seit 37 Sekunden → „Zeitstrafe #5 · 1:23“
 * beim Team SV Süd. Karte am Handy (MatchCard), Finalrunden-Karte und Tabellenzeile (Laptop). Die Uhr der Karte (`clockOf`)
 * trägt die laufenden Strafen (`useSpectatorClocks` mit den Spielen der öffentlichen Antwort).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, renderHook, screen } from '@testing-library/react';

vi.unmock('i18next');
vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../test/realDeI18n';
await initRealDeI18n();

import { MatchCard, MatchCardDesktop } from '../MatchCard';
import { FinalStageMobileCard } from '../FinalStageMobileCard';
import { NowSourceContext } from '../useTickingNow';
import { useSpectatorClocks } from '../useSpectatorClocks';
import { buildTournamentView, engineDetailFromMatches, laufendeZeitstrafen, spectatorClockOf, type MatchBadgeModel, type SpectatorClock } from '../../../core/view';
import type { ScheduledMatch } from '../../../core/generators';
import type { Match, RuntimeMatchEvent } from '../../../types/tournament';
import { createMockTournament } from '../../../test/factories';
import { looseVs } from '../../../test/matchSlotFixtures';

const NORD = { id: 'team-nord', name: 'FC Nord' };
const SUED = { id: 'team-sued', name: 'SV Süd' };
const LIVE: MatchBadgeModel = { kind: 'badge', state: 'live' };
const RESULT = { goalsA: 1, goalsB: 0, penaltyA: undefined, penaltyB: undefined, decision: null, winner: null } as const;
const T0 = Date.UTC(2026, 10, 28, 14, 0, 0);
const START_5 = 200_000;

const NR5: RuntimeMatchEvent = {
  id: 's5', type: 'TIME_PENALTY', timestampSeconds: 200, clockMs: START_5,
  payload: { teamId: SUED.id, playerNumber: 5, durationSeconds: 120 }, scoreAfter: { home: 1, away: 0 },
};
function uhr(gespieltMs: number) {
  return { status: 'running', phase: 'regular', section: 1, sections: 1, sectionSeconds: 600, sectionStartMs: 0, elapsedMs: gespieltMs, anchorAt: T0 };
}

function karteMit(gespieltMs: number): SpectatorClock {
  const zeitstrafen = laufendeZeitstrafen({ events: [NR5], liveState: uhr(gespieltMs), homeId: NORD.id, awayId: SUED.id, nowMs: T0 });
  return { ...spectatorClockOf({ totalElapsedSec: gespieltMs / 1000, sectionSec: 600, sections: 1, stopped: false }), zeitstrafen };
}

describe('@ZM-184 Auf der Zuschauer-Seite steht eine laufende Zeitstrafe mit Restzeit beim Team', () => {
  it('@ZM-184 Karte am Handy: beim Team SV Süd „Zeitstrafe #5 · 1:23“, bei FC Nord nichts', () => {
    render(<MatchCard matchId="m7" homeTeam={NORD} awayTeam={SUED} status="running" result={RESULT} badge={LIVE} clock={karteMit(START_5 + 37_000)} />);
    expect(screen.getByTestId('match-time-penalty-m7-away')).toHaveTextContent('Zeitstrafe #5 · 1:23');
    expect(screen.queryByTestId('match-time-penalty-m7-home')).toBeNull();
  });

  it('@ZM-184 nach Ablauf der Strafe steht dort nichts mehr', () => {
    render(<MatchCard matchId="m7" homeTeam={NORD} awayTeam={SUED} status="running" result={RESULT} badge={LIVE} clock={karteMit(START_5 + 120_000)} />);
    expect(screen.queryByTestId('match-time-penalty-m7-away')).toBeNull();
    expect(document.body.textContent).not.toMatch(/Zeitstrafe/);
  });

  it('@ZM-184 der Hinweis steht in der Zeile von SV Süd (beim Team), nicht unter der Uhr', () => {
    render(<MatchCard matchId="m7" homeTeam={NORD} awayTeam={SUED} status="running" result={RESULT} badge={LIVE} clock={karteMit(START_5 + 37_000)} />);
    const zeile = screen.getByTestId('match-name-m7-away').parentElement;
    expect(zeile).toContainElement(screen.getByTestId('match-time-penalty-m7-away'));
  });

  it('@ZM-184 Finalrunden-Karte (Handy): beim Team SV Süd „Zeitstrafe #5 · 1:23“', () => {
    const match = { id: 'finale', matchNumber: 15, time: '15:50', field: 1, homeTeam: 'FC Nord', awayTeam: 'SV Süd' } as ScheduledMatch;
    render(
      <FinalStageMobileCard
        match={match} label="Finale" homeName="FC Nord" awayName="SV Süd" homePending={false} awayPending={false}
        result={null} isRunning isFinished={false} badge={LIVE} clock={karteMit(START_5 + 37_000)} canEditScore={false}
        showReferees={false} showFields={false} editingSchedule={false} displayedRef={undefined} displayedField={undefined}
        hasPendingRef={false} hasPendingField={false} refereeOptions={[]} fieldOptions={[]}
      />,
    );
    expect(screen.getByTestId('match-time-penalty-finale-away')).toHaveTextContent('Zeitstrafe #5 · 1:23');
  });

  it('@ZM-184 Tabellenzeile (Laptop): beim Team SV Süd „Zeitstrafe #5 · 1:23“', () => {
    render(<MatchCardDesktop matchId="m7" homeTeam={NORD} awayTeam={SUED} status="running" result={RESULT} badge={LIVE} clock={karteMit(START_5 + 37_000)} />);
    expect(screen.getByTestId('match-time-penalty-m7-away')).toHaveTextContent('Zeitstrafe #5 · 1:23');
  });
});

describe('@ZM-184 Uhr der Karte aus der öffentlichen Antwort (useSpectatorClocks)', () => {
  function spiel7(patch: Partial<Match>, hideScoresForPublic = false, publicLiveScore?: boolean) {
    const match: Match = { id: 'match-7', matchNumber: 7, round: 1, field: 1, group: 'A', ...looseVs(NORD.id, SUED.id), scoreA: 1, scoreB: 0, matchStatus: 'running', ...patch };
    const tournament = createMockTournament({ id: 'tour-1', teams: [{ ...NORD, group: 'A' }, { ...SUED, group: 'A' }], matches: [match], isPublic: true, shareCode: 'ABC123', hideScoresForPublic, ...(publicLiveScore === undefined ? {} : { publicLiveScore }) });
    const view = buildTournamentView({ ...tournament, engineDetail: engineDetailFromMatches(tournament.matches, T0) }, { audience: 'viewer', medium: 'app', locale: 'de' });
    const { result } = renderHook(() => useSpectatorClocks(view, () => undefined, tournament.matches), {
      wrapper: ({ children }) => <NowSourceContext.Provider value={() => T0}>{children}</NowSourceContext.Provider>,
    });
    return result.current('match-7');
  }

  it('@ZM-184 laufendes Spiel 7 mit Strafe seit 37 s: die Uhr der Karte trägt „5“ bei SV Süd mit 1:23', () => {
    const clock = spiel7({ events: [NR5], liveState: uhr(START_5 + 37_000) });
    expect(clock?.zeitstrafen?.away.map((s) => [s.nummer, s.restMs])).toEqual([[5, 83_000]]);
  });

  it('@ZM-183 Gegenbeispiel Kindermodus: keine Strafe an der Uhr der Karte', () => {
    const clock = spiel7({ events: [NR5], liveState: uhr(START_5 + 37_000) }, true);
    expect(clock?.zeitstrafen).toBeUndefined();
  });

  it('@ZM-184 Gegenbeispiel: ohne laufende Strafe trägt die Uhr keine Strafen', () => {
    const clock = spiel7({ events: [], liveState: uhr(START_5 + 37_000) });
    expect(clock?.zeitstrafen).toBeUndefined();
  });

  it('@ZM-194 Live-Stand für Zuschauer aus (Ereignisse an): die Uhr der Karte trägt keine Strafe', () => {
    const clock = spiel7({ events: [NR5], liveState: uhr(START_5 + 37_000) }, false, false);
    expect(clock?.zeitstrafen).toBeUndefined();
  });

  it('@ZM-194 Gegenbeispiel: Live-Stand an, dieselbe Lage: die Strafe steht an der Uhr', () => {
    const clock = spiel7({ events: [NR5], liveState: uhr(START_5 + 37_000) }, false, true);
    expect(clock?.zeitstrafen?.away).toHaveLength(1);
  });

  it('@ZM-192 Gegentor beendet die Strafe: die Uhr der Karte trägt nach dem Tor von FC Nord keine Strafe mehr', () => {
    const tor: RuntimeMatchEvent = { id: 'tor', type: 'GOAL', timestampSeconds: 230, clockMs: START_5 + 30_000, payload: { teamId: NORD.id }, scoreAfter: { home: 2, away: 0 } };
    const clock = spiel7({ events: [NR5, tor], liveState: uhr(START_5 + 37_000) });
    expect(clock?.zeitstrafen).toBeUndefined();
  });
});
