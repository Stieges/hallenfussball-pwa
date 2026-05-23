import { describe, it, expect } from 'vitest';
import { sanitizeTeamName } from '../textSanitizer';

describe('sanitizeTeamName — F-215 XSS hardening', () => {
  it('strips <script> tags and their content', () => {
    expect(sanitizeTeamName('Bayern<script>alert(1)</script>')).toBe('Bayern');
  });

  it('strips <style> tags and their content', () => {
    expect(sanitizeTeamName('FC<style>body{}</style> Köln')).toBe('FC Köln');
  });

  it('strips remaining HTML tags but keeps text content', () => {
    expect(sanitizeTeamName('<b>Bayern</b> <i>München</i>')).toBe('Bayern München');
  });

  it('strips img-onerror payload', () => {
    expect(sanitizeTeamName('<img src=x onerror=alert(1)>FC')).toBe('FC');
  });

  it('removes ASCII control characters', () => {
    expect(sanitizeTeamName('Bayern\x00\x01\x1FMünchen')).toBe('BayernMünchen');
  });

  it('collapses whitespace and trims', () => {
    expect(sanitizeTeamName('  FC   Bayern   ')).toBe('FC Bayern');
  });

  it('preserves valid Unicode (umlauts, emoji)', () => {
    expect(sanitizeTeamName('FC Köln 🦁')).toBe('FC Köln 🦁');
  });

  it('returns empty string for non-string input', () => {
    expect(sanitizeTeamName(null as unknown as string)).toBe('');
    expect(sanitizeTeamName(undefined as unknown as string)).toBe('');
  });

  it('returns empty string for input that is only HTML', () => {
    expect(sanitizeTeamName('<script></script>')).toBe('');
  });
});
