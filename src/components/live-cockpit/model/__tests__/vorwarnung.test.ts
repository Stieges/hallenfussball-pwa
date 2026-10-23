/**
 * vorwarnungAktiv (Plan LT-3, K12): im letzten regulären Abschnitt, Uhr läuft oder steht, Restzeit des Spiels ≤ 3:00.
 * Szenarien: @SL-155 (ab 3:00), @SL-156 (3:01 noch nicht). Die Restzeit kommt aus `restzeitSpielMs` (eine Rechnung).
 */
import { describe, it, expect } from 'vitest';
import { VORWARNUNG_MS, vorwarnungAktiv } from '../vorwarnung';
import type { CockpitPhase, CockpitZustand } from '../cockpitPhase';
import { restzeitSpielMs } from '../restzeit';
import { makePhaseView } from '../../__tests__/cockpitFixtures';

const phase = (zustand: CockpitZustand, extra: Partial<CockpitPhase> = {}): CockpitPhase => ({
  zustand, abschnittArt: 'regulaer', abschnitt: 2, abschnitte: 2, letzterAbschnitt: true, ...extra,
});

describe('vorwarnungAktiv', () => {
  it('@SL-155 Restzeit 3:00 im zweiten Abschnitt → aktiv', () => {
    expect(vorwarnungAktiv(phase('laeuft'), 180_000)).toBe(true);
    expect(VORWARNUNG_MS).toBe(180_000);
  });
  it('@SL-156 Restzeit 3:01 → nicht aktiv', () => {
    expect(vorwarnungAktiv(phase('laeuft'), 181_000)).toBe(false);
  });
  it('@SL-155 auch bei angehaltener Uhr (pausiert) aktiv', () => {
    expect(vorwarnungAktiv(phase('pausiert'), 120_000)).toBe(true);
  });
  it('Gegenbeispiel: erster Abschnitt mit Spielrest 9:00 (bei 3:00 im ersten von zwei Abschnitten à 6 Min) → nicht aktiv', () => {
    const view = makePhaseView({ section: 1, sections: 2, sectionElapsedMs: 180_000, sectionLimitMs: 360_000, isLastRegularSection: false });
    expect(restzeitSpielMs(view)).toBe(540_000);
    expect(vorwarnungAktiv(phase('laeuft', { abschnitt: 1, letzterAbschnitt: false }), restzeitSpielMs(view))).toBe(false);
  });
  it.each<CockpitZustand>(['halbzeitpause', 'pauseVorVerlaengerung', 'vorAnpfiff', 'abgepfiffen', 'entscheidung', 'strafstoss', 'wartetAufHerkunft', 'keinSpiel'])(
    'Gegenbeispiel: im Zustand %s nicht aktiv', (zustand) => {
      expect(vorwarnungAktiv(phase(zustand), 60_000)).toBe(false);
    });
  it('Gegenbeispiel: in der Verlängerung nicht (kein letzter regulärer Abschnitt)', () => {
    expect(vorwarnungAktiv(phase('laeuft', { abschnittArt: 'verlaengerung' }), 60_000)).toBe(false);
  });
  it('ohne bekannte Restzeit (null) nicht aktiv', () => {
    expect(vorwarnungAktiv(phase('laeuft'), null)).toBe(false);
  });
});
