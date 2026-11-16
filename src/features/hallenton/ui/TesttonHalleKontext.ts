/**
 * Kontext des Testtons in der Halle (H4-11): die Seite „Hallenton“ hält den Zustand einmal (`useTesttonHalle`), die Taste im Abschnitt „Testton“, die
 * Empfehlung bei der Ausgangswahl und die Pille „🔈? Prüfen“ lesen und lösen denselben Auftrag aus. Ohne Seite (`null`) gibt es keine solche Taste.
 */
import { createContext, useContext } from 'react';
import type { TesttonHalle } from './useTesttonHalle';

export const TesttonHalleKontext = createContext<TesttonHalle | null>(null);

export function useTesttonHalleKontext(): TesttonHalle | null {
  return useContext(TesttonHalleKontext);
}
