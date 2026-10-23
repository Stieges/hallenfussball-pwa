/**
 * @ZP-093 / Befund C-HALBZEIT-NICHT-LAUFEND: Ein Spiel in der Halbzeit (`paused` einer anderen Geräts) hat wie ein
 * laufendes einen Projektionsstand, kein Altergebnis – Grund `other`, nicht `resultEntered`.
 */
import { describe, it, expect } from 'vitest';
import { createMockMatch, createMockTournament } from '../../test/factories';
import type { Match } from '../../types/tournament';
import { notOnEngineReason } from '../useCockpitExecution';

const reasonFor = (status: string) => {
  const match = createMockMatch({ id: 'm', matchStatus: status as Match['matchStatus'], scoreA: 2, scoreB: 1 });
  return notOnEngineReason(createMockTournament({ matches: [match] }), 'm');
};

describe('notOnEngineReason (@ZP-093, C-HALBZEIT-NICHT-LAUFEND)', () => {
  it.each(['running', 'paused'])('@ZP-093 Spiel mit Status %s und Zwischenstand: Grund other', (status) => {
    expect(reasonFor(status)).toBe('other');
  });
  it('@ZP-093 Gegenbeispiel: ein beendetes Spiel bleibt resultEntered', () => {
    expect(reasonFor('finished')).toBe('resultEntered');
  });
});
