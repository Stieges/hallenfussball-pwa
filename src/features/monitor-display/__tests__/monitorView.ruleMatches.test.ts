/**
 * @ZM-138: Die Spiele für die Folienregeln tragen ihre Vorlaufzeit – die Pausendauer des Turniers, mindestens 5 Minuten.
 */
import { describe, it, expect } from 'vitest';
import { buildMonitorRuleMatches, buildMonitorView } from '../monitorView';
import { buildTournament, withPlayoffs } from './monitorFixture';

function regelSpiele(overrides: Parameters<typeof buildTournament>[0]) {
  const turnier = buildTournament({ date: '2026-10-10', matches: withPlayoffs().map(m => (m.id.startsWith('po-') ? { ...m, isFinal: true } : m)), ...overrides });
  return buildMonitorRuleMatches(buildMonitorView(turnier), turnier);
}

describe('buildMonitorRuleMatches – Vorlaufzeit je Spiel (@ZM-138)', () => {
  it('Gruppenspiele: Pause 8 Minuten → Vorlaufzeit 8; Pause 3 → 5 (Minimum)', () => {
    expect(regelSpiele({ groupPhaseBreakDuration: 8 }).find(m => m.id === 'match-9')?.vorlaufMin).toBe(8);
    expect(regelSpiele({ groupPhaseBreakDuration: 3 }).find(m => m.id === 'match-9')?.vorlaufMin).toBe(5);
  });

  it('Finalrunde: eigene Pause der Finalrunde; ohne sie die der Gruppenphase', () => {
    const eigene = regelSpiele({ groupPhaseBreakDuration: 3, finalRoundBreakDuration: 9 });
    expect(eigene.find(m => m.id === 'po-hf1')?.vorlaufMin).toBe(9);
    expect(eigene.find(m => m.id === 'match-9')?.vorlaufMin).toBe(5);
    const ohne = regelSpiele({ groupPhaseBreakDuration: 7, finalRoundBreakDuration: undefined });
    expect(ohne.find(m => m.id === 'po-hf1')?.vorlaufMin).toBe(7);
  });

  it('trägt Anstoß (Turnierdatum + Uhrzeit), Feld und geplant/läuft aus der Ansicht', () => {
    const spiel9 = regelSpiele({}).find(m => m.id === 'match-9');
    expect(spiel9).toMatchObject({ field: 1, isUpcoming: true, isLive: false, kickoff: { date: '2026-10-10', time: '14:40' } });
    expect(regelSpiele({}).find(m => m.id === 'match-7')).toMatchObject({ isLive: true, isUpcoming: false });
  });
});
