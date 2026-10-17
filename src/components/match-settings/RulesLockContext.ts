/**
 * Sperre für Spielregeln (@W2A-030): Wer keine Turnierleitung ist, sieht die Regelfelder
 * der Cockpit-Einstellungen gesperrt. Der Provider setzt der Aufrufer (Spielsteuerung bzw.
 * Admin-Kategorie) anhand der vorhandenen Rechte-Logik; das Panel liest nur den Wert.
 */
import { createContext, useContext } from 'react';

const RulesLockContext = createContext<boolean>(false);

export const RulesLockProvider = RulesLockContext.Provider;

export function useRulesLocked(): boolean {
  return useContext(RulesLockContext);
}
