/**
 * MS1 – Vereinskürzel am Monitor (@ZM-087, @ZM-149, @ZM-148-Gegenbeispiel in TeamNameDisplay-/Zuschauer-Tests).
 */
import { describe, it, expect } from 'vitest';
import { monitorTeamName } from '../teamNameAbbrev';

describe('monitorTeamName', () => {
  it.each([
    ['@ZM-087 50-Zeichen-Name', 'Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921', 'SG FF Nordheim-Süd 1921'],
    ['@ZM-149 längste Folge zuerst', 'Turn- und Sportverein Ost', 'TSV Ost'],
    ['@ZM-149 Verein für Bewegungsspiele', 'Verein für Bewegungsspiele Stuttgart', 'VfB Stuttgart'],
    ['@ZM-149 Fußballsportverein', 'Fußballsportverein Mainz', 'FSV Mainz'],
    ['@ZM-149 Spielvereinigung', 'Spielvereinigung Fürth', 'SpVgg Fürth'],
    ['@ZM-149 Sportclub + Turnverein', 'Sportclub Turnverein', 'SC TV'],
    ['@ZM-149 Wort mitten im Namen', 'Nordheim Sportverein Süd', 'Nordheim SV Süd'],
  ])('%s', (_titel, voll, erwartet) => {
    expect(monitorTeamName(voll)).toBe(erwartet);
  });

  it.each([
    ['@ZM-149 ohne Listenwort', 'Eintracht Oberweiler-Niederstetten 1919'],
    ['@ZM-149 Listenwort nur Teil eines Worts (Sportvereinigung)', 'Sportvereinigung Nordheim'],
    ['@ZM-149 Listenwort nur Teil eines Worts (Sportvereinsheim)', 'Sportvereinsheim Ost'],
    ['@ZM-149 schon gekürzt', 'FC Nord'],
    ['@ZM-149 andere Schreibweise bleibt (Groß/klein wie Liste)', 'sportverein Nord'],
    ['@ZM-149 Bindestrich-Wort bleibt', 'Sportverein-Nord'],
    ['@ZM-087 kein Kürzel aus Anfangsbuchstaben', 'Größenwahn Übungsteam Füßen Ösen'],
  ])('%s: unverändert', (_titel, voll) => {
    expect(monitorTeamName(voll)).toBe(voll);
  });

  it('@ZM-087 gekürzte Namen sind nie Initialen-Kürzel wie GÜFÖ oder SFNS', () => {
    const text = monitorTeamName('Größenwahn Übungsteam Füßen Ösen Äpfel Ölkrug Ähre');
    expect(text).not.toContain('GÜFÖ');
    expect(text).not.toContain('SFNS');
    expect(text).toBe('Größenwahn Übungsteam Füßen Ösen Äpfel Ölkrug Ähre');
  });

  it('@ZM-088 hinterlegter Kurzname gewinnt (getrimmt)', () => {
    expect(monitorTeamName('Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921', ' SGFF ')).toBe('SGFF');
  });

  it.each([[''], ['   '], [undefined], [null]])('@ZM-149 leerer Kurzname (%j) gilt nicht', (kurz) => {
    expect(monitorTeamName('Sportgemeinschaft Ost', kurz)).toBe('SG Ost');
  });

  it('@ZM-149 mehrfache Leerzeichen werden zusammengezogen, wenn gekürzt wird', () => {
    expect(monitorTeamName('Sportverein   Ost')).toBe('SV Ost');
  });
});
