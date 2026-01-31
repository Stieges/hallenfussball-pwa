import { describe, it, expect } from 'vitest';
import {
  generateDisplayNames,
  selectVariant,
  getDisplayNames,
} from '../teamDisplayNames';

// =============================================================================
// STAGE 1: LEGAL CLEANUP
// =============================================================================

describe('generateDisplayNames — Legal Cleanup', () => {
  it('removes "e.V." suffix', () => {
    const r = generateDisplayNames('Sportverein Musterstadt e.V.');
    expect(r.medium).not.toContain('e.V.');
  });

  it('removes "e. V." suffix (with space)', () => {
    const r = generateDisplayNames('SV Musterstadt e. V.');
    expect(r.medium).not.toContain('e. V.');
  });

  it('removes "eV" suffix (without dots)', () => {
    const r = generateDisplayNames('SV Musterstadt eV');
    expect(r.medium).not.toContain('eV');
  });

  it('removes GmbH', () => {
    const r = generateDisplayNames('Sportclub GmbH Teststadt');
    expect(r.medium).not.toContain('GmbH');
  });

  it('removes year patterns (4-digit)', () => {
    const r = generateDisplayNames('FC Teststadt 1920');
    expect(r.medium).not.toContain('1920');
  });

  it('removes "von 1928" pattern', () => {
    const r = generateDisplayNames('SV Teststadt von 1928');
    expect(r.medium).not.toContain('1928');
    expect(r.medium).not.toContain('von');
  });

  it('removes club prefix SC', () => {
    const r = generateDisplayNames('SC Freiburg');
    expect(r.medium).toBe('Freiburg');
  });

  it('removes club prefix SV', () => {
    const r = generateDisplayNames('SV Darmstadt');
    expect(r.medium).toBe('Darmstadt');
  });

  it('removes club prefix FC', () => {
    const r = generateDisplayNames('FC Augsburg');
    expect(r.medium).toBe('Augsburg');
  });

  it('removes club prefix TSV', () => {
    const r = generateDisplayNames('TSV Hartberg');
    expect(r.medium).toBe('Hartberg');
  });

  it('removes club prefix SpVgg', () => {
    const r = generateDisplayNames('SpVgg Unterhaching');
    expect(r.medium).toBe('Unterhaching');
  });

  it('removes numbered prefix "1. FC"', () => {
    const r = generateDisplayNames('1. FC Köln');
    expect(r.medium).toBe('Köln');
  });

  it('removes prefix Eintracht', () => {
    const r = generateDisplayNames('Eintracht Frankfurt');
    expect(r.medium).toBe('Ffm.');
  });

  it('removes prefix Borussia', () => {
    const r = generateDisplayNames('Borussia Dortmund');
    expect(r.medium).toBe('Do.');
  });

  it('handles combined cleanup: prefix + year + suffix', () => {
    const r = generateDisplayNames('SV Musterstadt 1899 e.V.');
    expect(r.medium).toBe('Musterstadt');
  });
});

// =============================================================================
// STAGE 2: ABBREVIATION MAPPING
// =============================================================================

describe('generateDisplayNames — Abbreviation Mapping', () => {
  it('abbreviates Blau-Weiß to BW', () => {
    const r = generateDisplayNames('SV Blau-Weiß Recklinghausen');
    expect(r.medium).toBe('BW Recklinghausen');
  });

  it('abbreviates Blau Weiß (space-separated) to BW', () => {
    const r = generateDisplayNames('SV Blau Weiß Recklinghausen');
    expect(r.medium).toBe('BW Recklinghausen');
  });

  it('abbreviates Rot-Weiß to RW', () => {
    const r = generateDisplayNames('Rot-Weiß Oberhausen');
    expect(r.medium).toBe('RW Oberhausen');
  });

  it('abbreviates Schwarz-Weiß to SW', () => {
    const r = generateDisplayNames('Schwarz-Weiß Essen');
    expect(r.medium).toBe('SW Essen');
  });

  it('abbreviates Grün-Weiß to GW', () => {
    const r = generateDisplayNames('Grün-Weiß Eimsbüttel');
    expect(r.medium).toBe('GW Eimsbüttel');
  });

  it('abbreviates München to M.', () => {
    const r = generateDisplayNames('FC Bayern München');
    expect(r.medium).toBe('Bayern M.');
  });

  it('abbreviates Hamburg to HH', () => {
    const r = generateDisplayNames('HSV Hamburg');
    // HSV is stripped as prefix, Hamburg → HH
    expect(r.medium).toBe('HH');
  });

  it('abbreviates Sportfreunde to Spfr.', () => {
    const r = generateDisplayNames('Sportfreunde Lotte');
    expect(r.medium).toBe('Spfr. Lotte');
  });

  it('abbreviates Turnerbund to TB', () => {
    const r = generateDisplayNames('TSV Turnerbund Oberhausen');
    expect(r.medium).toBe('TB Oberhausen');
  });

  it('abbreviates Dortmund to Do.', () => {
    const r = generateDisplayNames('Borussia Dortmund');
    expect(r.medium).toBe('Do.');
  });
});

// =============================================================================
// STAGE 3: SHORT / MICRO GENERATION
// =============================================================================

