/**
 * H3b-1: aktuelles Spiel je Feld für den Hallen-Lautsprecher – Reihenfolge wie das Cockpit (`useFieldMatchSelection`):
 * angepfiffen (laufend/angehalten) → gehaltener Endstand → erstes ohne Ergebnis; Spielfolge wie `matchesOfFieldInPlayOrder`.
 * Grundlage für @HT-005/@HT-006 (Ton nach dem Spiel, das auf dem Feld gerade läuft) und @HT-016 (Feld ohne Spiel).
 */
import { describe, expect, it } from 'vitest';
import { aktuellesSpielJeFeld, type FeldSpiel } from '../aktuellesSpielJeFeld';

const um = (hhmm: string): Date => new Date(`2026-11-28T${hhmm}:00Z`);

function spiel(id: string, field: number, matchNumber: number, start: string, rest: Partial<FeldSpiel> = {}): FeldSpiel {
  return { id, field, matchNumber, startTime: um(start), ...rest };
}

describe('aktuellesSpielJeFeld', () => {
  it('@HT-005 Spiel 11 läuft auf Feld 1: es ist das aktuelle Spiel, nicht das erste ohne Ergebnis', () => {
    const spiele = [
      spiel('s10', 1, 10, '14:00', { status: 'NOT_STARTED' }),
      spiel('s11', 1, 11, '14:12', { status: 'RUNNING' }),
      spiel('s12', 1, 12, '14:24'),
    ];
    expect(aktuellesSpielJeFeld(spiele, { anzahlFelder: 1 }).get('field-1')?.id).toBe('s11');
  });

  it('@HT-006 angehaltenes Spiel zählt als angepfiffen', () => {
    const spiele = [spiel('s10', 1, 10, '14:00'), spiel('s11', 1, 11, '14:12', { status: 'PAUSED' })];
    expect(aktuellesSpielJeFeld(spiele, { anzahlFelder: 1 }).get('field-1')?.id).toBe('s11');
  });

  it('Gegenbeispiel: zwei Spiele angepfiffen → das frühere in der Spielfolge (Anstoßzeit vor Listenplatz)', () => {
    const spiele = [
      spiel('spaet', 1, 12, '14:24', { status: 'RUNNING' }),
      spiel('frueh', 1, 11, '14:12', { status: 'PAUSED' }),
    ];
    expect(aktuellesSpielJeFeld(spiele, { anzahlFelder: 1 }).get('field-1')?.id).toBe('frueh');
  });

  it('gehaltener Endstand vor dem nächsten Spiel, wenn die Quelle ihn kennt', () => {
    const spiele = [
      spiel('s11', 1, 11, '14:12', { status: 'FINISHED', scoreA: 2, scoreB: 1 }),
      spiel('s12', 1, 12, '14:24'),
    ];
    const gehalten = new Map([['field-1', 's11']]);
    expect(aktuellesSpielJeFeld(spiele, { anzahlFelder: 1, gehaltenJeFeld: gehalten }).get('field-1')?.id).toBe('s11');
    expect(aktuellesSpielJeFeld(spiele, { anzahlFelder: 1 }).get('field-1')?.id).toBe('s12');
  });

  it('Gegenbeispiel: gehaltenes Spiel eines anderen Felds zählt nicht', () => {
    const spiele = [spiel('s11', 1, 11, '14:12', { scoreA: 2, scoreB: 1 }), spiel('s12', 1, 12, '14:24'), spiel('s21', 2, 21, '14:12')];
    const gehalten = new Map([['field-1', 's21']]);
    expect(aktuellesSpielJeFeld(spiele, { anzahlFelder: 2, gehaltenJeFeld: gehalten }).get('field-1')?.id).toBe('s12');
  });

  it('ohne angepfiffenes Spiel: das erste ohne Ergebnis in der Spielfolge', () => {
    const spiele = [
      spiel('s13', 1, 13, '14:36'),
      spiel('s11', 1, 11, '14:12', { scoreA: 0, scoreB: 0, status: 'FINISHED' }),
      spiel('s12', 1, 12, '14:24'),
    ];
    expect(aktuellesSpielJeFeld(spiele, { anzahlFelder: 1 }).get('field-1')?.id).toBe('s12');
  });

  it('Gegenbeispiel: alle Spiele beendet → null', () => {
    const spiele = [
      spiel('s11', 1, 11, '14:12', { status: 'FINISHED', scoreA: 1, scoreB: 0 }),
      spiel('s12', 1, 12, '14:24', { status: 'FINISHED', scoreA: 0, scoreB: 3 }),
    ];
    expect(aktuellesSpielJeFeld(spiele, { anzahlFelder: 1 }).get('field-1')).toBeNull();
  });

  it('Gegenbeispiel: beendet ohne eingetragenes Ergebnis gilt nicht als „ohne Ergebnis“', () => {
    const spiele = [spiel('s11', 1, 11, '14:12', { status: 'FINISHED' })];
    expect(aktuellesSpielJeFeld(spiele, { anzahlFelder: 1 }).get('field-1')).toBeNull();
  });

  it('@HT-016 Gegenbeispiel: Feld ohne Spiele → null, je Feld des Turniers ein Eintrag', () => {
    const spiele = [spiel('s11', 1, 11, '14:12', { status: 'RUNNING' })];
    const ergebnis = aktuellesSpielJeFeld(spiele, { anzahlFelder: 3 });
    expect([...ergebnis.keys()]).toEqual(['field-1', 'field-2', 'field-3']);
    expect(ergebnis.get('field-1')?.id).toBe('s11');
    expect(ergebnis.get('field-2')).toBeNull();
    expect(ergebnis.get('field-3')).toBeNull();
  });

  it('jedes Feld für sich: das laufende Spiel auf Feld 2 ändert Feld 1 nicht', () => {
    const spiele = [spiel('s11', 1, 11, '14:12'), spiel('s21', 2, 21, '14:12', { status: 'RUNNING' }), spiel('s22', 2, 22, '14:24')];
    const ergebnis = aktuellesSpielJeFeld(spiele, { anzahlFelder: 2 });
    expect(ergebnis.get('field-1')?.id).toBe('s11');
    expect(ergebnis.get('field-2')?.id).toBe('s21');
  });
});
