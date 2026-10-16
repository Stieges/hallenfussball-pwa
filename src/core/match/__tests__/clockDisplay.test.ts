/**
 * @ZM-139 Restzeit zentral · @ZM-137 Hervorhebung in der angehaltenen Schlussphase
 * Reine Funktion, keine React-Abhängigkeit.
 */
import { describe, it, expect } from 'vitest';
import {
  getClockDisplay,
  DEFAULT_CLOCK_MODE,
  SCHLUSSPHASE_SEKUNDEN,
  type ClockMode,
} from '../clockDisplay';

describe('@ZM-139 Restzeit des Abschnitts (zentrale Funktion)', () => {
  it('Spiel 11: 6 Minuten Abschnitt, bei gespielten 4:10 steht die Uhr bei Restzeit 1:50', () => {
    const d = getClockDisplay({ gespielt: 250, abschnittSekunden: 360, uhrArt: 'immer-durchlaufend', angehalten: false });
    expect(d.restSekunden).toBe(110);
    expect(d.phase).toBe('normal');
  });

  it('zählt herunter statt gespielte Zeit zu zeigen (Gegenbeispiel: gespielt 0 ist nicht Restzeit 0)', () => {
    const d = getClockDisplay({ gespielt: 0, abschnittSekunden: 600, uhrArt: DEFAULT_CLOCK_MODE, angehalten: false });
    expect(d.restSekunden).toBe(600);
  });

  it('nach Ablauf: Restzeit 0 und Phase abgelaufen, nie weiterlaufende Zeit', () => {
    const d = getClockDisplay({ gespielt: 900, abschnittSekunden: 600, uhrArt: DEFAULT_CLOCK_MODE, angehalten: false });
    expect(d.restSekunden).toBe(0);
    expect(d.phase).toBe('abgelaufen');
    expect(d.hinweisUhrHaelt).toBe(false);
  });
});

describe('@ZM-137 Uhr-Art × Zeitpunkte (Tabelle)', () => {
  // Abschnitt 120 s, Schlussphase = letzte Minute (60 s, Vorgabe)
  const abschnitt = 120;
  const zeitpunkte: Array<{ uhrArt: ClockMode; gespielt: number; angehalten: boolean; phase: string; hinweis: boolean; angehaltenText: boolean }> = [
    // letzte Minute angehalten: vor der Schlussphase neutral, ab 1:00 Rest 1:00 hervorgehoben
    { uhrArt: 'durchlaufend-letzte-minute-angehalten', gespielt: 59, angehalten: false, phase: 'normal', hinweis: false, angehaltenText: false },
    { uhrArt: 'durchlaufend-letzte-minute-angehalten', gespielt: 60, angehalten: false, phase: 'schlussphaseAngehalten', hinweis: true, angehaltenText: false },
    { uhrArt: 'durchlaufend-letzte-minute-angehalten', gespielt: 119, angehalten: false, phase: 'schlussphaseAngehalten', hinweis: true, angehaltenText: false },
    { uhrArt: 'durchlaufend-letzte-minute-angehalten', gespielt: 119, angehalten: true, phase: 'schlussphaseAngehalten', hinweis: true, angehaltenText: true },
    { uhrArt: 'durchlaufend-letzte-minute-angehalten', gespielt: 30, angehalten: true, phase: 'normal', hinweis: false, angehaltenText: false },
    { uhrArt: 'durchlaufend-letzte-minute-angehalten', gespielt: 120, angehalten: false, phase: 'abgelaufen', hinweis: false, angehaltenText: false },
    // immer angehalten: Hinweis das ganze Spiel, keine Farbe
    { uhrArt: 'immer-angehalten', gespielt: 10, angehalten: false, phase: 'normal', hinweis: true, angehaltenText: false },
    { uhrArt: 'immer-angehalten', gespielt: 100, angehalten: true, phase: 'normal', hinweis: true, angehaltenText: true },
    { uhrArt: 'immer-angehalten', gespielt: 120, angehalten: false, phase: 'abgelaufen', hinweis: false, angehaltenText: false },
    // immer durchlaufend: nie Hervorhebung, nie Hinweis
    { uhrArt: 'immer-durchlaufend', gespielt: 100, angehalten: false, phase: 'normal', hinweis: false, angehaltenText: false },
    { uhrArt: 'immer-durchlaufend', gespielt: 119, angehalten: true, phase: 'normal', hinweis: false, angehaltenText: false },
    { uhrArt: 'immer-durchlaufend', gespielt: 120, angehalten: false, phase: 'abgelaufen', hinweis: false, angehaltenText: false },
  ];

  it.each(zeitpunkte)('$uhrArt gespielt=$gespielt angehalten=$angehalten → $phase', (fall) => {
    const d = getClockDisplay({ gespielt: fall.gespielt, abschnittSekunden: abschnitt, uhrArt: fall.uhrArt, angehalten: fall.angehalten });
    expect(d.phase).toBe(fall.phase);
    expect(d.hinweisUhrHaelt).toBe(fall.hinweis);
    expect(d.angehalten).toBe(fall.angehaltenText);
    expect(d.hervorhebung).toBe(fall.phase === 'schlussphaseAngehalten');
  });

  it('Schlussphase ist vorbelegt eine Minute (@SL-003 / Uhr-Art-Vorgabe)', () => {
    expect(SCHLUSSPHASE_SEKUNDEN).toBe(60);
    expect(DEFAULT_CLOCK_MODE).toBe('durchlaufend-letzte-minute-angehalten');
  });

  it('Gegenbeispiel: eine feste Minute (Hervorhebung ab 5:00 Rest) wird nicht verwendet', () => {
    // bei 6-Minuten-Abschnitt beginnt die Schlussphase bei Rest 60 s; bei Rest 300 s (gespielt 60) ist sie neutral
    const d = getClockDisplay({ gespielt: 60, abschnittSekunden: 360, uhrArt: 'durchlaufend-letzte-minute-angehalten', angehalten: false });
    expect(d.phase).toBe('normal');
  });
});

