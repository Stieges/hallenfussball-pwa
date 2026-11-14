/**
 * @ME-076, @ME-077 Wann gilt eine Folie als eingerichtet? Eine Quelle für Editor und Monitor.
 */
import { describe, it, expect } from 'vitest';
import { slideSetupProblem } from '../monitorSlideSetup';

const sponsoren = [{ id: 'sp1' }];

describe('slideSetupProblem', () => {
  it.each(['live', 'schedule-field'])('%s ohne Feld ist eingerichtet (gilt als Feld 1, @ZM-074)', (type) => {
    expect(slideSetupProblem({ type, config: {} }, sponsoren)).toBeNull();
  });

  it('Sponsor-Folie: ohne Sponsor oder mit unbekanntem Sponsor „sponsor“, mit vorhandenem null', () => {
    expect(slideSetupProblem({ type: 'sponsor', config: {} }, sponsoren)).toBe('sponsor');
    expect(slideSetupProblem({ type: 'sponsor', config: { sponsorId: 'weg' } }, sponsoren)).toBe('sponsor');
    expect(slideSetupProblem({ type: 'sponsor', config: { sponsorId: 'sp1' } }, sponsoren)).toBeNull();
  });

  it('„Eigener Text“: leere oder nur aus Leerzeichen bestehende Überschrift „headline“, sonst null', () => {
    expect(slideSetupProblem({ type: 'custom-text', config: {} })).toBe('headline');
    expect(slideSetupProblem({ type: 'custom-text', config: { headline: '  ' } })).toBe('headline');
    expect(slideSetupProblem({ type: 'custom-text', config: { headline: 'Willkommen' } })).toBeNull();
  });

  it('Gegenbeispiel: Tabelle, Nächste Spiele, QR-Code und unbekannte Arten haben nie ein Problem', () => {
    for (const type of ['standings', 'next-matches', 'qr-code', 'all-standings', 'altbestand']) {
      expect(slideSetupProblem({ type, config: {} }, [])).toBeNull();
    }
  });
});
