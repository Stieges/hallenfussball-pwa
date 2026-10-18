import type { TFunction } from 'i18next';
import type { Uebersetzer } from './cockpitTypes';

/**
 * `t` des Namensraums `cockpit` als `Uebersetzer` für die reinen Modelle: Sie wählen Schlüssel zur Laufzeit aus
 * Tabellen (`ZUSTAND_KEY`), die streng typisierte `t`-Funktion kennt nur Schlüssel-Literale.
 */
export function alsUebersetzer(t: TFunction<'cockpit'>): Uebersetzer {
  return (key, options) => String(t(key as never, options as never));
}
