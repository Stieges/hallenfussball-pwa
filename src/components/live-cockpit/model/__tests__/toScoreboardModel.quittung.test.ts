/**
 * toScoreboardModel: Quittungszeile nach dem Abpfiff -- Testwerte und Wortlaut aus @SL-152
 * (`2026-10-02_spiel-leiten.md`, Variante C, bestätigt 2026-10-20): unter dem Abzeichen „Ende“ mit Endstand steht
 * „Abgepfiffen · 2:1 gespeichert“ (Endstand eingesetzt), nur in den 30 Sekunden nach dem Abpfiff. Der Code wurde erst
 * danach gelesen. Die Übersetzung ist ein Schlüssel-Stub: geprüft wird der Inhalt (Schlüssel, Endstand), nicht der Wortlaut.
 */
import { describe, it, expect } from 'vitest';
import { toScoreboardModel, type ScoreboardInput } from '../toScoreboardModel';
import { cockpitPhaseOf } from '../cockpitPhase';
import { makeLiveMatch, makePhaseView } from '../../__tests__/cockpitFixtures';
import type { PhaseView } from '../../engine/phaseView';

const t = (key: string, o?: Record<string, unknown>) => (o ? `${key}:${JSON.stringify(o)}` : key);

function input(view: Partial<PhaseView>, extra: Partial<ScoreboardInput> = {}, matchStatus: 'RUNNING' | 'FINISHED' = 'FINISHED'): ScoreboardInput {
  const v = makePhaseView({ sectionLimitMs: 360_000, ...view });
  return {
    match: makeLiveMatch({ status: matchStatus, homeScore: 2, awayScore: 1 }),
    phase: cockpitPhaseOf({ view: v, matchStatus, leer: null }),
    view: v, links: 'home', rechts: 'away', uhrArt: 'durchlaufend-letzte-minute-angehalten',
    eintraegeWarten: 0, helferAnfragen: 0, jetztMs: Date.parse('2026-11-28T10:20:00.000Z'),
    ...extra,
  };
}

describe('toScoreboardModel: Quittungszeile (@SL-152)', () => {
  it('@SL-152 abgepfiffen mit 2:1, Quittung läuft: die Zeile mit dem Endstand 2:1 steht unter „Ende“, das Abzeichen bleibt „Ende“', () => {
    const m = toScoreboardModel(input({ status: 'finished', quittungRestMs: 18_000 }), t);
    expect(m.quittungText).toBe('tafel.quittung:{"links":2,"rechts":1}');
    expect(m.badge).toEqual({ kind: 'badge', state: 'ended' });
  });

  it('@SL-152 der Endstand in der Zeile ist der tatsächliche: 3:0 statt fest 2:1', () => {
    const m = toScoreboardModel(input({ status: 'finished', quittungRestMs: 18_000 }, { match: makeLiveMatch({ status: 'FINISHED', homeScore: 3, awayScore: 0 }) }), t);
    expect(m.quittungText).toBe('tafel.quittung:{"links":3,"rechts":0}');
  });

  it('@SL-152 die Zeile folgt der Anzeigeseite der Tafel (Seiten getauscht: 1:2 wie die Stand-Kästen)', () => {
    const m = toScoreboardModel(input({ status: 'finished', quittungRestMs: 18_000 }, { links: 'away', rechts: 'home' }), t);
    expect(m.quittungText).toBe('tafel.quittung:{"links":1,"rechts":2}');
    expect([m.links.tore, m.rechts.tore]).toEqual([1, 2]);
  });

  it('@SL-152 Gegenbeispiel: vor dem Abpfiff (läuft) steht keine Quittungszeile', () => {
    const m = toScoreboardModel(input({ status: 'running', quittungRestMs: null }, {}, 'RUNNING'), t);
    expect(m.quittungText).toBeNull();
  });

  it('@SL-152 Gegenbeispiel: nach den 30 Sekunden (Restzeit 0) steht keine Quittungszeile mehr, das Abzeichen bleibt „Ende“', () => {
    const m = toScoreboardModel(input({ status: 'finished', quittungRestMs: 0 }), t);
    expect(m.quittungText).toBeNull();
    expect(m.badge).toEqual({ kind: 'badge', state: 'ended' });
  });

  it('@SL-152 Gegenbeispiel: ohne Quittungsfenster (Spiel ohne Abpfiffzeit, z. B. Ersatz-Ansicht) steht keine Zeile', () => {
    expect(toScoreboardModel(input({ status: 'finished', quittungRestMs: null }), t).quittungText).toBeNull();
  });

  it('@SL-152 Gegenbeispiel: ein ausgefallenes Spiel (skipped) ist nicht „abgepfiffen“ und bekommt keine Zeile', () => {
    expect(toScoreboardModel(input({ status: 'skipped', quittungRestMs: 18_000 }), t).quittungText).toBeNull();
  });
});
