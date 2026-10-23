/**
 * toScoreboardModel: die Tafel, nachdem die Turnierleitung das Spiel im Spielplan beendet hat (@FU-112, @FU-115):
 * „Ende – eingetragen im Spielplan“ statt einer gespielten Zeit, auf Toms Gerät mit „von Olli“; kein „Abgepfiffen“.
 * Die Übersetzung ist ein Schlüssel-Stub.
 */
import { describe, it, expect } from 'vitest';
import { toScoreboardModel, type ScoreboardInput } from '../toScoreboardModel';
import { cockpitPhaseOf } from '../cockpitPhase';
import { makeLiveMatch, makePhaseView } from '../../__tests__/cockpitFixtures';
import type { PhaseView } from '../../engine/phaseView';

const t = (key: string, o?: Record<string, unknown>) => (o ? `${key}:${JSON.stringify(o)}` : key);

function ende(view: Partial<PhaseView>, extra: Partial<ScoreboardInput> = {}): ScoreboardInput {
  const v = makePhaseView({ status: 'finished', playedMs: 480_000, plannedMs: 1_200_000, quittungRestMs: 20_000, ...view });
  return {
    match: makeLiveMatch({ status: 'FINISHED', homeScore: 3, awayScore: 1 }),
    phase: cockpitPhaseOf({ view: v, matchStatus: 'FINISHED', leer: null }),
    view: v, links: 'home', rechts: 'away', uhrArt: 'durchlaufend-letzte-minute-angehalten',
    eintraegeWarten: 0, helferAnfragen: 0, jetztMs: Date.parse('2026-11-28T10:20:00.000Z'),
    ...extra,
  };
}

describe('@FU-112 @FU-115 Tafel nach dem Beenden im Spielplan', () => {
  it('@FU-112 „Ende – eingetragen im Spielplan“ statt einer gespielten Zeit, kein „Abgepfiffen · 3:1 gespeichert“', () => {
    const m = toScoreboardModel(ende({ eingetragenImSpielplan: 'e9' }), t);
    expect(m.badge).toEqual({ kind: 'badge', state: 'ended' });
    expect(m.abschnittText).toBe('tafel.nachEnde.eingetragen');
    expect(m.uhr).toBeNull();
    expect(m.quittungText).toBeNull();
  });

  it('@FU-115 auf Toms Gerät mit Namen: „Ende – eingetragen im Spielplan von Olli“', () => {
    const m = toScoreboardModel(ende({ eingetragenImSpielplan: 'e9' }, { eingetragenVon: 'Olli' }), t);
    expect(m.abschnittText).toBe('tafel.nachEnde.eingetragenVon:{"name":"Olli"}');
  });

  it('Gegenbeispiel: abgepfiffen im Cockpit -- „Gespielt 8:00 von 20:00“ und die Quittung, kein Spielplan-Text', () => {
    const m = toScoreboardModel(ende({ eingetragenImSpielplan: null }, { eingetragenVon: 'Olli' }), t);
    expect(m.abschnittText).toBeNull();
    expect(m.uhr).toMatchObject({ label: 'tafel.uhr.gespielt', rest: '8:00' });
    expect(m.quittungText).toBe('tafel.quittung:{"links":3,"rechts":1}');
  });
});
