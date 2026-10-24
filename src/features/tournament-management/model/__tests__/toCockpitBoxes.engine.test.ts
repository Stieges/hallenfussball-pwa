/**
 * @SL-176 Engine-Spiel nach dem Anpfiff mit Leibchen – auch ohne Netz (Plan Cockpit v2 A2/M3).
 * Die Kette ist rein lokal: Anpfiff schreibt `kit` (`defaultKit`) in den MATCH_START, die Überlagerung (`engineOverlayFields` → `applyEngineOverlay`)
 * setzt `kit` und `matchStatus` am Spiel des Turniers, das `ManagementTab` bekommt, und `toCockpitBoxes` zeigt daraus die Weste. Kein Netz, kein Server.
 */
import { describe, expect, it } from 'vitest';
import { reduceMatch } from '../../../../core/match';
import type { EngineEvent, MatchContext } from '../../../../core/match';
import { applyEngineOverlay, engineOverlayFields } from '../../../../core/match/client';
import type { MatchEngineView } from '../../../../core/match/client';
import { defaultKit } from '../../../../core/models/kit';
import { teamSlot } from '../../../../core/models/matchSlot';
import { hfEvent, hfRules, T0 } from '../../../../core/match/client/__tests__/overtimeFixtures';
import type { Match, Team } from '../../../../types/tournament';
import { toCockpitBoxes } from '../toCockpitBoxes';

const HEIM = '00000000-0000-4000-8000-000000000001';
const GAST = '00000000-0000-4000-8000-000000000006';
const CTX: MatchContext = { matchId: 'spiel-3', teamAId: HEIM, teamBId: GAST };
const BLAU = '#1565C0';
const NAVY = '#0D1B4C';
const GELB = '#FFCC00';

const teams: Team[] = [{ id: HEIM, name: 'FC Nord', colors: { primary: BLAU } }, { id: GAST, name: 'DJK Berg', colors: { primary: NAVY } }];
const spiel: Match = { id: 'spiel-3', matchNumber: 3, round: 1, field: 1, slotA: teamSlot(HEIM), slotB: teamSlot(GAST), matchStatus: 'scheduled' };

function nachAnpfiff(kit: ReturnType<typeof defaultKit>) {
  const log: EngineEvent[] = [hfEvent('MATCH_START', T0, 1, null, { payload: { rules: hfRules('overtime-then-shootout'), kit } })];
  const view: MatchEngineView = { result: { state: reduceMatch(log, CTX).state, localRejected: [], needsFullReload: false }, log, confirmedCount: 0 };
  const turnier = { teams, matches: [spiel], bibColor: undefined };
  const ueberlagert = applyEngineOverlay(turnier, new Map([[spiel.id, engineOverlayFields(view, CTX)]]));
  return { vorher: toCockpitBoxes(turnier, spiel.id), nachher: toCockpitBoxes(ueberlagert, spiel.id) };
}

describe('@SL-176 Weste nach dem Anpfiff aus dem lokalen Engine-Log (ohne Netz)', () => {
  it('Blau gegen Navy (ΔE unter 30): der Anpfiff gibt dem Heim-Team Leibchen, das Cockpit zeigt Gelb mit blauen Streifen und Leibchen-Zeichen', () => {
    const kit = defaultKit(spiel, teams, {});
    expect(kit.bibSide).toBe('a');
    const { nachher } = nachAnpfiff(kit);
    expect(nachher?.home).toEqual({ fill: { kind: 'vest', center: GELB, stripes: BLAU }, bib: true });
    expect(nachher?.away).toEqual({ fill: { kind: 'solid', color: NAVY }, bib: false });
  });

  it('Gegenbeispiel: vor dem Anpfiff zeigt das geplante Spiel die Teamfarben ohne Leibchen', () => {
    const { vorher } = nachAnpfiff(defaultKit(spiel, teams, {}));
    expect(vorher?.home.bib).toBe(false);
    expect(vorher?.home.fill).toEqual({ kind: 'solid', color: BLAU });
  });

  it('Gegenbeispiel: unterscheidbare Farben (Rot gegen Weiß) bekommen keine Leibchen', () => {
    const rotWeiss: Team[] = [{ id: HEIM, name: 'FC Nord', colors: { primary: '#C62828' } }, { id: GAST, name: 'DJK Berg', colors: { primary: '#FFFFFF' } }];
    const kit = defaultKit(spiel, rotWeiss, {});
    expect(kit.bibSide).toBeUndefined();
  });
});
