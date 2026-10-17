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
 * src/components/match-settings/MatchCockpitSettingsPanel.tsx, Zeile
 * `settings-time-penalty-duration`) → echte Speicherstrecke
 * (TournamentService.updateTournament → repository.save).
 * Cockpit-Seite auf dem Engine-Weg (A-08d1): Einrichten ohne Anpfiff, Anpfiff = MATCH_START mit
 * `serverRulesFor` des jeweils gespeicherten Turniers, Zeitstrafe = `MatchCommands.timePenalty`;
 * gelesen wird die Dauer aus dem Engine-Stand (`state.penalties`).
 *
 * Mutation: das laufende Spiel liest die Regel live aus dem Turnier → rot.
 */
import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MatchCockpitSettingsPanel } from '../../../components/match-settings/MatchCockpitSettingsPanel';
import { TournamentService } from '../../../core/services/TournamentService';
import {
  DEFAULT_MATCH_COCKPIT_SETTINGS,
  type MatchCockpitSettings,
  type Tournament,
} from '../../../types/tournament';
import type { ITournamentRepository } from '../../../core/repositories/ITournamentRepository';
import {
  anpfiffEngineSpiel,
  einrichtenEngineSpiel,
  type EingerichtetesEngineSpiel,
  type EngineSpiel,
} from '../../../test/engineSpielFixture';

const GRUPPENPHASE = { phase: 'groupStage' } as const;

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

  /** Anpfiff auf dem Engine-Weg mit dem jeweils gespeicherten Turnier. */
  const anpfiff = async (spiel: EingerichtetesEngineSpiel): Promise<EngineSpiel> =>
    anpfiffEngineSpiel(spiel, await repository.get('t1'), GRUPPENPHASE);

  /** Zeitstrafe auf dem Engine-Weg; Dauer in Sekunden aus dem Engine-Stand. */
  const zeitstrafeSekunden = async (spiel: EingerichtetesEngineSpiel): Promise<number | undefined> => {
    await spiel.commands.timePenalty(spiel.matchId, spiel.ctx, 'leitung', 'teama');
    const stand = spiel.value.engine.view(spiel.matchId)?.result.state;
    const letzte = stand?.penalties.at(-1);
    return letzte === undefined ? undefined : letzte.durationMs / 1000;
  };

  return { repository, rendereEinstellungen, aendereZeitstrafe, anpfiff, zeitstrafeSekunden };
}

describe('B-04d @W2A-029 – Spielregel-Änderung wirkt ab dem nächsten Anpfiff', () => {
  it('(UI/Speicher) @W2A-029: die Zeitstrafe 1 Minute wird über die Einstellungen gespeichert und angezeigt', () => {
    const { repository, rendereEinstellungen, aendereZeitstrafe } = setup();

    rendereEinstellungen();
    aendereZeitstrafe(60);

    expect(repository.save).toHaveBeenCalled();
    expect(screen.getByTestId('settings-time-penalty-duration')).toHaveValue('60');
  });

  it('@W2A-029: das laufende Spiel rechnet weiter mit 2 Minuten', async () => {
    const { rendereEinstellungen, aendereZeitstrafe, anpfiff, zeitstrafeSekunden } = setup();

    // Spiel A angepfiffen, solange die Regel „Zeitstrafe 2 Minuten" gilt
    const spielA = await anpfiff(await einrichtenEngineSpiel());
    rendereEinstellungen();
    aendereZeitstrafe(60);

    expect(await zeitstrafeSekunden(spielA)).toBe(120);
  });

  // erwartet rot bis B-10b1/A-27 – Befund C-KO-RUNDENREGEL-SERVER bzw. ZA-1 (task-GB5-plan.md); Markierung entfernen, sobald grün
  // Engine-Weg: penaltySeconds der Startregel ist fest 120 s (serverRules.ts), matchCockpitSettings wird nicht übernommen.
  // Nach ZA-1 muss der Wert 60 grün werden. Gegenbeispiele, die dann aussagekräftig sein müssen: das laufende Spiel
  // (120 bleibt 120, heute gleichwertig mit dem festen Rückfall) und der Gegenbeispiel-Wert 120 (heute leer grün).
  it.fails('Pflichttest @W2A-029: ein danach angepfiffenes Spiel gilt 1 Minute', async () => {
    const { rendereEinstellungen, aendereZeitstrafe, anpfiff, zeitstrafeSekunden } = setup();

    rendereEinstellungen();
    aendereZeitstrafe(60);

    const spielB = await anpfiff(await einrichtenEngineSpiel());
    expect(await zeitstrafeSekunden(spielB)).toBe(60);
  });

  // erwartet rot bis B-10b1/A-27 – Befund C-KO-RUNDENREGEL-SERVER bzw. ZA-1 (task-GB5-plan.md); Markierung entfernen, sobald grün
  // Aussagekräftig nach ZA-1: das eingerichtete, nicht angepfiffene Spiel (vor der Änderung eingerichtet, erst nach der
  // Änderung angepfiffen) bekommt 60; heute bekommt es den festen Rückfall 120.
  it.fails('Gegenbeispiel @W2A-029: ein eingerichtetes, nicht angepfiffenes Spiel übernimmt die neue Regel sofort', async () => {
    const { rendereEinstellungen, aendereZeitstrafe, anpfiff, zeitstrafeSekunden } = setup();

    // Spiel C ist vor der Änderung eingerichtet, aber noch nicht angepfiffen
    const spielC = await einrichtenEngineSpiel();
    rendereEinstellungen();
    aendereZeitstrafe(60);

    // Beim Anpfiff gilt die neue Regel ohne Übergang
    expect(await zeitstrafeSekunden(await anpfiff(spielC))).toBe(60);
  });

  it('Gegenbeispiel @W2A-029: ein gültiger Regelwert wird übernommen (2 Minuten bleiben 2 Minuten)', async () => {
    // Heute leer grün: die Engine liefert immer 120 (fester Rückfall). Nach ZA-1 wird dieser Fall aussagekräftig,
    // weil er einen Wert ungleich dem festen Rückfall prüft.
    const { rendereEinstellungen, aendereZeitstrafe, anpfiff, zeitstrafeSekunden } = setup();

    rendereEinstellungen();
    aendereZeitstrafe(120);

    expect(await zeitstrafeSekunden(await anpfiff(await einrichtenEngineSpiel()))).toBe(120);
  });
});
