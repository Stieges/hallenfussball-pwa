/**
 * @RE-007 (Beispielzeile 3): Ein Spiel trägt in der Datenbank einen Wert, den dieser App-Stand nicht kennt. Die Zeile wird bei
 * JEDEM Cloud-Lesen wieder gelesen (Turnier, Zuschauer-Seite, Monitor) – gemeldet wird genau einmal je Spiel und Angabe und Sitzung.
 * Verhalten bleibt: das Spiel bleibt stehen, die Angabe fehlt (Rückgabewert unverändert).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const captureFeatureError = vi.hoisted(() => vi.fn());
vi.mock('../../../lib/sentry', () => ({ captureFeatureError }));

import { mapMatchFromSupabase } from '../supabaseMappers';
import { resetReportedOnceForTest } from '../reportOnce';
import { createMatchRow } from '../../../../tests/factories/supabase';
import { testUuid } from '../../../test/testIds';

const NORD = testUuid(1);
const SUED = testUuid(2);
type Row = Parameters<typeof mapMatchFromSupabase>[0];

function row(id: number, extra: Record<string, unknown> = {}): Row {
  return { ...createMatchRow({ id: testUuid(id), team_a_id: NORD, team_b_id: SUED }), ...extra };
}
const read = (r: Row, times: number) => {
  for (let i = 0; i < times; i++) { mapMatchFromSupabase(r, '2026-01-15'); }
};
const calls = (feature: string) => captureFeatureError.mock.calls.filter((c) => c[2] === feature);

beforeEach(() => {
  captureFeatureError.mockClear();
  resetReportedOnceForTest();
});

describe('@RE-007 Datenfehler je Spielzeile werden einmal je Sitzung gemeldet', () => {
  it('@RE-007 unbekannte Leibchen-Entscheidung, hundertmal gelesen: genau 1 Bericht, Ergebnis jedes Mal gleich', () => {
    const r = row(301, { kit_decision: 'maybe' });
    const first = mapMatchFromSupabase(r, '2026-01-15');
    for (let i = 0; i < 99; i++) { expect(mapMatchFromSupabase(r, '2026-01-15')).toEqual(first); }
    expect(first).not.toHaveProperty('kitDecision');
    expect(calls('mapMatchKitDecision')).toHaveLength(1);
  });

  it('@RE-007 unbekannte Herkunft, hundertmal gelesen: genau 1 Bericht je Seite, die Herkunft fehlt weiter', () => {
    const r = row(302, { origin_a: { kind: 'bogus' } });
    read(r, 100);
    expect(calls('mapMatchOrigin')).toHaveLength(1);
    expect(mapMatchFromSupabase(r, '2026-01-15')).not.toHaveProperty('originA');
  });

  it('@RE-007 ungültige getragene Farbe, hundertmal gelesen: genau 1 Bericht', () => {
    read(row(303, { kit_color_a: 'gelb' }), 100);
    expect(calls('mapMatchKit')).toHaveLength(1);
  });

  it('@RE-007 zweites Spiel mit gleichem Fehler: eigener Bericht (je Spiel)', () => {
    read(row(301, { kit_decision: 'maybe' }), 50);
    read(row(304, { kit_decision: 'maybe' }), 50);
    expect(calls('mapMatchKitDecision')).toHaveLength(2);
  });

  it('@RE-007 zwei Angaben desselben Spiels (Herkunft A und Leibchen-Entscheidung): zwei Berichte; Herkunft A und B: auch zwei', () => {
    read(row(305, { origin_a: { kind: 'bogus' }, kit_decision: 'maybe' }), 100);
    expect(captureFeatureError).toHaveBeenCalledTimes(2);
    captureFeatureError.mockClear();
    read(row(306, { origin_a: { kind: 'bogus' }, origin_b: { kind: 'bogus' } }), 100);
    expect(calls('mapMatchOrigin')).toHaveLength(2);
  });

  it('@RE-007 Gegenbeispiel: gültige Werte werden hundertmal gelesen, ohne einen Bericht', () => {
    read(row(307, { kit_decision: 'bib', kit_color_a: '#FFCC00', kit_color_b: '#C62828', bib_side: 'a' }), 100);
    expect(captureFeatureError).not.toHaveBeenCalled();
  });

  it('@RE-007 nach dem Neuladen (Rücksetzer) meldet das Spiel wieder höchstens einmal', () => {
    const r = row(301, { kit_decision: 'maybe' });
    read(r, 10);
    resetReportedOnceForTest();
    read(r, 10);
    expect(calls('mapMatchKitDecision')).toHaveLength(2);
  });
});
