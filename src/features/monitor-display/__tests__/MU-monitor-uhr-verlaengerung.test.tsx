/**
 * Paket MU – C-MONITOR-UHR-VERLAENGERUNG (@ZM-039, @ZM-139): der Monitor rechnet die Uhr mit der Dauer der Ansicht.
 * Regelzeit ohne Verlängerung; in der Verlängerung der Uhrstand am Anpfiff der Verlängerung plus deren Dauer
 * (wie `viewDurationSeconds`); in der Finalrunde die eigene Dauer (`finalRoundGameDuration`).
 *
 * Pflichttests (vor dem Fix rot):
 *   - @ZM-039 @ZM-139 Verlängerung läuft: Restzeit 3:40, nie „00:00 – Ergebnis folgt“
 *   - @ZM-139 Finalrundenspiel mit eigener Dauer (12 Min.) rechnet mit 12 Minuten
 *   - @ZM-039 Verlängerung nach Überlauf (Anpfiff bei 10:45) zählt ab dem Anpfiff
 * Gegenbeispiele (grün):
 *   - Gruppenspiel in der regulären Spielzeit bleibt bei 10 Minuten
 *   - abgelaufene Spielzeit ohne Verlängerung zeigt weiter „Ergebnis folgt“
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.unmock('i18next'); vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../test/realDeI18n';
await initRealDeI18n();

import { LiveSlide } from '../slides/LiveSlide';
import { liveMatchOf, withView } from './monitorViewHelper';
import { slide } from './monitorFixture';
import { looseVs } from '../../../test/matchSlotFixtures';
import type { Match, Team, Tournament } from '../../../types/tournament';

vi.mock('../../../hooks/useLiveMatches', () => ({
  useLiveMatches: () => ({ liveMatches: new Map(), lastGoalEvent: null, lastCardEvent: null }),
}));

/** Wanduhr des Abrufs; die Uhr des Spiels läuft seit diesem Zeitpunkt. */
const JETZT = Date.UTC(2026, 10, 28, 13, 0, 0);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(JETZT);
});

afterEach(() => {
  vi.useRealTimers();
});

const teams: Team[] = [
  { id: 'teamA', name: 'Alpha' },
  { id: 'teamB', name: 'Beta' },
];

interface Lauf {
  /** Gespielte Zeit gesamt in Sekunden (die Uhr läuft). */
  uhrSek: number;
  phase: 'regular' | 'overtime';
  /** Uhrstand am Beginn des Abschnitts bzw. der Verlängerung in Sekunden. */
  beginnSek: number;
  section: number;
  /** Länge eines regulären Abschnitts in Sekunden. */
  abschnittSek: number;
}

/** Laufendes Spiel: Feinstand wie in `live_state` (Engine) und Cache-Zeitstempel, die Uhr läuft seit `JETZT`. */
function laufend(lauf: Lauf): Pick<Match, 'matchStatus' | 'liveState' | 'timerStartTime' | 'timerElapsedSeconds'> {
  return {
    matchStatus: 'running',
    timerStartTime: new Date(JETZT).toISOString(),
    timerElapsedSeconds: lauf.uhrSek,
    liveState: {
      status: 'running',
      phase: lauf.phase,
      section: lauf.section,
      sections: 2,
      sectionSeconds: lauf.abschnittSek,
      overtimeSeconds: 300,
      sectionStartMs: lauf.beginnSek * 1000,
      elapsedMs: lauf.uhrSek * 1000,
      anchorAt: JETZT,
      running: true,
      breakStartedAt: null,
    },
  };
}

function spiel(extra: Partial<Match>): Match {
  return { id: 'm1', matchNumber: 1, round: 1, field: 1, ...looseVs('teamA', 'teamB'), ...extra };
}

/** Platz-3-Spiel der Finalrunde (@ZM-039-Beispiel). */
const PLATZ_3 = { id: 'platz3', phase: 'final', finalType: 'thirdPlace', isFinal: true, label: 'Spiel um Platz 3' } as const;

function turnier(match: Match, extra: Partial<Tournament> = {}): Tournament {
  return {
    id: 't1',
    date: '2026-11-28',
    teams,
    gamePeriods: 2,
    groupPhaseGameDuration: 10,
    matches: [match],
    ...extra,
  } as unknown as Tournament;
}

function renderLive(tournament: Tournament) {
  return render(
    <LiveSlide slide={slide('live', { fieldId: 'field-1' })} {...withView(tournament)} performanceSettings={{} as never} theme="dark" style={{}} />,
  );
}

