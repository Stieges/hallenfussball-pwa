/**
 * C-OFFUI Beleg (nur Nachweis, kein Fix): Ohne Netz liefert
 * SupabaseLiveMatchRepository.get() null zurück, wodurch der Helfer
 * sein eben eingetragenes Tor nicht sieht.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { SupabaseLiveMatchRepository } from '../SupabaseLiveMatchRepository';

describe('C-OFFUI: Netzwerkfehler bei get() führt zu null', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('gibt null zurück, wenn der Supabase-Client einen Netzfehler liefert', async () => {
    // Nachweis: Datei:Zeile und keinen Fix. Ursache in SupabaseLiveMatchRepository.ts:88 und :106.
    const repo = new SupabaseLiveMatchRepository();
    const result = await repo.get('t1', 'm1');
    expect(result).toBeNull();
  });
});
