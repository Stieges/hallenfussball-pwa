/**
 * K.-o.-Schlüssel aus dem Plan (B-28a3-3b Fixrunde, Punkt 8). Zwei Wege: die Phase, wenn sie eine echte Runde nennt,
 * sonst die Zählung der Bracket-Spiele (Generator setzt `phase: 'final'`, C-FINALPHASE-AUS-ID).
 */
import { describe, expect, it } from 'vitest';
import type { ScheduledMatch } from '../../../core/generators';
import { koSlotsFrom } from '../koSlots';

function spiel(phase: string, finalType?: ScheduledMatch['finalType']): ScheduledMatch {
  return { phase, finalType } as unknown as ScheduledMatch;
}

describe('koSlotsFrom: Phase zuerst (Fixrunde Punkt 8)', () => {
  it('nennt die Phase eine Runde, gilt sie – auch wenn die Zählung anders läge', () => {
    // Drei Halbfinal-Spiele mit Phase „semifinal“ würden gezählt einen Rest ergeben; die Phase entscheidet.
    const plan = [spiel('semifinal'), spiel('semifinal'), spiel('quarterfinal'), spiel('final', 'final')];
    expect(koSlotsFrom(plan)).toEqual(['quarterfinal', 'semifinal', 'final']);
  });

  it('Phase „final“ ist beim Generator keine Runde: dann zählt die Bracket-Größe', () => {
    const plan = [
      spiel('final'), spiel('final'), spiel('final'), spiel('final'),
      spiel('final'), spiel('final'),
      spiel('final', 'final'),
      spiel('final', 'thirdPlace'),
    ];
    expect(koSlotsFrom(plan)).toEqual(['quarterfinal', 'semifinal', 'thirdPlace', 'final']);
  });

  it('Rest ohne Runde: die übrigen Spiele gelten als erste Runde und gehen nicht verloren', () => {
    const plan = [spiel('final'), spiel('final'), spiel('final'), spiel('final', 'final')];
    expect(koSlotsFrom(plan)).toEqual(['roundOf16', 'semifinal', 'final']);
  });
});
