/**
 * @RE-004 Fehlt eine Betreiberangabe, schlägt der Produktions-Bau fehl statt einen Platzhalter zu veröffentlichen;
 * alle anderen Builds warnen nur (damit CI nicht rot wird, bis die Angaben eingetragen sind).
 */
import { describe, expect, it, vi } from 'vitest';
import type { LegalConfig } from '../../../src/config/legal';
import { legalCheckPlugin } from '../legalCheckPlugin';

const voll: LegalConfig = {
  name: 'Erika Mustermann', careOf: '', street: 'Hauptstraße 1', city: '12345 Musterstadt', email: 'erika@example.org',
  supervisoryAuthority: { name: 'Behörde', address: 'Straße 1', url: 'https://example.org' }, lastUpdated: 'November 2026',
};

function laufe(optionen: Parameters<typeof legalCheckPlugin>[0]) {
  const plugin = legalCheckPlugin(optionen);
  const error = vi.fn((meldung: string): never => { throw new Error(meldung); });
  const warn = vi.fn();
  const hook = plugin.buildStart as unknown as (this: { error: typeof error; warn: typeof warn }) => void;
  let geworfen: Error | null = null;
  try { hook.call({ error, warn }); } catch (fehler) { geworfen = fehler as Error; }
  return { error, warn, geworfen };
}

describe('@RE-004 Prüfung im Build', () => {
  it('Produktions-Build, E-Mail fehlt: der Bau bricht ab und nennt das Feld', () => {
    const { geworfen } = laufe({ strict: true, config: { ...voll, email: '' } });
    expect(geworfen?.message).toMatch(/email/);
  });

  it('Produktions-Build, Platzhalter in eckigen Klammern: der Bau bricht ab', () => {
    const { geworfen } = laufe({ strict: true, config: { ...voll, name: '[VORNAME NACHNAME]' } });
    expect(geworfen?.message).toMatch(/name/);
  });

  it('Produktions-Build mit allen Angaben: der Bau läuft durch, ohne Warnung', () => {
    const { geworfen, warn, error } = laufe({ strict: true, config: voll });
    expect(geworfen).toBeNull();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('anderer Build (CI, Vorschau, Test) mit Platzhaltern: nur Warnung, kein Abbruch', () => {
    const { geworfen, warn } = laufe({ strict: false, config: { ...voll, street: '[STRASSE NR]' } });
    expect(geworfen).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/street/);
  });

  it('läuft nur beim Bauen, nicht im Dev-Server', () => {
    expect(legalCheckPlugin({ config: voll }).apply).toBe('build');
  });
});