describe('generateDisplayNames — Short/Micro', () => {
  it('generates initials for multi-word medium', () => {
    const r = generateDisplayNames('SV Blau-Weiß Recklinghausen');
    expect(r.short).toBe('BWR');
    expect(r.micro).toBe('BW');
  });

  it('generates single initial for one-word medium', () => {
    const r = generateDisplayNames('FC Augsburg');
    expect(r.short).toBe('A');
    expect(r.micro).toBe('A');
  });

  it('limits short to 4 characters', () => {
    const r = generateDisplayNames('Die wilden bunten fröhlichen Kerle');
    expect(r.short.length).toBeLessThanOrEqual(4);
  });

  it('limits micro to 2 characters', () => {
    const r = generateDisplayNames('Die wilden Kerle');
    expect(r.micro.length).toBeLessThanOrEqual(2);
  });
});

// =============================================================================
// CONCEPT EXAMPLES (Section 15.5)
// =============================================================================

describe('generateDisplayNames — Concept Examples', () => {
  it('"SV Blau-Weiß Recklinghausen 1928 e.V."', () => {
    const r = generateDisplayNames('SV Blau-Weiß Recklinghausen 1928 e.V.');
    expect(r.medium).toBe('BW Recklinghausen');
    expect(r.short).toBe('BWR');
    expect(r.micro).toBe('BW');
  });

  it('"FC Bayern München"', () => {
    const r = generateDisplayNames('FC Bayern München');
    expect(r.medium).toBe('Bayern M.');
    expect(r.short).toBe('BM');
    expect(r.micro).toBe('BM');
  });

  it('"Die wilden Kerle"', () => {
    const r = generateDisplayNames('Die wilden Kerle');
    expect(r.medium).toBe('Die wilden Kerle');
    expect(r.short).toBe('DWK');
    expect(r.micro).toBe('DW');
  });

  it('"TSV Turnerbund Oberhausen"', () => {
    const r = generateDisplayNames('TSV Turnerbund Oberhausen');
    expect(r.medium).toBe('TB Oberhausen');
    // "TB" is all-caps abbreviation → contributes both letters to initials
    expect(r.short).toBe('TBO');
    expect(r.micro).toBe('TB');
  });

  it('preserves full name in .full', () => {
    const name = 'SV Blau-Weiß Recklinghausen 1928 e.V.';
    const r = generateDisplayNames(name);
    expect(r.full).toBe(name);
  });
});

// =============================================================================
// EDGE CASES
// =============================================================================

describe('generateDisplayNames — Edge Cases', () => {
  it('handles empty string', () => {
    const r = generateDisplayNames('');
    expect(r.full).toBe('');
    expect(r.medium).toBe('');
    expect(r.short).toBe('');
    expect(r.micro).toBe('');
  });

  it('handles whitespace-only string', () => {
    const r = generateDisplayNames('   ');
    expect(r.full).toBe('');
    expect(r.medium).toBe('');
  });

  it('handles single word name', () => {
    const r = generateDisplayNames('Bayern');
    expect(r.full).toBe('Bayern');
    expect(r.medium).toBe('Bayern');
    expect(r.short).toBe('B');
    expect(r.micro).toBe('B');
  });

  it('handles name that is only a prefix', () => {
    const r = generateDisplayNames('FC');
    // After stripping prefix, nothing remains
    // Should still produce something meaningful
    expect(r.full).toBe('FC');
  });

  it('handles name with extra whitespace', () => {
    const r = generateDisplayNames('  FC   Bayern   München  ');
    expect(r.full).toBe('FC Bayern München');
    expect(r.medium).toBe('Bayern M.');
  });

  it('handles name without any German patterns', () => {
    const r = generateDisplayNames('Real Madrid');
    expect(r.medium).toBe('Real Madrid');
    expect(r.short).toBe('RM');
    expect(r.micro).toBe('RM');
  });

  it('handles name with Weiss (ss instead of ß)', () => {
    const r = generateDisplayNames('SV Blau-Weiss Berlin');
    expect(r.medium).toBe('BW Berlin');
  });
});

// =============================================================================
// selectVariant
// =============================================================================

describe('selectVariant', () => {
  const names = generateDisplayNames('SV Blau-Weiß Recklinghausen 1928 e.V.');

  it('returns full if it fits', () => {
    expect(selectVariant(names, 50)).toBe(names.full);
  });

  it('returns medium if full is too long', () => {
    expect(selectVariant(names, 20)).toBe(names.medium);
  });

  it('returns short if medium is too long', () => {
    expect(selectVariant(names, 5)).toBe(names.short);
  });

  it('returns micro if short is too long', () => {
    expect(selectVariant(names, 2)).toBe(names.micro);
  });
});

// =============================================================================
// getDisplayNames (cached wrapper)
// =============================================================================

describe('getDisplayNames', () => {
  it('returns same result as generateDisplayNames', () => {
    const name = 'FC Bayern München';
    const direct = generateDisplayNames(name);
    const cached = getDisplayNames(name);
    expect(cached).toEqual(direct);
  });

  it('returns cached result on second call', () => {
    const name = 'SV Werder Bremen';
    const first = getDisplayNames(name);
    const second = getDisplayNames(name);
    // Same object reference (from cache)
    expect(second).toBe(first);
  });
});
