/**
 * B-05 — @W4-020: Die Zeit-Empfehlung rechnet bei Gruppenphase + Finalrunde
 * mit den tatsächlichen Spielen.
 *
 * Gegeben 2 Gruppen zu je 4 Teams mit Halbfinale, Spiel um Platz 3 und Finale
 * Wenn die App die Empfehlung berechnet
 * Dann rechnet sie mit 12 Gruppenspielen (2 × 6) und 4 Finalspielen, zusammen 16
 * Und nicht mit jeder gegen jeden über alle 8 Teams (28 Spiele)
 *
 * Gegenbeispiele: jeder gegen jeden (eine Gruppe) → 28; ungleiche Gruppen 5+4 → 10+6;
 * nur Finale → +1.
 * Mutation: Formel zurück auf n·(n−1)/2 → rot; Finalrunde nicht mitgezählt → rot.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  buildConstraintsList,
  calculateRecommendation,
  countTournamentMatches,
  loadStoredConfig,
  saveStoredConfig,
} from '../utils/smartConfigCalculator';

describe('@W4-020 Zeit-Empfehlung zählt tatsächliche Spiele', () => {
  it('8 Teams, 2 Gruppen à 4, Top 4 (HF + Platz 3 + Finale) → 16 Spiele', () => {
    const result = calculateRecommendation(10, 8, {}, { groupCount: 2, finalsPlan: 'top-4' });
    expect(result.recommendation?.totalMatches).toBe(16);
    expect(countTournamentMatches(8, { groupCount: 2, finalsPlan: 'top-4' })).toBe(16);
  });

  it('Gegenbeispiel: jeder gegen jeden über alle 8 Teams → 28 Spiele', () => {
    const result = calculateRecommendation(10, 8);
    expect(result.recommendation?.totalMatches).toBe(28);
    expect(countTournamentMatches(8)).toBe(28);
  });

  it('eine Gruppe ohne Finalrunde ist jeder gegen jeden → 28 Spiele', () => {
    expect(countTournamentMatches(8, { groupCount: 1, finalsPlan: 'none' })).toBe(28);
  });

  it('Gruppenphase ohne Finalrunde → 12 Gruppenspiele', () => {
    expect(countTournamentMatches(8, { groupCount: 2, finalsPlan: 'none' })).toBe(12);
  });

  it('ungleiche Gruppen: 9 Teams in 2 Gruppen 5+4 → 10 + 6 = 16 Gruppenspiele', () => {
    expect(countTournamentMatches(9, { groupCount: 2, finalsPlan: 'none' })).toBe(16);
  });

  it('ungleiche Gruppen mit Top 4 → 16 + 4 Finalspiele = 20', () => {
    expect(countTournamentMatches(9, { groupCount: 2, finalsPlan: 'top-4' })).toBe(20);
  });

  it('nur Finale (2 Gruppen) → 12 + 1 = 13', () => {
    expect(countTournamentMatches(8, { groupCount: 2, finalsPlan: 'final-only' })).toBe(13);
  });

  it('Finalrunde ohne Gruppen wird nicht gezählt (jeder gegen jeden)', () => {
    expect(countTournamentMatches(8, { finalsPlan: 'top-4' })).toBe(28);
  });
});

describe('@W4-020 Rechenkern: Grenzfälle und Fallback mit Spielstruktur', () => {
  it('Einschränkung nicht erfüllbar → constraintsImpossible mit Mindeststunden', () => {
    const result = calculateRecommendation(0.1, 8, { gameDuration: 10 });
    expect(result.recommendation).toBeNull();
    expect(result.constraintsImpossible).toBe(true);
    expect(result.minRequiredHours).toBeGreaterThan(0.1);
  });

  it('ohne Einschränkung zu wenig Zeit → Fallback mit reduzierten Teams, Spielzahl aus Struktur', () => {
    const result = calculateRecommendation(0.05, 8, {}, { groupCount: 2, finalsPlan: 'top-4' });
    // 8 Teams → floor(8 * 0.7) = 5 Teams in 2 Gruppen (3 + 2) → 3 + 1 Gruppenspiele, + 4 Finalspiele
    expect(result.constraintsImpossible).toBe(false);
    expect(result.recommendation?.teams).toBe(5);
    expect(result.recommendation?.totalMatches).toBe(8);
  });

  it('Einschränkung für Pause und Felder wird eingehalten', () => {
    const result = calculateRecommendation(10, 8, { breakDuration: 2, fields: 2 });
    expect(result.recommendation?.breakDuration).toBe(2);
    expect(result.recommendation?.fields).toBe(2);
  });

  it('ohne Einschränkung und ohne Struktur → Fallback zählt jeder gegen jeden', () => {
    const result = calculateRecommendation(0.05, 20);
    expect(result.recommendation?.teams).toBe(14);
    expect(result.recommendation?.totalMatches).toBe(91);
  });
});

describe('@W4-020 Hilfsfunktionen des Smart-Config-Moduls', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loadStoredConfig liefert Standard ohne Eintrag und den gespeicherten Stand mit Eintrag', () => {
    expect(loadStoredConfig()).toEqual({ lastHours: 4 });
    saveStoredConfig({ lastHours: 2.5 });
    expect(loadStoredConfig().lastHours).toBe(2.5);
  });

  it('loadStoredConfig ignoriert defektes JSON und liefert Standard', () => {
    store.set('smartConfig', '{kaputt');
    expect(loadStoredConfig()).toEqual({ lastHours: 4 });
  });

  it('buildConstraintsList: Gruppen nur bei Gruppenmodus, Singular bei einem Feld', () => {
    expect(buildConstraintsList({ teams: 8, groups: 2, fields: 1 }, false)).toEqual([
      '8 Teams',
      '1 Feld',
    ]);
    expect(
      buildConstraintsList({ groups: 2, fields: 2, gameDuration: 10, breakDuration: 3 }, true)
    ).toEqual(['2 Gruppen', '2 Felder', '10 Min Spieldauer', '3 Min Pause']);
    expect(buildConstraintsList({ breakDuration: 3, groups: 2 }, false)).toEqual(['3 Min Pause']);
  });
});
