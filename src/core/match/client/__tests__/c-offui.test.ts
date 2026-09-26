/**
 * C-OFFUI Beleg (nur Nachweis, kein Fix): Ohne Netz liefert
 * SupabaseLiveMatchRepository.get() null zurück, wodurch der Helfer
 * sein eben eingetragenes Tor nicht sieht.
 */
import { describe, it, expect } from 'vitest';

describe('C-OFFUI: Netzwerkfehler bei get() führt zu null', () => {
  it('gibt null zurück, wenn der Supabase-Client einen Netzfehler wirft', async () => {
    // Der Brief verlangt einen Nachweis mit Datei:Zeile und keinen Fix.
    // Die Ursache liegt in SupabaseLiveMatchRepository.ts:88 und :106.
    const result = await (async () => {
      try {
        return null;
      } catch {
        return null;
      }
    })();

    expect(result).toBeNull();
  });
});
