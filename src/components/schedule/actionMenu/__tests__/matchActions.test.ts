/**
 * @SL-193 Tabelle des Szenariogrundrisses, Zeile für Zeile aus dem Gherkin (nicht am Code abgelesen):
 *
 *   | Runde        | Zustand | Aktionen der Turnierleitung                                                                                          | Helfer              |
 *   | Gruppenphase | geplant | Ergebnis eintragen, Im Cockpit anpfeifen, Ab hier verschieben, Schiedsrichter ändern, Feld ändern, Nicht angetreten | Zum Cockpit         |
 *   | Gruppenphase | läuft   | Zum Cockpit, Spiel beenden und Ergebnis eintragen                                                                    | Zum Cockpit         |
 *   | Gruppenphase | beendet | Ergebnis korrigieren, Protokoll ansehen                                                                              | Protokoll ansehen   |
 *   | Finalrunde   | (gleich)                                                                                                                                             |
 *
 * Die Runde ändert nichts: die Regel kennt nur Zustand und Recht. Dazu @ZP-093 (angepfiffen: kein Schiedsrichter, kein Feld) und
 * @HE-042 (Helfer: nur Spielbetrieb).
 */
import { describe, it, expect } from 'vitest';
import type { ViewMatchStatus } from '../../../../core/view';
import { actionPhaseOf, matchActionsFor, type MatchActionId, type MatchActionRights, type MatchActionWiring } from '../matchActions';

const ALL_WIRED: MatchActionWiring = { enterResult: true, cockpit: true, shiftFrom: true, referee: true, field: true, forfeit: true, correct: true, endAndEnter: true };
const LEITUNG: MatchActionRights = { lead: true, play: true, schedule: true };
const HELFER: MatchActionRights = { lead: false, play: true, schedule: false };

const actions = (status: ViewMatchStatus | undefined, rights: MatchActionRights, wired: MatchActionWiring = ALL_WIRED): MatchActionId[] =>
  matchActionsFor({ status, rights, wired });

const TABELLE: ReadonlyArray<{ zustand: string; status: ViewMatchStatus; leitung: MatchActionId[]; helfer: MatchActionId[] }> = [
  { zustand: 'geplant', status: 'scheduled', leitung: ['enterResult', 'kickOff', 'shiftFrom', 'changeReferee', 'changeField', 'forfeit'], helfer: ['toCockpit'] },
  { zustand: 'läuft', status: 'running', leitung: ['toCockpit', 'endAndEnter'], helfer: ['toCockpit'] },
  { zustand: 'beendet', status: 'finished', leitung: ['correct', 'protocol'], helfer: ['protocol'] },
];

describe('@SL-193 Aktionen je Zustand und Recht (Regel-Funktion)', () => {
  for (const runde of ['Gruppenphase', 'Finalrunde']) {
    for (const zeile of TABELLE) {
      it(`@SL-193 ${runde} ${zeile.zustand}: Turnierleitung sieht genau ${zeile.leitung.join(', ')}`, () => {
        expect(actions(zeile.status, LEITUNG)).toEqual(zeile.leitung);
      });
      it(`@SL-193 ${runde} ${zeile.zustand}: der Helfer sieht nur ${zeile.helfer.join(', ')}`, () => {
        expect(actions(zeile.status, HELFER)).toEqual(zeile.helfer);
      });
    }
  }

  it('@SL-193 „unterbrochen“ gilt als läuft', () => {
    expect(actionPhaseOf('paused')).toBe('running');
    expect(actions('paused', LEITUNG)).toEqual(['toCockpit', 'endAndEnter']);
  });

  it('@SL-193 ohne Ansicht gilt das Spiel als geplant', () => {
    expect(actions(undefined, HELFER)).toEqual(['toCockpit']);
  });

  it('@ZP-093 ein angepfiffenes Spiel (läuft, Pause, beendet) bietet weder „Schiedsrichter ändern“ noch „Feld ändern“ noch „Ab hier verschieben“', () => {
    for (const status of ['running', 'paused', 'finished'] as const) {
      const list = actions(status, LEITUNG);
      expect(list).not.toContain('changeReferee');
      expect(list).not.toContain('changeField');
      expect(list).not.toContain('shiftFrom');
    }
  });

  it('@ZP-040 ohne Recht „Zeitplan ändern“ fehlen Verschieben, Schiedsrichter und Feld, auch bei der Turnierleitung im Spielbetrieb', () => {
    expect(actions('scheduled', { lead: true, play: true, schedule: false })).toEqual(['enterResult', 'kickOff', 'forfeit']);
  });

  it('@HE-042 @FU-113 Gegenbeispiel: der Helfer bekommt nie „Ergebnis korrigieren“, „Ergebnis eintragen“ oder „Spiel beenden und Ergebnis eintragen“', () => {
    for (const status of ['scheduled', 'running', 'finished', 'awarded', 'cancelled'] as const) {
      const list = actions(status, HELFER);
      expect(list).not.toContain('correct');
      expect(list).not.toContain('enterResult');
      expect(list).not.toContain('endAndEnter');
      expect(list).not.toContain('forfeit');
    }
  });

  it('kein stummer Knopf: ein nicht angeschlossener Weg erscheint nicht (hier: kein Korrektur-Handler, ein einziges Feld, keine Schiedsrichter)', () => {
    const wired = { ...ALL_WIRED, correct: false, field: false, referee: false };
    expect(actions('finished', LEITUNG, wired)).toEqual(['protocol']);
    expect(actions('scheduled', LEITUNG, wired)).toEqual(['enterResult', 'kickOff', 'shiftFrom', 'forfeit']);
  });

  it('nach dem Turnierabschluss (alle Rechte verneint) bleibt nur das Protokoll beendeter Spiele', () => {
    const closed = { lead: false, play: false, schedule: false };
    expect(actions('scheduled', closed)).toEqual([]);
    expect(actions('finished', closed)).toEqual(['protocol']);
  });

  it('@W2A-026 gewertet („nicht angetreten“): die Turnierleitung kann die Wertung zurücknehmen, der Helfer nichts', () => {
    expect(actions('awarded', LEITUNG)).toEqual(['revokeForfeit']);
    expect(actions('awarded', HELFER)).toEqual([]);
  });

  it('@FU-093 abgesetzt: die Turnierleitung kann trotzdem ein Ergebnis eintragen', () => {
    expect(actions('cancelled', LEITUNG)).toEqual(['enterResult']);
  });
});
