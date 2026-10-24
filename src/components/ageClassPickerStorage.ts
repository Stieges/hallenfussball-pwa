/**
 * Zuletzt genutzte Schreibweise der Altersklasse (@W2B-025): reiner Komfort je Gerät, kein Konto, keine Cloud.
 * Fehlt der Speicher oder wirft er, gilt die erste Schreibweise der Sportart.
 */
import type { AgeGroupId } from '../core/view';

const KEY = 'hallenfussball.ageClassGroup';

export function readLastAgeGroup(): AgeGroupId | null {
  try {
    const stored = window.localStorage.getItem(KEY);
    return stored === 'youth' || stored === 'uClasses' || stored === 'adults' || stored === 'general' ? stored : null;
  } catch {
    return null;
  }
}

export function writeLastAgeGroup(group: AgeGroupId): void {
  try {
    window.localStorage.setItem(KEY, group);
  } catch {
    // Speicher gesperrt oder voll: die Vorwahl entfällt, mehr nicht.
  }
}
