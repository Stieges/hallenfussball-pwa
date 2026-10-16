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
    ['@ZM-149 Verein für Leibesübungen', 'Verein für Leibesübungen Gießen', 'VfL Gießen'],
    ['@ZM-149 Verein für Rasenspiele', 'Verein für Rasenspiele Mülheim', 'VfR Mülheim'],
    ['@ZM-149 Ballspielverein', 'Ballspielverein Kirchheim', 'BV Kirchheim'],
    ['@ZM-149 Ballsportverein', 'Ballsportverein Rhein', 'BSV Rhein'],
    ['@ZM-149 Sportfreunde', 'Sportfreunde Lotte', 'SF Lotte'],
    ['@ZM-149 Turngemeinde', 'Turngemeinde Ahlen', 'TG Ahlen'],
    ['@ZM-149 Deutsche Jugendkraft', 'Deutsche Jugendkraft Berg', 'DJK Berg'],
    ['@ZM-149 Eisenbahner-Sportverein', 'Eisenbahner-Sportverein Süd', 'ESV Süd'],
    ['@ZM-149 Eisenbahnersportverein', 'Eisenbahnersportverein Süd', 'ESV Süd'],
    ['@ZM-149 Turn- und Spielvereinigung', 'Turn- und Spielvereinigung Ost', 'TuS Ost'],
    ['@ZM-149 „Turn und Sport“', 'Turn und Sport Ost', 'TuS Ost'],
    ['@ZM-149 Schreibweise Sport-Club (wie Sportclub)', 'Sport-Club Nord', 'SC Nord'],
    ['@ZM-149 Schreibweise Fußball-Club (wie Fußballclub)', 'Fußball-Club Nord', 'FC Nord'],
    ['@ZM-149 Zusatz „e. V.“ entfällt', 'Sportgemeinschaft Nordheim e. V.', 'SG Nordheim'],
    ['@ZM-149 Zusatz „e.V.“ entfällt', 'Sportverein Ost e.V.', 'SV Ost'],
    ['@ZM-149 „Turn und Sportverein“ ohne Bindestrich wie „Turn- und Sportverein“', 'Turn und Sportverein Ost', 'TSV Ost'],
    ['@ZM-149 Bindestrich an Wortfuge: Sport-Verein', 'Sport-Verein Nord', 'SV Nord'],
    ['@ZM-149 Bindestrich an Wortfuge: Turn-Verein', 'Turn-Verein Nord', 'TV Nord'],
    ['@ZM-149 Bindestrich an Wortfuge: Sport-Gemeinschaft', 'Sport-Gemeinschaft Ost', 'SG Ost'],
    ['@ZM-149 Bindestrich an Wortfuge: Fußball-Freunde', 'Fußball-Freunde Ost', 'FF Ost'],
    ['@ZM-149 Zusatz „e. V.“ mitten im Namen entfällt','Sportverein Ost e. V. Abteilung Hallenfußball', 'SV Ost Abteilung Hallenfußball'],
  ])('%s', (_titel, voll, erwartet) => {
    expect(monitorTeamName(voll)).toBe(erwartet);
  });

  it.each([
    ['@ZM-149 ohne Listenwort', 'Eintracht Oberweiler-Niederstetten 1919'],
    ['@ZM-149 Listenwort nur Teil eines Worts (Sportvereinigung)', 'Sportvereinigung Nordheim'],
    ['@ZM-149 Listenwort nur Teil eines Worts (Sportvereinsheim)', 'Sportvereinsheim Ost'],
    ['@ZM-149 Listenwort nur Teil eines Worts (Sportfreundeheim)', 'Sportfreundeheim Ost'],
    ['@ZM-149 Listenwort nur Teil eines Worts (Sportclubhaus mit Bindestrich)', 'Sport-Clubhaus Ost'],
    ['@ZM-149 Listenwort nur Teil eines Worts (Deutsche Jugendkraftwerk)', 'Deutsche Jugendkraftwerk Ost'],
    ['@ZM-149 Kürzel ohne Listenwort bleibt (TuS Koblenz)', 'TuS Koblenz'],
    ['@ZM-149 Bindestrich-Schreibweise nur mit Leerzeichen (Fußball Club, ohne Bindestrich)', 'Fußball Club Nord'],
    ['@ZM-149 e.V. mitten in einem Wort bleibt', 'Ost e.V.Team'],
    ['@ZM-149 schon gekürzt', 'FC Nord'],
    ['@ZM-149 andere Schreibweise bleibt (Groß/klein wie Liste)', 'sportverein Nord'],
    ['@ZM-149 Bindestrich-Wort bleibt', 'Sportverein-Nord'],
    ['@ZM-149 Bindestrich-Ortsname bleibt (Nordheim-Süd)', 'Nordheim-Süd 1921'],
    ['@ZM-149 Bindestrich-Schreibweise mit kleinem Anfangsbuchstaben bleibt (wie Liste)', 'sport-verein Nord'],
    ['@ZM-087 kein Kürzel aus Anfangsbuchstaben', 'Größenwahn Übungsteam Füßen Ösen'],
  ])('%s: unverändert', (_titel, voll) => {
    expect(monitorTeamName(voll)).toBe(voll);
  });

  it('@ZM-149 nur der Zusatz „e. V.“ ergibt keinen leeren Namen, sondern bleibt', () => {
    expect(monitorTeamName('e. V.')).toBe('e. V.');
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
