import { describe, it, expect } from 'vitest';
import {
  generatePlayoffMatches,
  presetHasSemifinals,
  presetHasQuarterfinals,
  getExpectedMatchCount,
} from '../playoffGenerator';
import type { PlayoffMatch } from '../playoffGenerator';

// =============================================================================
// Helpers
// =============================================================================

function getMatchIds(matches: PlayoffMatch[]): string[] {
  return matches.map(m => m.id);
}

function assertDependsOnConsistency(matches: PlayoffMatch[]): void {
  const ids = new Set(getMatchIds(matches));
  for (const match of matches) {
    if (match.dependsOn) {
      for (const dep of match.dependsOn) {
        expect(ids.has(dep), `${match.id} depends on ${dep} which doesn't exist`).toBe(true);
      }
    }
  }
}

// =============================================================================
// preset: 'none'
// =============================================================================

describe('generatePlayoffMatches preset=none', () => {
  it('returns empty array', () => {
    expect(generatePlayoffMatches(2, { preset: 'none' })).toEqual([]);
  });
});

// =============================================================================
// Edge case: < 2 groups
// =============================================================================

describe('generatePlayoffMatches with < 2 groups', () => {
  it('returns empty array for 1 group', () => {
    expect(generatePlayoffMatches(1, { preset: 'top-4' })).toEqual([]);
  });

  it('returns empty array for 0 groups', () => {
    expect(generatePlayoffMatches(0, { preset: 'final-only' })).toEqual([]);
  });
});

// =============================================================================
// preset: 'final-only'
// =============================================================================

describe('generatePlayoffMatches preset=final-only', () => {
  it('generates 1 final match for 2 groups', () => {
    const matches = generatePlayoffMatches(2, { preset: 'final-only' });
    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe('final');
    expect(matches[0].home).toBe('group-a-1st');
    expect(matches[0].away).toBe('group-b-1st');
    expect(matches[0].rank).toBe(1);
  });

  it('generates 1 final match for 4 groups (simplified)', () => {
    const matches = generatePlayoffMatches(4, { preset: 'final-only' });
    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe('final');
  });
});

// =============================================================================
// preset: 'top-4'
// =============================================================================

describe('generatePlayoffMatches preset=top-4', () => {
  it('generates 4 matches for 2 groups (2 semis + 3rd + final)', () => {
    const matches = generatePlayoffMatches(2, { preset: 'top-4' });
    expect(matches).toHaveLength(4);

    const ids = getMatchIds(matches);
    expect(ids).toContain('semi1');
    expect(ids).toContain('semi2');
    expect(ids).toContain('third-place');
    expect(ids).toContain('final');
  });

  it('uses cross-seeding for 2 groups', () => {
    const matches = generatePlayoffMatches(2, { preset: 'top-4' });
    const semi1 = matches.find(m => m.id === 'semi1')!;
    const semi2 = matches.find(m => m.id === 'semi2')!;

    // Cross: A2 vs B1, A1 vs B2
    expect(semi1.home).toBe('group-a-2nd');
    expect(semi1.away).toBe('group-b-1st');
    expect(semi2.home).toBe('group-a-1st');
    expect(semi2.away).toBe('group-b-2nd');
  });

  it('final depends on both semifinals', () => {
    const matches = generatePlayoffMatches(2, { preset: 'top-4' });
    const final = matches.find(m => m.id === 'final')!;
    expect(final.dependsOn).toContain('semi1');
    expect(final.dependsOn).toContain('semi2');
    expect(final.home).toBe('semi1-winner');
    expect(final.away).toBe('semi2-winner');
  });

  it('third place depends on both semifinals', () => {
    const matches = generatePlayoffMatches(2, { preset: 'top-4' });
    const thirdPlace = matches.find(m => m.id === 'third-place')!;
    expect(thirdPlace.dependsOn).toContain('semi1');
    expect(thirdPlace.dependsOn).toContain('semi2');
    expect(thirdPlace.home).toBe('semi1-loser');
    expect(thirdPlace.away).toBe('semi2-loser');
    expect(thirdPlace.rank).toBe(3);
  });

  it('has consistent dependsOn references', () => {
    assertDependsOnConsistency(generatePlayoffMatches(2, { preset: 'top-4' }));
  });
});

// =============================================================================
// preset: 'top-8'
// =============================================================================

