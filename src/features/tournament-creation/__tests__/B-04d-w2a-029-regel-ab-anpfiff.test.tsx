/**
 * B-04 Paket d – @W2A-029: Spielregel-Änderung wirkt ab dem nächsten Anpfiff.
 *
 * Gegeben ein Spiel läuft mit Zeitstrafe 2 Minuten
 * Wenn die Turnierleitung die Zeitstrafe auf 1 Minute ändert
 * Dann gilt im laufenden Spiel weiter 2 Minuten
 * Und ab dem nächsten Anpfiff gilt 1 Minute
 *
 * Echter Bedienweg: Oberfläche → Logik → Speichern. Die Turnierleitung ändert
 * die Regel in den Einstellungen (UI-Ort:
 * src/components/match-cockpit/MatchCockpitSettingsPanel.tsx, Zeile
 * `settings-time-penalty-duration`) → echte Speicherstrecke
 * (TournamentService.updateTournament → repository.save) → Anpfiff:
 * MatchExecutionService.initializeMatch/startMatch übernehmen die Regeln in den
 * Spielstand (Schnitt `timePenaltyDurationSeconds`), recordTimePenalty rechnet
 * mit dem beim Anpfiff übernommenen Stand.
 *
 * Gegenbeispiel: ein nicht angepfiffenes Spiel übernimmt die neue Regel sofort
 * (kein Festhalten am alten Stand bis zum Ende des laufenden Spiels).
 * Mutation: das laufende Spiel liest die Regel live aus dem Turnier → rot.
 */
import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MatchCockpitSettingsPanel } from '../../../components/match-cockpit/MatchCockpitSettingsPanel';
import { MatchExecutionService } from '../../../core/services/MatchExecutionService';
import { TournamentService } from '../../../core/services/TournamentService';
import {
  DEFAULT_MATCH_COCKPIT_SETTINGS,
  type MatchCockpitSettings,
  type Tournament,
} from '../../../types/tournament';
import type { ILiveMatchRepository } from '../../../core/repositories/ILiveMatchRepository';
import type { ITournamentRepository } from '../../../core/repositories/ITournamentRepository';
import type { ScheduledMatch } from '../../../core/generators';

function turnier(): Tournament {
  return {
    id: 't1',
    title: 'Wintercup',
    status: 'published',
    sport: 'football',
    tournamentType: 'classic',
    mode: 'group',
    numberOfFields: 1,
    numberOfTeams: 2,
    groupPhaseGameDuration: 10,
    placementLogic: [],
    teams: [
      { id: 'teamA', name: 'Alpha' },
      { id: 'teamB', name: 'Beta' },
    ],
    matches: [],
    createdAt: '2026-10-10T08:00:00.000Z',
    updatedAt: '2026-10-10T08:00:00.000Z',
  } as unknown as Tournament;
}

function scheduledMatch(id: string): ScheduledMatch {
  return {
    id,
    matchNumber: 1,
    field: 1,
    label: 'Gruppenphase',
    phase: 'groupStage',
    homeTeam: 'Alpha',
    awayTeam: 'Beta',
    originalTeamA: 'teamA',
    originalTeamB: 'teamB',
    startTime: new Date('2026-10-10T10:00:00.000Z'),
  } as unknown as ScheduledMatch;
}

/**
 * Echter Speicherweg der Einstellungen: das Panel liefert die neuen Einstellungen,
 * die echte TournamentService.updateTournament-Strecke speichert sie über das
 * (gemockte) Repository — derselbe Weg wie die Verwaltungsoberfläche.
 */