describe('@ZM-039 @ZM-139 Monitor-Uhr in der Verlängerung (Paket MU)', () => {
  it('@ZM-039 @ZM-139 Verlängerung läuft (Platz 3, 2:2, seit 1:20): der Monitor zeigt die Restzeit 3:40, nie „00:00 – Ergebnis folgt“', () => {
    const match = spiel({ ...PLATZ_3, ...laufend({ uhrSek: 680, phase: 'overtime', beginnSek: 600, section: 2, abschnittSek: 300 }) });
    const tournament = turnier(match, { finalRoundGameDuration: 10 });

    expect(liveMatchOf(match, tournament).durationSeconds).toBe(900);
    renderLive(tournament);
    expect(screen.getByText('03:40')).toBeInTheDocument();
    expect(screen.queryByText(/Ergebnis folgt/)).toBeNull();
  });

  it('@ZM-139 Finalrundenspiel mit eigener Dauer (12 Min., Abschnitte zu 6 Min.) rechnet mit 12 Minuten: bei 10:10 gespielt steht die Restzeit bei 1:50', () => {
    const match = spiel({ ...PLATZ_3, ...laufend({ uhrSek: 610, phase: 'regular', beginnSek: 360, section: 2, abschnittSek: 360 }) });
    const tournament = turnier(match, { finalRoundGameDuration: 12 });

    expect(liveMatchOf(match, tournament).durationSeconds).toBe(720);
    renderLive(tournament);
    expect(screen.getByText('01:50')).toBeInTheDocument();
    expect(screen.queryByText(/Ergebnis folgt/)).toBeNull();
  });

  it('@ZM-039 Verlängerung nach Überlauf: Anpfiff der Verlängerung bei 10:45, läuft seit 1:20 – die Restzeit 3:40 zählt ab dem Anpfiff, nicht ab der Regelzeit', () => {
    const match = spiel({ ...PLATZ_3, ...laufend({ uhrSek: 725, phase: 'overtime', beginnSek: 645, section: 2, abschnittSek: 300 }) });
    const tournament = turnier(match, { finalRoundGameDuration: 10 });

    expect(liveMatchOf(match, tournament).durationSeconds).toBe(945);
    renderLive(tournament);
    expect(screen.getByText('03:40')).toBeInTheDocument();
    expect(screen.queryByText(/Ergebnis folgt/)).toBeNull();
  });

  it('@ZM-039 @ZM-040 Verlängerung angehalten bei Restzeit 3:40: die Dauer bleibt die Verlängerungs-Dauer (900), die Anzeige steht bei 03:40, nie „Ergebnis folgt“', () => {
    const match = spiel({
      ...PLATZ_3,
      // Cache-Status 'paused' fehlt im TS-Typ (C-MATCHSTATUS-OHNE-PAUSED), wie im Cache geschrieben
      matchStatus: 'paused' as const,
      timerPausedAt: new Date(JETZT).toISOString(),
      timerElapsedSeconds: 680,
      liveState: {
        status: 'paused',
        phase: 'overtime',
        section: 2,
        sections: 2,
        sectionSeconds: 300,
        overtimeSeconds: 300,
        sectionStartMs: 600000,
        elapsedMs: 680000,
        anchorAt: null,
        running: false,
        breakStartedAt: null,
      },
    });
    const tournament = turnier(match, { finalRoundGameDuration: 10 });

    expect(liveMatchOf(match, tournament).durationSeconds).toBe(900);
    renderLive(tournament);
    expect(screen.getByText('03:40')).toBeInTheDocument();
    expect(screen.queryByText(/Ergebnis folgt/)).toBeNull();
  });

  it('@ZM-139 Gegenbeispiel Gruppenspiel in der regulären Spielzeit: die Dauer bleibt 10 Minuten', () => {
    const match = spiel({ id: 'gruppe', group: 'A', phase: 'groupStage', ...laufend({ uhrSek: 240, phase: 'regular', beginnSek: 0, section: 1, abschnittSek: 300 }) });
    const tournament = turnier(match);

    expect(liveMatchOf(match, tournament).durationSeconds).toBe(600);
  });

  it('@ZM-039 Gegenbeispiel abgelaufene Spielzeit ohne Verlängerung zeigt weiter „Ergebnis folgt“', () => {
    const match = spiel({ id: 'gruppe', group: 'A', phase: 'groupStage', ...laufend({ uhrSek: 600, phase: 'regular', beginnSek: 300, section: 2, abschnittSek: 300 }) });
    const tournament = turnier(match);

    renderLive(tournament);
    expect(screen.getByText(/Ergebnis folgt/)).toBeInTheDocument();
  });
});
