/**
 * tokenGenerator — Einladungs-Tokens und Einladungs-Link (A-07h, Abdeckung features/auth).
 *
 * Jeder Fall hat ein Gegenbeispiel (falsche Länge, verbotene Zeichen, falsche Basis-URL).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateToken, generateUUID, isValidTokenFormat, generateInviteLink } from '../tokenGenerator';

const FORBIDDEN = /[0OIl]/;

describe('generateToken', () => {
  it('erzeugt standardmäßig 32 Zeichen aus dem erlaubten Zeichensatz', () => {
    const token = generateToken();

    expect(token).toHaveLength(32);
    expect(isValidTokenFormat(token)).toBe(true);
  });

  it('Gegenbeispiel: verwechselbare Zeichen 0, O, I, l kommen nie vor', () => {
    const token = generateToken(256);

    expect(FORBIDDEN.test(token)).toBe(false);
  });

  it('übernimmt eine angegebene Länge', () => {
    expect(generateToken(64)).toHaveLength(64);
  });
});

describe('generateUUID', () => {
  it('liefert eine UUID im Format der Version 4', () => {
    expect(generateUUID()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('Fallback ohne crypto.randomUUID liefert ebenfalls eine gültige Version-4-UUID', () => {
    const original = crypto.randomUUID;
    // @ts-expect-error – Test simuliert einen älteren Browser ohne randomUUID
    crypto.randomUUID = undefined;
    try {
      expect(generateUUID()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    } finally {
      crypto.randomUUID = original;
    }
  });
});

describe('isValidTokenFormat', () => {
  it('akzeptiert einen Token der erwarteten Länge aus dem Zeichensatz', () => {
    expect(isValidTokenFormat('abcdefghjkmnpqrstuvwxyz23456789A')).toBe(true);
  });

  it('Gegenbeispiel: falsche Länge wird abgelehnt', () => {
    expect(isValidTokenFormat('abc', 32)).toBe(false);
    expect(isValidTokenFormat('abc', 3)).toBe(true);
  });

  it('Gegenbeispiel: verbotenes Zeichen "0" wird abgelehnt', () => {
    expect(isValidTokenFormat('0bcdefghjkmnpqrstuvwxyz23456789ABC', 32)).toBe(false);
  });

  it('Gegenbeispiel: leerer oder nicht-String-Eingabe wird abgelehnt', () => {
    expect(isValidTokenFormat('')).toBe(false);
    expect(isValidTokenFormat(undefined as unknown as string)).toBe(false);
  });
});

describe('generateInviteLink', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('baut den Link mit der Origin des Fensters, wenn keine Basis-URL übergeben wird', () => {
    vi.stubGlobal('window', { location: { origin: 'https://fenster.test' } });

    expect(generateInviteLink('tok')).toBe('https://fenster.test/invite?token=tok');
  });

  it('fällt ohne Fenster (z. B. im Worker) auf die Standard-Domain zurück', () => {
    vi.stubGlobal('window', undefined);

    expect(generateInviteLink('tok')).toBe('https://app.turnier.de/invite?token=tok');
  });

  it('nutzt die übergebene Basis-URL statt der Fenster-Origin', () => {
    vi.stubGlobal('window', { location: { origin: 'https://fenster.test' } });

    expect(generateInviteLink('tok', 'https://app.example.de')).toBe('https://app.example.de/invite?token=tok');
  });

  it('Gegenbeispiel: mit übergebener Basis-URL wird die Fenster-Origin nicht verwendet', () => {
    vi.stubGlobal('window', { location: { origin: 'https://fenster.test' } });

    expect(generateInviteLink('tok', 'https://app.example.de')).not.toContain('fenster.test');
  });
});
