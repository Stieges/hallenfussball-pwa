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
 * (TournamentService.updateTournament → repository.save).
 * Cockpit-Seite auf dem Engine-Weg (A-08d1): Anpfiff = MATCH_START mit der Regel des
 * gespeicherten Turniers (`startEngineSpiel`), Zeitstrafe = `MatchCommands.timePenalty`;
 * gelesen wird die Dauer aus dem Engine-Stand (`state.penalties`).
 *
 * Gegenbeispiel: ein nicht angepfiffenes Spiel übernimmt die neue Regel sofort
 * (kein Festhalten am alten Stand bis zum Ende des laufenden Spiels).
 * Mutation: das laufende Spiel liest die Regel live aus dem Turnier → rot.
 */
import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MatchCockpitSettingsPanel } from '../../../components/match-cockpit/MatchCockpitSettingsPanel';
import { TournamentService } from '../../../core/services/TournamentService';
import {
  DEFAULT_MATCH_COCKPIT_SETTINGS,
  type MatchCockpitSettings,
  type Tournament,
} from '../../../types/tournament';
import type { ITournamentRepository } from '../../../core/repositories/ITournamentRepository';
import { startEngineSpiel, type EngineSpiel } from '../../../test/engineSpielFixture';

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
    get: vi.fn((_id: string) => Promise.resolve(gespeichert)),
    getAll: vi.fn(() => Promise.resolve([])),
    delete: vi.fn(() => Promise.resolve()),
  };
  const tournamentService = new TournamentService(repository as unknown as ITournamentRepository);

  const settings = (): MatchCockpitSettings => ({
    ...DEFAULT_MATCH_COCKPIT_SETTINGS,
    ...gespeichert.matchCockpitSettings,
  });

  /** Wie die Verwaltungsoberfläche: hält die Einstellungen im Zustand und speichert echt. */
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

  /** Anpfiff auf dem Engine-Weg mit der jeweils gespeicherten Turnierregel. */
  const anpfiff = async (phase: string | null = 'groupStage'): Promise<EngineSpiel> =>
    startEngineSpiel(await repository.get('t1'), phase);

  /** Zeitstrafe auf dem Engine-Weg; Dauer in Sekunden aus dem Engine-Stand. */
  const zeitstrafeSekunden = async (spiel: EngineSpiel): Promise<number | undefined> => {
    await spiel.commands.timePenalty(spiel.matchId, spiel.ctx, 'leitung', 'teama');
    const stand = spiel.value.engine.view(spiel.matchId)?.result.state;
    const letzte = stand?.penalties.at(-1);
    return letzte === undefined ? undefined : letzte.durationMs / 1000;
  };

  return { repository, rendereEinstellungen, aendereZeitstrafe, anpfiff, zeitstrafeSekunden };
}

describe('B-04d @W2A-029 – Spielregel-Änderung wirkt ab dem nächsten Anpfiff', () => {
  // erwartet rot bis B-10b1/A-27 – Befund C-KO-RUNDENREGEL-SERVER bzw. ZA-1 (task-GB5-plan.md); Markierung entfernen, sobald grün
  // (Engine-Weg: die Zeitstrafen-Dauer der Startregel ist fest 120 s, matchCockpitSettings wird nicht übernommen.)
  it.fails('Pflichttest: laufendes Spiel rechnet weiter mit 2 Minuten, danach angepfiffenes Spiel mit 1 Minute', async () => {
    const { repository, rendereEinstellungen, aendereZeitstrafe, anpfiff, zeitstrafeSekunden } = setup();

    // Spiel A angepfiffen, solange die Regel „Zeitstrafe 2 Minuten" gilt
    const spielA = await anpfiff();
    rendereEinstellungen();

    // Turnierleitung ändert die Regel auf 1 Minute (echter Speicherweg)
    aendereZeitstrafe(60);
    expect(repository.save).toHaveBeenCalled();
    expect(screen.getByTestId('settings-time-penalty-duration')).toHaveValue('60');

    // Das laufende Spiel rechnet weiter mit 2 Minuten
    expect(await zeitstrafeSekunden(spielA)).toBe(120);

    // Ein danach angepfiffenes Spiel gilt 1 Minute
    const spielB = await anpfiff();
    expect(await zeitstrafeSekunden(spielB)).toBe(60);
  });

  // erwartet rot bis B-10b1/A-27 – Befund C-KO-RUNDENREGEL-SERVER bzw. ZA-1 (task-GB5-plan.md); Markierung entfernen, sobald grün
  it.fails('Gegenbeispiel: ein nicht angepfiffenes Spiel übernimmt die neue Regel sofort', async () => {
    const { rendereEinstellungen, aendereZeitstrafe, anpfiff, zeitstrafeSekunden } = setup();

    // Spiel C ist eingerichtet, aber noch nicht angepfiffen
    rendereEinstellungen();
    aendereZeitstrafe(60);

    // Beim Anpfiff gilt die neue Regel ohne Übergang
    const spielC = await anpfiff();
    expect(await zeitstrafeSekunden(spielC)).toBe(60);
  });

  it('Gegenbeispiel: ein gültiger Regelwert wird übernommen (2 Minuten bleiben 2 Minuten)', async () => {
    const { rendereEinstellungen, aendereZeitstrafe, anpfiff, zeitstrafeSekunden } = setup();

    rendereEinstellungen();
    aendereZeitstrafe(120);

    const spielD = await anpfiff();
    expect(await zeitstrafeSekunden(spielD)).toBe(120);
  });
});
