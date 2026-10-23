/**
 * Test-ID einer Gruppe (GA4 A-13c, Auflage 1): genau EINE Stelle übersetzt die Gruppenkennung der Engine in die der Oberfläche.
 * Jeder gegen jeden ist Gruppe `''` (`OVERALL_GROUP`), in der Oberfläche `all` – `group-close-button-all`, `group-state-all`.
 * Nirgends sonst wird `'all'` in eine Gruppenkennung übersetzt.
 */
import { OVERALL_GROUP } from '../../../core/models/standingsGroups';

export const groupTestId = (groupId: string): string => (groupId === OVERALL_GROUP ? 'all' : groupId);
