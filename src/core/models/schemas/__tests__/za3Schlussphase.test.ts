/**
 * ZA-3 D2 / H3 – Länge der angehaltenen Schlussphase (@W2A-040, @SL-136, @SL-003) und ungültige
 * Einzelwerte der Regel-Felder (Review ZA-0, H3: gleiche Vorgabe wie der SQL-Zwilling).
 *
 * Testwerte aus dem Gherkin (docs/anforderungen/2026-09-27_wizard-regelinhalte.md @W2A-040,
 * 2026-10-02_spiel-leiten.md @SL-136/@SL-003). Die Anzeige am Feld/im Wizard ist B-08e (Spur B).
 */
import { describe, expect, it } from 'vitest';
import { TournamentSchema } from '../TournamentSchema';
import { DEFAULT_MATCH_COCKPIT_SETTINGS, completeMatchCockpitSettings } from '../../../../types/tournament';
import { finalPhaseValid, getClockDisplay } from '../../../match/clockDisplay';

function turnierMit(settings: unknown) {
  return {
    id: 't-1',
    title: 'Hallencup',
    teams: [],
    matches: [],
    sport: 'football',
    sportId: 'football',
    tournamentType: 'classic',
    mode: 'classic',
    createdAt: '2026-10-17T10:00:00.000Z',
    updatedAt: '2026-10-17T10:00:00.000Z',
    matchCockpitSettings: settings,
  };
}

describe('@W2A-040 Die Länge der angehaltenen Schlussphase ist einstellbar', () => {
  it('@W2A-040 vorbelegt ist 1 Minute (neues Turnier, alte Konfiguration ohne Feld)', () => {
    expect(DEFAULT_MATCH_COCKPIT_SETTINGS.finalPhaseMinutes).toBe(1);
    expect(completeMatchCockpitSettings({ penaltyShootersPerTeam: 5 })?.finalPhaseMinutes).toBe(1);
  });

  it.each([1, 2, 5])('@W2A-040 %i Minute(n) sind wählbar', (minuten) => {
    expect(TournamentSchema.safeParse(turnierMit({ finalPhaseMinutes: minuten })).success).toBe(true);
  });

  it.each([0, 6, 2.5])('@W2A-040 Gegenbeispiel: %s Minuten liegen außerhalb von 1 bis 5 und werden abgelehnt', (minuten) => {
    expect(TournamentSchema.safeParse(turnierMit({ finalPhaseMinutes: minuten })).success).toBe(false);
  });

  it('@W2A-040 länger als ein Abschnitt (4 Minuten bei Abschnitten zu 3 Minuten): ungültig, gültiger Bereich 1 bis 3', () => {
    expect(finalPhaseValid({ finalPhaseMinutes: 4 }, 180)).toEqual({ valid: false, range: { min: 1, max: 3 } });
  });

  it('@W2A-040 bei Abschnitten zu 6 Minuten bleibt der Bereich 1 bis 5 (7 Minuten ungültig, 5 gültig)', () => {
    expect(finalPhaseValid({ finalPhaseMinutes: 7 }, 360)).toEqual({ valid: false, range: { min: 1, max: 5 } });
    expect(finalPhaseValid({ finalPhaseMinutes: 5 }, 360)).toEqual({ valid: true, range: { min: 1, max: 5 } });
  });

  it('@W2A-040 Gegenbeispiel: Abschnitt kürzer als eine Minute – keine Länge ist gültig, kein Bereich', () => {
    expect(finalPhaseValid({ finalPhaseMinutes: 1 }, 45)).toEqual({ valid: false, range: null });
  });
});