function setup() {
  let gespeichert: Tournament = turnier();
  const repository = {
    save: vi.fn((t: Tournament) => {
      gespeichert = t;
      return Promise.resolve(t);
    }),
    get: vi.fn(() => Promise.resolve(gespeichert)),
    getAll: vi.fn(() => Promise.resolve([])),
    delete: vi.fn(() => Promise.resolve()),
  };
  const tournamentService = new TournamentService(repository as unknown as ITournamentRepository);

  const liveSaves: unknown[] = [];
  const liveMatches = new Map<string, { id: string } & Record<string, unknown>>();
  const liveMatchRepo = {
    get: vi.fn((_tournamentId: string, matchId: string) =>
      Promise.resolve(liveMatches.get(matchId) ?? null)
    ),
    save: vi.fn((_tournamentId: string, match: { id: string } & Record<string, unknown>) => {
      liveMatches.set(match.id, match);
      liveSaves.push(match);
      return Promise.resolve(match);
    }),
    getAll: vi.fn(() => Promise.resolve(new Map())),
    delete: vi.fn(() => Promise.resolve()),
  };
  const service = new MatchExecutionService(
    liveMatchRepo as unknown as ILiveMatchRepository,
    repository as unknown as ITournamentRepository
  );

  const settings = (): MatchCockpitSettings => ({
    ...DEFAULT_MATCH_COCKPIT_SETTINGS,
    ...gespeichert.matchCockpitSettings,
  });

  /** Wie die Verwaltungsoberfläche: hält die Einstellungen im Zustand und speichert echtt. */
  function EinstellungenHarness() {
    const [aktuell, setAktuell] = useState<MatchCockpitSettings>(settings());
    return (
      <MatchCockpitSettingsPanel
        settings={aktuell}
        tournamentId="t1"
        onChange={(next) => {
          setAktuell(next);
          void tournamentService.updateTournament({ ...gespeichert, matchCockpitSettings: next });
        }}
      />
    );
  }

  const rendereEinstellungen = () => {
    render(<EinstellungenHarness />);
  };

  /** Regel über die echte Einstellungs-Oberfläche ändern (Auswahlfeld, blur/change). */
  const aendereZeitstrafe = (seconds: number) => {
    fireEvent.change(screen.getByTestId('settings-time-penalty-duration'), {
      target: { value: String(seconds) },
    });
  };

  const zeitstrafeEreignis = async (tournamentId: string, matchId: string) => {
    const match = await service.recordTimePenalty(tournamentId, matchId, 'home');
    const last = match.events[match.events.length - 1];
    return last?.payload.durationSeconds;
  };

  return { service, repository, rendereEinstellungen, aendereZeitstrafe, zeitstrafeEreignis };
}

describe('B-04d @W2A-029 – Spielregel-Änderung wirkt ab dem nächsten Anpfiff', () => {
  it('Pflichttest: laufendes Spiel rechnet weiter mit 2 Minuten, danach angepfiffenes Spiel mit 1 Minute', async () => {
    const { service, repository, rendereEinstellungen, aendereZeitstrafe, zeitstrafeEreignis } =
      setup();

    // Spiel A angepfiffen, solange die Regel „Zeitstrafe 2 Minuten" gilt
    await service.initializeMatch('t1', scheduledMatch('mA'));
    await service.startMatch('t1', 'mA');
    rendereEinstellungen();

    // Turnierleitung ändert die Regel auf 1 Minute (echter Speicherweg)
    aendereZeitstrafe(60);
    expect(repository.save).toHaveBeenCalled();
    expect(screen.getByTestId('settings-time-penalty-duration')).toHaveValue('60');

    // Das laufende Spiel rechnet weiter mit 2 Minuten
    expect(await zeitstrafeEreignis('t1', 'mA')).toBe(120);

    // Ein danach angepfiffenes Spiel gilt 1 Minute
    await service.initializeMatch('t1', scheduledMatch('mB'));
    await service.startMatch('t1', 'mB');
    expect(await zeitstrafeEreignis('t1', 'mB')).toBe(60);
  });

  it('Gegenbeispiel: ein nicht angepfiffenes Spiel übernimmt die neue Regel sofort', async () => {
    const { service, rendereEinstellungen, aendereZeitstrafe, zeitstrafeEreignis } = setup();

    // Spiel C ist eingerichtet, aber noch nicht angepfiffen
    await service.initializeMatch('t1', scheduledMatch('mC'));
    rendereEinstellungen();
    aendereZeitstrafe(60);

    // Beim Anpfiff gilt die neue Regel ohne Übergang
    await service.startMatch('t1', 'mC');
    expect(await zeitstrafeEreignis('t1', 'mC')).toBe(60);
  });

  it('Gegenbeispiel: ein gültiger Regelwert wird übernommen (2 Minuten bleiben 2 Minuten)', async () => {
    const { service, rendereEinstellungen, aendereZeitstrafe, zeitstrafeEreignis } = setup();

    rendereEinstellungen();
    aendereZeitstrafe(120);

    await service.initializeMatch('t1', scheduledMatch('mD'));
    await service.startMatch('t1', 'mD');
    expect(await zeitstrafeEreignis('t1', 'mD')).toBe(120);
  });
});
