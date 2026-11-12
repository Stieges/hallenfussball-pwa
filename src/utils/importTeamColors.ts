/**
 * Trikotfarben eines Teams aus einer Import-Datei (@W1-043). Die Prüfung ist die der Leibchen-Logik (`normalizeKitColor`),
 * damit Import, Assistent und Konfliktprüfung dieselbe Farbangabe kennen.
 */
import type { ImportValidationError, TeamColors } from '../types/tournament';
import { normalizeKitColor } from '../core/models/kit';

/** Eine Farbangabe der Datei: fehlt sie (oder ist leer), ist das „keine Farbe“; sonst muss sie ein Hex-Wert sein. */
function parseColorValue(raw: unknown, field: string, teamName: string, errors: ImportValidationError[]): string | undefined {
  if (raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')) { return undefined; }
  const normalized = typeof raw === 'string' ? normalizeKitColor(raw.trim()) : undefined;
  if (normalized === undefined) {
    errors.push({
      code: 'INVALID_TEAM_COLOR',
      field,
      message: `Team „${teamName}“: „${String(raw)}“ ist keine gültige Farbangabe (erwartet wird z. B. #1565C0)`,
    });
  }
  return normalized;
}

/**
 * @W1-043: Trikotfarben eines Teams aus der Datei (`colors.primary`, optional `colors.secondary`).
 * Ohne Farbe entsteht – wie bei einem im Assistenten angelegten Team – gar kein `colors`-Feld.
 */
export function parseTeamColors(
  raw: unknown,
  teamName: string,
  index: number,
  errors: ImportValidationError[],
): { colors?: TeamColors } {
  if (raw === undefined || raw === null) { return {}; }
  const field = `teams[${index}].colors`;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    errors.push({
      code: 'INVALID_TEAM_COLOR',
      field,
      message: `Team „${teamName}“: „${String(raw)}“ ist keine gültige Farbangabe (erwartet wird { "primary": "#1565C0" })`,
    });
    return {};
  }
  const obj = raw as Record<string, unknown>;
  const primary = parseColorValue(obj.primary, `${field}.primary`, teamName, errors);
  const secondary = parseColorValue(obj.secondary, `${field}.secondary`, teamName, errors);
  if (primary === undefined) { return {}; }
  return { colors: secondary === undefined ? { primary } : { primary, secondary } };
}
