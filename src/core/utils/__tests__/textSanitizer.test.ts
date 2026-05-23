import { describe, it, expect } from 'vitest';
import { sanitizeTeamName } from '../textSanitizer';

describe('sanitizeTeamName — F-215 XSS hardening', () => {
  it('removes all angle brackets so no HTML/XML tag boundary survives', () => {
    const xssPayloads = [
      'Bayern<script>alert(1)</script>',
      '<img src=x onerror=alert(1)>FC',
      '<scr<script>ipt>alert(1)</script>',
      '</script ><script>alert(1)</script>',
      '<style>body{}</style>FC',
      '<<>>FC',
    ];

    for (const payload of xssPayloads) {
      const out = sanitizeTeamName(payload);
      expect(out).not.toContain('<');
      expect(out).not.toContain('>');
    }
  });

  it('preserves plain text content (no HTML)', () => {
    expect(sanitizeTeamName('FC Bayern München')).toBe('FC Bayern München');
  });

  it('preserves valid Unicode (umlauts, emoji)', () => {
    expect(sanitizeTeamName('FC Köln 🦁')).toBe('FC Köln 🦁');
  });

  it('removes ASCII control characters', () => {
    expect(sanitizeTeamName('Bayern\x00\x01\x1FMünchen')).toBe('BayernMünchen');
  });

  it('collapses whitespace and trims', () => {
    expect(sanitizeTeamName('  FC   Bayern   ')).toBe('FC Bayern');
  });

  it('returns empty string for non-string input', () => {
    expect(sanitizeTeamName(null as unknown as string)).toBe('');
    expect(sanitizeTeamName(undefined as unknown as string)).toBe('');
  });

  it('returns empty string for input that is only angle brackets', () => {
    expect(sanitizeTeamName('<><><>')).toBe('');
  });

  it('idempotent: applying twice yields the same result', () => {
    const once = sanitizeTeamName('Bayern<script>alert(1)</script>');
    const twice = sanitizeTeamName(once);
    expect(twice).toBe(once);
  });
});
