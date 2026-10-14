/**
 * Auswahl der Teamnamen-Schrift (B-17 Fixrunde, @ZM-087, @ZM-088, @ZM-125).
 * Gegenbeispiele: ein Name, der bei 3 % nicht passt, kommt nie unverkürzt; zuerst der volle Name, dann der Kurzname.
 */
import { describe, it, expect } from 'vitest';
import { waehleTeamNameSchrift } from '../teamNameFit';

const VOLL = 'Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921';
const MITTEL = 'SG Fußballfreunde Nordheim-Süd';
const KURZ = 'SFNS';

describe('waehleTeamNameSchrift (@ZM-087, @ZM-088)', () => {
  it('nimmt den vollen Namen, wenn er bei der größten Schrift passt', () => {
    const wahl = waehleTeamNameSchrift([VOLL, MITTEL, KURZ], () => true, 21, 64);
    expect(wahl).toEqual({ text: VOLL, px: 64 });
  });

  it('sucht die größte passende Schrift zwischen Minimum und Maximum', () => {
    // passt bis einschließlich 40 px
    const wahl = waehleTeamNameSchrift([VOLL], (_t, px) => px <= 40, 21, 64);
    expect(wahl.text).toBe(VOLL);
    expect(wahl.px).toBeGreaterThanOrEqual(39.5);
    expect(wahl.px).toBeLessThanOrEqual(40);
  });

  it('Gegenbeispiel: passt der volle Name nicht einmal bei der kleinsten Schrift, kommt der Mittelname, nicht „…“', () => {
    const wahl = waehleTeamNameSchrift([VOLL, MITTEL, KURZ], (text, px) => text !== VOLL && px >= 21, 21, 64);
    expect(wahl.text).toBe(MITTEL);
    expect(wahl.text).not.toContain('…');
  });

  it('Gegenbeispiel: die kleinste Schrift wird nie unterschritten', () => {
    const wahl = waehleTeamNameSchrift([VOLL], () => false, 21, 64);
    expect(wahl).toEqual({ text: VOLL, px: 21 });
  });
});