describe('generatePlayoffMatches preset=top-8', () => {
  it('falls back to top-4 for 2 groups', () => {
    const matches = generatePlayoffMatches(2, { preset: 'top-8' });
    // Same as top-4
    expect(matches).toHaveLength(4);
    expect(getMatchIds(matches)).toContain('semi1');
    expect(getMatchIds(matches)).not.toContain('qf1');
  });

  it('generates quarterfinals + semis + placements for 4 groups', () => {
    const matches = generatePlayoffMatches(4, { preset: 'top-8' });

    const ids = getMatchIds(matches);
    // 4 QF + 2 SF + place56 + place78 + third + final = 10
    expect(ids).toContain('qf1');
    expect(ids).toContain('qf2');
    expect(ids).toContain('qf3');
    expect(ids).toContain('qf4');
    expect(ids).toContain('semi1');
    expect(ids).toContain('semi2');
    expect(ids).toContain('place56');
    expect(ids).toContain('place78');
    expect(ids).toContain('third-place');
    expect(ids).toContain('final');
    expect(matches).toHaveLength(10);
  });

  it('cross-seeds quarterfinals for 4 groups', () => {
    const matches = generatePlayoffMatches(4, { preset: 'top-8' });
    const qf1 = matches.find(m => m.id === 'qf1')!;
    const qf4 = matches.find(m => m.id === 'qf4')!;

    expect(qf1.home).toBe('group-a-1st');
    expect(qf1.away).toBe('group-d-2nd');
    expect(qf4.home).toBe('group-d-1st');
    expect(qf4.away).toBe('group-a-2nd');
  });

  it('semifinals depend on quarterfinals', () => {
    const matches = generatePlayoffMatches(4, { preset: 'top-8' });
    const semi1 = matches.find(m => m.id === 'semi1')!;
    expect(semi1.dependsOn).toContain('qf1');
    expect(semi1.dependsOn).toContain('qf4');
    expect(semi1.home).toBe('qf1-winner');
    expect(semi1.away).toBe('qf4-winner');
  });

  it('placement matches for places 5-8', () => {
    const matches = generatePlayoffMatches(4, { preset: 'top-8' });
    const place56 = matches.find(m => m.id === 'place56')!;
    const place78 = matches.find(m => m.id === 'place78')!;

    expect(place56.rank).toEqual([5, 6]);
    expect(place56.home).toBe('qf1-loser');
    expect(place56.away).toBe('qf2-loser');
    expect(place78.rank).toEqual([7, 8]);
    expect(place78.home).toBe('qf3-loser');
    expect(place78.away).toBe('qf4-loser');
  });

  it('has consistent dependsOn references', () => {
    assertDependsOnConsistency(generatePlayoffMatches(4, { preset: 'top-8' }));
  });
});

// =============================================================================
// preset: 'top-16'
// =============================================================================

describe('generatePlayoffMatches preset=top-16', () => {
  it('falls back to top-8 for < 8 groups', () => {
    const matchesFor4 = generatePlayoffMatches(4, { preset: 'top-16' });
    const matchesTop8 = generatePlayoffMatches(4, { preset: 'top-8' });
    expect(matchesFor4).toEqual(matchesTop8);
  });

  it('falls back to top-4 for 2 groups', () => {
    const matches = generatePlayoffMatches(2, { preset: 'top-16' });
    expect(matches).toHaveLength(4);
    expect(getMatchIds(matches)).toContain('semi1');
  });

  it('generates full R16 bracket for 8 groups', () => {
    const matches = generatePlayoffMatches(8, { preset: 'top-16' });
    const ids = getMatchIds(matches);

    // 8 R16 + 4 QF + 2 SF + third + final = 16
    expect(matches).toHaveLength(16);
    expect(ids.filter(id => id.startsWith('r16-'))).toHaveLength(8);
    expect(ids.filter(id => id.startsWith('qf'))).toHaveLength(4);
    expect(ids).toContain('semi1');
    expect(ids).toContain('semi2');
    expect(ids).toContain('third-place');
    expect(ids).toContain('final');
  });

  it('R16 uses mirror seeding (A1 vs H2, B1 vs G2, ...)', () => {
    const matches = generatePlayoffMatches(8, { preset: 'top-16' });
    const r161 = matches.find(m => m.id === 'r16-1')!;
    const r168 = matches.find(m => m.id === 'r16-8')!;

    expect(r161.home).toBe('group-a-1st');
    expect(r161.away).toBe('group-h-2nd');
    expect(r168.home).toBe('group-h-1st');
    expect(r168.away).toBe('group-a-2nd');
  });

  it('QF depends on R16 matches', () => {
    const matches = generatePlayoffMatches(8, { preset: 'top-16' });
    const qf1 = matches.find(m => m.id === 'qf1')!;
    expect(qf1.dependsOn).toContain('r16-1');
    expect(qf1.dependsOn).toContain('r16-8');
    expect(qf1.home).toBe('r16-1-winner');
    expect(qf1.away).toBe('r16-8-winner');
  });

  it('has consistent dependsOn references', () => {
    assertDependsOnConsistency(generatePlayoffMatches(8, { preset: 'top-16' }));
  });
});

// =============================================================================
// preset: 'all-places'
// =============================================================================

