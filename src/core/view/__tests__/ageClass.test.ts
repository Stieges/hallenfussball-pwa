/**
 * Altersklasse, reine Logik. Szenarien aus docs/anforderungen/2026-09-27_wizard-regelprofile.md:
 * @W2B-010 (Einträge je Schreibweise), @W2B-022 (leer, kein Trennzeichen), @W2B-023 (Stufe nur Jugend),
 * @W2B-024 (genau wie gewählt), @W2B-026 (Wert außerhalb der Liste bleibt).
 */
import { describe, it, expect } from 'vitest';
import { ageGroupsFor, composeAgeClass, parseAgeClass, ageClassText, joinMeta } from '../ageClass';

describe('@W2B-010 Einträge je Schreibweise', () => {
  it.each([
    ['youth', ['G-Jugend', 'F-Jugend', 'E-Jugend', 'D-Jugend', 'C-Jugend', 'B-Jugend', 'A-Jugend']],
    ['uClasses', ['U7', 'U8', 'U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16', 'U17', 'U19']],
    ['adults', ['Herren', 'Frauen', 'Senioren', 'Ü32', 'Ü40', 'Ü50']],
  ])('%s enthält genau die Einträge der Anforderung', (id, entries) => {
    expect(ageGroupsFor('football').find((g) => g.id === id)?.entries).toEqual(entries);
  });

  it('Gegenbeispiel: kein „Keine Angabe“-Eintrag und keine alten Einträge wie U18 oder AH', () => {
    const all = ageGroupsFor('football').flatMap((g) => g.entries);
    expect(all).toHaveLength(25);
    expect(all).not.toContain('U18');
    expect(all).not.toContain('AH');
    expect(all.some((e) => /keine angabe/i.test(e))).toBe(false);
  });

  it('nur die Jugend hat eine Stufe', () => {
    expect(ageGroupsFor('football').filter((g) => g.hasLevel).map((g) => g.id)).toEqual(['youth']);
  });

  it('andere Sportarten behalten ihre eigene Liste', () => {
    expect(ageGroupsFor('other').flatMap((g) => g.entries)).toEqual(['U8', 'U10', 'U12', 'U14', 'U16', 'U18', 'Jugend', 'Erwachsene', 'Mixed']);
  });
});

describe('@W2B-023 Stufe', () => {
  it('E-Jugend mit Stufe 2 ergibt „E2-Jugend“, ohne Stufe „E-Jugend“', () => {
    expect(composeAgeClass('E-Jugend', 2)).toBe('E2-Jugend');
    expect(composeAgeClass('E-Jugend', null)).toBe('E-Jugend');
  });

  it('Gegenbeispiel: bei U-Klassen und Erwachsenen gibt es keine Stufe', () => {
    expect(composeAgeClass('U11', 2)).toBe('U11');
    expect(composeAgeClass('Herren', 3)).toBe('Herren');
  });

  it('liest „D3-Jugend“ als D-Jugend mit Stufe 3 zurück', () => {
    expect(parseAgeClass('D3-Jugend', 'football')).toEqual({ kind: 'entry', group: 'youth', entry: 'D-Jugend', level: 3 });
  });
});

describe('@W2B-024 genau wie gewählt', () => {
  it('U11 bleibt U11 und wird nicht in „E-Jugend“ umgerechnet', () => {
    expect(composeAgeClass('U11', null)).toBe('U11');
    expect(parseAgeClass('U11', 'football')).toEqual({ kind: 'entry', group: 'uClasses', entry: 'U11', level: null });
    expect(ageClassText('U11')).toBe('U11');
  });
});

describe('@W2B-026 Wert außerhalb der Liste', () => {
  it('„AH“ ist Sonstiges und bleibt unverändert', () => {
    expect(parseAgeClass('AH', 'football')).toEqual({ kind: 'custom', text: 'AH' });
    expect(ageClassText('AH')).toBe('AH');
  });

  it('Gegenbeispiel: auch „Damen“ und „U18“ aus alten Turnieren gehen nicht verloren', () => {
    expect(parseAgeClass('Damen', 'football').kind).toBe('custom');
    expect(parseAgeClass('U18', 'football').kind).toBe('custom');
  });
});

describe('@W2B-022 leer und freiwillig', () => {
  it.each(['', '   ', undefined])('„%s“ ist keine Angabe', (value) => {
    expect(parseAgeClass(value, 'football')).toEqual({ kind: 'none' });
    expect(ageClassText(value)).toBe('');
  });

  it('joinMeta lässt Leeres samt Trennzeichen weg, auch vorne', () => {
    expect(joinMeta(['', '24.10.2026', 'Halle Süd'], ' · ')).toBe('24.10.2026 · Halle Süd');
    expect(joinMeta([undefined, '  ', 'Halle'], ' • ')).toBe('Halle');
    expect(joinMeta(['U11', '24.10.2026'], ' · ')).toBe('U11 · 24.10.2026');
  });
});