describe('M1 Abschnitte, Verlängerung, Schlussphase-Länge (@SL-069, @SL-136, @SL-081, @ZM-139)', () => {
  it('@SL-069: in der letzten Minute des ersten Abschnitts (2 Abschnitte) gibt es keine Hervorhebung', () => {
    const d = getClockDisplay({ gespielt: 300, abschnittSekunden: 360, uhrArt: 'durchlaufend-letzte-minute-angehalten', angehalten: true, abschnitt: 1, abschnitteGesamt: 2 });
    expect(d.phase).toBe('normal');
    expect(d.hervorhebung).toBe(false);
    expect(d.hinweisUhrHaelt).toBe(false);
  });

  it('@SL-069 Gegenbeispiel: im letzten Abschnitt zählt dieselbe Minute', () => {
    const d = getClockDisplay({ gespielt: 300, abschnittSekunden: 360, uhrArt: 'durchlaufend-letzte-minute-angehalten', angehalten: false, abschnitt: 2, abschnitteGesamt: 2 });
    expect(d.phase).toBe('schlussphaseAngehalten');
  });

  it('@SL-136: Schlussphase 2 Minuten, Abschnitt 6 Minuten: 3:59 kein Hinweis, 4:00 Hervorhebung', () => {
    const vor = getClockDisplay({ gespielt: 239, abschnittSekunden: 360, uhrArt: 'durchlaufend-letzte-minute-angehalten', angehalten: false, schlussphaseSekunden: 120, abschnitt: 2, abschnitteGesamt: 2 });
    const ab = getClockDisplay({ gespielt: 240, abschnittSekunden: 360, uhrArt: 'durchlaufend-letzte-minute-angehalten', angehalten: false, schlussphaseSekunden: 120, abschnitt: 2, abschnitteGesamt: 2 });
    expect(vor.hinweisUhrHaelt).toBe(false);
    expect(ab.hervorhebung).toBe(true);
  });

  it('Verlängerung: die letzte Minute der Verlängerung ist die Schlussphase', () => {
    const d = getClockDisplay({ gespielt: 300, abschnittSekunden: 360, uhrArt: 'durchlaufend-letzte-minute-angehalten', angehalten: false, verlaengerung: true, abschnitt: 1, abschnitteGesamt: 2 });
    expect(d.phase).toBe('schlussphaseAngehalten');
  });
});
