/**
 * @ZM-212 Das Programm des Profils „Halle (sehr fern)“: nur die Live-Folie. Die gespeicherte Folienliste des Monitors bleibt unberührt,
 * damit ein Zurückstellen des Profils nichts verliert.
 */
import { describe, it, expect } from 'vitest';
import type { MonitorSlide } from '../../../types/monitor';
import { HALL_LIVE_SLIDE_ID, hallProgramSlides } from '../hallProgram';
import { slide } from './monitorFixture';

describe('@ZM-212 hallProgramSlides', () => {
  it('Live-Spiel, Nächste Spiele und Tabelle Gruppe A: nur die Live-Folie bleibt, mit ihrem Feld', () => {
    const live = slide('live', { fieldId: 'field-2' });
    const programm = hallProgramSlides([slide('next-matches', { matchCount: 5 }), live, slide('standings', { groupId: 'A' })]);
    expect(programm).toHaveLength(1);
    expect(programm[0].type).toBe('live');
    expect(programm[0].id).toBe(live.id);
    expect(programm[0].config.fieldId).toBe('field-2');
  });

  it('Gegenbeispiel: Nächste Spiele und Tabelle kommen nie ins Programm', () => {
    const programm = hallProgramSlides([slide('live', {}), slide('next-matches'), slide('standings', { groupId: 'A' }), slide('all-standings'), slide('qr-code')]);
    expect(programm.map((s) => s.type)).toEqual(['live']);
  });

  it('Zwischen den Spielen gilt „nächstes Spiel“, auch wenn die Folie auf „überspringen“ steht (es gibt keine andere Folie)', () => {
    const [folie] = hallProgramSlides([slide('live', { fieldId: 'field-1', whenIdle: { type: 'skip' } })]);
    expect(folie.config.whenIdle).toEqual({ type: 'next-match' });
  });

  it('Die gespeicherte Liste bleibt unverändert (kein Löschen, kein Verändern der Folie)', () => {
    const gespeichert: MonitorSlide[] = [slide('live', { fieldId: 'field-1', whenIdle: { type: 'skip' } }), slide('next-matches'), slide('standings', { groupId: 'A' })];
    const vorher = structuredClone(gespeichert);
    hallProgramSlides(gespeichert);
    expect(gespeichert).toEqual(vorher);
  });

  it('Ohne Live-Folie in der Liste (z. B. nur Tabellen) ergänzt das Profil eine Live-Folie für Feld 1', () => {
    const programm = hallProgramSlides([slide('standings', { groupId: 'A' }), slide('next-matches')]);
    expect(programm).toHaveLength(1);
    expect(programm[0].id).toBe(HALL_LIVE_SLIDE_ID);
    expect(programm[0].type).toBe('live');
    expect(programm[0].config.fieldId).toBeUndefined(); // ohne Feld gilt Feld 1 (@ZM-074)
  });

  it('Leere Liste: ebenfalls die Live-Folie für Feld 1', () => {
    expect(hallProgramSlides([]).map((s) => s.type)).toEqual(['live']);
  });
});
