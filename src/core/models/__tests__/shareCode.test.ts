/**
 * CA-3 (Paket Co-Admin, Befund C-SHARE): Der Freigabe-Code lässt sich vorlesen und eintippen.
 * Anforderung: @BM-071 (Record turnier-bekannt-machen): genau 6 Zeichen, weder 0 noch O noch 1 noch I.
 * Die Erwartung stammt aus der Server-Funktion generate_share_code (Migration), nicht aus dem Client-Code.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SHARE_CODE_ALPHABET, SHARE_CODE_LENGTH, generateShareCode } from '../shareCode';

const MIGRATION = resolve(__dirname, '../../../../supabase/migrations/20260128_003_fix_function_search_path.sql');

function serverAlphabet(): string {
  const sql = readFileSync(MIGRATION, 'utf8');
  const fn = sql.slice(sql.indexOf('FUNCTION public.generate_share_code()'));
  const match = /chars TEXT := '([A-Z0-9]+)'/.exec(fn);
  if (!match) { throw new Error('generate_share_code: Zeichenmenge nicht gefunden'); }
  return match[1];
}

describe('SHARE_CODE_ALPHABET (Parität zum Server)', () => {
  it('ist wörtlich die Zeichenmenge aus generate_share_code', () => {
    expect(SHARE_CODE_ALPHABET).toBe(serverAlphabet());
  });

  it('Gegenbeispiel: die alte Geräte-Menge A–Z0–9 fällt durch', () => {
    expect('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789').not.toBe(serverAlphabet());
    expect(SHARE_CODE_ALPHABET).not.toMatch(/[01IO]/);
  });
});

describe('generateShareCode', () => {
  it('2000 Codes: immer 6 Zeichen aus der Server-Menge, nie 0, O, 1, I', () => {
    for (let i = 0; i < 2000; i++) {
      const code = generateShareCode();
      expect(code).toHaveLength(SHARE_CODE_LENGTH);
      expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
      expect(code).not.toMatch(/[01IO]/);
    }
  });

  it('Gegenbeispiel: Zufallsquelle auf der höchsten Zahl bleibt in der Menge (letztes Zeichen)', () => {
    const code = generateShareCode(() => 0.9999999999);
    expect(code).toBe('9'.repeat(6));
    expect(SHARE_CODE_ALPHABET).toContain('9');
  });

  it('Zufallsquelle 0 ergibt das erste Zeichen', () => {
    expect(generateShareCode(() => 0)).toBe('AAAAAA');
  });
});