describe('@SL-136 Die angehaltene Schlussphase kann länger als eine Minute sein', () => {
  const zweiterAbschnitt = { abschnittSekunden: 360, abschnitt: 2, abschnitteGesamt: 2, angehalten: false } as const;

  it('@SL-136 Schlussphase 2 Minuten, Abschnitte zu 6 Minuten: bei 3:59 kein Hinweis, Uhr ohne Hervorhebung', () => {
    const d = getClockDisplay({ ...zweiterAbschnitt, gespielt: 239, uhrArt: 'durchlaufend-letzte-minute-angehalten', schlussphaseMinuten: 2 });
    expect(d.hinweisUhrHaelt).toBe(false);
    expect(d.hervorhebung).toBe(false);
  });

  it('@SL-136 bei 4:00 beginnt die Schlussphase: Schlussphasen-Farbe, ab jetzt wird bei jeder Unterbrechung angehalten', () => {
    const d = getClockDisplay({ ...zweiterAbschnitt, gespielt: 240, uhrArt: 'durchlaufend-letzte-minute-angehalten', schlussphaseMinuten: 2 });
    expect(d.phase).toBe('schlussphaseAngehalten');
    expect(d.hervorhebung).toBe(true);
    expect(d.hinweisUhrHaelt).toBe(true);
  });

  it('@SL-136 ohne Angabe gilt die Vorgabe 1 Minute: bei 4:00 noch keine Schlussphase, bei 5:00 schon', () => {
    const vor = getClockDisplay({ ...zweiterAbschnitt, gespielt: 240, uhrArt: 'durchlaufend-letzte-minute-angehalten' });
    const ab = getClockDisplay({ ...zweiterAbschnitt, gespielt: 300, uhrArt: 'durchlaufend-letzte-minute-angehalten' });
    expect(vor.hervorhebung).toBe(false);
    expect(ab.hervorhebung).toBe(true);
  });

  it('@SL-003 Gegenbeispiel: „immer angehalten“ bei 5:30 – Hinweis ja, eine Schlussphase gibt es nicht', () => {
    const d = getClockDisplay({ ...zweiterAbschnitt, gespielt: 330, uhrArt: 'immer-angehalten', schlussphaseMinuten: 2 });
    expect(d.phase).toBe('normal');
    expect(d.hervorhebung).toBe(false);
    expect(d.hinweisUhrHaelt).toBe(true);
  });
});

describe('H3 ungültige Einzelwerte fallen auf die Vorgabe zurück (wie der SQL-Zwilling)', () => {
  it.each([
    { feld: 'clockMode', wert: 'immer-stehend' },
    { feld: 'foulLimit', wert: 0 },
    { feld: 'foulLimit', wert: '5' },
    { feld: 'enabledCards', wert: 'alle' },
    { feld: 'penaltyEndsOnGoal', wert: 'ja' },
    { feld: 'shortHandedSeconds', wert: -5 },
    { feld: 'finalPhaseMinutes', wert: 6 },
  ])('$feld = $wert → Vorgabe', ({ feld, wert }) => {
    const ergaenzt = completeMatchCockpitSettings({ [feld]: wert }) as unknown as Record<string, unknown>;
    expect(ergaenzt[feld]).toEqual((DEFAULT_MATCH_COCKPIT_SETTINGS as unknown as Record<string, unknown>)[feld]);
  });

  it('eine einzelne ungültige Kartenart fällt zurück, die gültigen bleiben', () => {
    const ergaenzt = completeMatchCockpitSettings({ enabledCards: { yellow: false, red: 'nein' } });
    expect(ergaenzt?.enabledCards).toEqual({ yellow: false, yellowRed: true, red: true, timePenalty: true });
  });

  it('Gegenbeispiel: gültige Werte bleiben, foulLimit null (ausgeschaltet) bleibt null', () => {
    const ergaenzt = completeMatchCockpitSettings({ clockMode: 'immer-angehalten', foulLimit: null, finalPhaseMinutes: 3, shortHandedSeconds: 60 });
    expect(ergaenzt).toMatchObject({ clockMode: 'immer-angehalten', foulLimit: null, finalPhaseMinutes: 3, shortHandedSeconds: 60 });
  });
});
