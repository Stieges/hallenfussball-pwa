import { describe, it, expect } from 'vitest';
import { getEffectiveScore } from '../matchScore';

describe('getEffectiveScore', () => {
  it('fehlende overtimeScore-Felder werden als 0 behandelt', () => {
    const result = getEffectiveScore({
      homeScore: 2,
      awayScore: 1,
    });
    expect(result).toEqual({ home: 2, away: 1 });
  });

  it('addiert regular + overtime Tore wenn beide gesetzt', () => {
    const result = getEffectiveScore({
      homeScore: 1,
      awayScore: 1,
      overtimeScoreA: 1,
      overtimeScoreB: 0,
    });
    expect(result).toEqual({ home: 2, away: 1 });
  });

  it('0:0 (regulär) + 0:1 (Verlängerung) = 0:1', () => {
    const result = getEffectiveScore({
      homeScore: 0,
      awayScore: 0,
      overtimeScoreA: 0,
      overtimeScoreB: 1,
    });
    expect(result).toEqual({ home: 0, away: 1 });
  });
});