describe('generatePlayoffMatches preset=all-places', () => {
  it('generates all placement matches for 2 groups (default groupSizes)', () => {
    const matches = generatePlayoffMatches(2, { preset: 'all-places' });
    const ids = getMatchIds(matches);

    // 2 semis + place78 + place56 + third + final = 6
    expect(ids).toContain('semi1');
    expect(ids).toContain('semi2');
    expect(ids).toContain('place78-direct');
    expect(ids).toContain('place56-direct');
    expect(ids).toContain('third-place');
    expect(ids).toContain('final');
    expect(matches).toHaveLength(6);
  });

  it('skips place78 when groups have < 4 teams', () => {
    const matches = generatePlayoffMatches(2, { preset: 'all-places' }, { A: 3, B: 3 });
    const ids = getMatchIds(matches);

    expect(ids).not.toContain('place78-direct');
    expect(ids).toContain('place56-direct');
    // 2 semis + place56 + third + final = 5
    expect(matches).toHaveLength(5);
  });

  it('skips both placement matches when groups have < 3 teams', () => {
    const matches = generatePlayoffMatches(2, { preset: 'all-places' }, { A: 2, B: 2 });
    const ids = getMatchIds(matches);

    expect(ids).not.toContain('place78-direct');
    expect(ids).not.toContain('place56-direct');
    // 2 semis + third + final = 4
    expect(matches).toHaveLength(4);
  });

  it('place56 uses 3rd place from each group', () => {
    const matches = generatePlayoffMatches(2, { preset: 'all-places' });
    const place56 = matches.find(m => m.id === 'place56-direct')!;

    expect(place56.home).toBe('group-a-3rd');
    expect(place56.away).toBe('group-b-3rd');
    expect(place56.rank).toEqual([5, 6]);
  });

  it('place78 uses 4th place from each group', () => {
    const matches = generatePlayoffMatches(2, { preset: 'all-places' });
    const place78 = matches.find(m => m.id === 'place78-direct')!;

    expect(place78.home).toBe('group-a-4th');
    expect(place78.away).toBe('group-b-4th');
    expect(place78.rank).toEqual([7, 8]);
  });

  it('final depends on all placement matches', () => {
    const matches = generatePlayoffMatches(2, { preset: 'all-places' });
    const final = matches.find(m => m.id === 'final')!;

    expect(final.dependsOn).toContain('semi1');
    expect(final.dependsOn).toContain('semi2');
    expect(final.dependsOn).toContain('third-place');
    expect(final.dependsOn).toContain('place56-direct');
    expect(final.dependsOn).toContain('place78-direct');
  });

  it('falls back to top-8 for 4+ groups', () => {
    const matches = generatePlayoffMatches(4, { preset: 'all-places' });
    const matchesTop8 = generatePlayoffMatches(4, { preset: 'top-8' });
    expect(matches).toEqual(matchesTop8);
  });

  it('falls back to top-4 for 3 groups', () => {
    const matches = generatePlayoffMatches(3, { preset: 'all-places' });
    const matchesTop4 = generatePlayoffMatches(3, { preset: 'top-4' });
    expect(matches).toEqual(matchesTop4);
  });

  it('has consistent dependsOn references', () => {
    assertDependsOnConsistency(generatePlayoffMatches(2, { preset: 'all-places' }));
  });
});

// =============================================================================
// presetHasSemifinals
// =============================================================================

describe('presetHasSemifinals', () => {
  it('returns true for top-4, top-8, all-places', () => {
    expect(presetHasSemifinals('top-4')).toBe(true);
    expect(presetHasSemifinals('top-8')).toBe(true);
    expect(presetHasSemifinals('all-places')).toBe(true);
  });

  it('returns false for none, final-only, top-16', () => {
    expect(presetHasSemifinals('none')).toBe(false);
    expect(presetHasSemifinals('final-only')).toBe(false);
    expect(presetHasSemifinals('top-16')).toBe(false);
  });
});

// =============================================================================
// presetHasQuarterfinals
// =============================================================================

describe('presetHasQuarterfinals', () => {
  it('returns true for top-8, all-places', () => {
    expect(presetHasQuarterfinals('top-8')).toBe(true);
    expect(presetHasQuarterfinals('all-places')).toBe(true);
  });

  it('returns false for none, final-only, top-4, top-16', () => {
    expect(presetHasQuarterfinals('none')).toBe(false);
    expect(presetHasQuarterfinals('final-only')).toBe(false);
    expect(presetHasQuarterfinals('top-4')).toBe(false);
    expect(presetHasQuarterfinals('top-16')).toBe(false);
  });
});

// =============================================================================
// getExpectedMatchCount
// =============================================================================

describe('getExpectedMatchCount', () => {
  it('returns 0 for none', () => {
    expect(getExpectedMatchCount('none', 2)).toBe(0);
  });

  it('returns 1 for final-only', () => {
    expect(getExpectedMatchCount('final-only', 2)).toBe(1);
  });

  it('returns 4 for top-4 with 2 groups', () => {
    expect(getExpectedMatchCount('top-4', 2)).toBe(4);
  });

  it('returns 10 for top-8 with 4 groups', () => {
    expect(getExpectedMatchCount('top-8', 4)).toBe(10);
  });

  it('returns 16 for top-16 with 8 groups', () => {
    expect(getExpectedMatchCount('top-16', 8)).toBe(16);
  });

  it('returns 6 for all-places with 2 groups (default sizes)', () => {
    expect(getExpectedMatchCount('all-places', 2)).toBe(6);
  });
});
