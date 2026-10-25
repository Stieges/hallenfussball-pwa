/**
 * Maße der Kopfzeile der Tafel (Abzeichen mit 44-px-Tippfläche, die über die Zeile hinausragt): Höhe der Zeile und der Überstand.
 * Eigene Datei, damit `ScoreboardAbzeichen.tsx` nur eine Komponente exportiert (Fast Refresh).
 */
import { cssVars } from '../../../design-tokens';

/** Höhe der Kopfzeile; die Tippfläche der Abzeichen (44 px) ragt darüber hinaus (`ueberstand`) und braucht dort Platz. */
export const zeileHoehe = (gross: boolean): string => (gross ? cssVars.spacing.xl : cssVars.spacing.lg);
export const ueberstandVon = (hoehe: string): string => `max(0px, calc((${cssVars.touchTargets.minimum} - ${hoehe}) / 2))`;
