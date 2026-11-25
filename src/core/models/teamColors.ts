/**
 * Trikotfarbe eines Teams ohne Farbe (@W3-042): „keine Farbe“ heißt `colors` fehlt (oder `primary` ist leer) – derselbe Zustand wie bei
 * einem Team, dem im Assistenten nie eine Farbe gegeben wurde. Die Anzeige nimmt dafür das Fallback-Muster (@ZM-203, @SL-176).
 */
import type { TeamColors } from '../../types/tournament';

/** Gesetzte Trikotfarbe oder `undefined` („Unbekannt“). */
export function primaryColorOf(colors: TeamColors | undefined): string | undefined {
  const primary = colors?.primary;
  return primary === undefined || primary === '' ? undefined : primary;
}

/** Neue Teamfarben mit gesetzter Trikotfarbe; `undefined` stellt „Unbekannt“ wieder her (ohne Zweitfarbe entfällt `colors` ganz). */
export function withPrimaryColor(colors: TeamColors | undefined, primary: string | undefined): TeamColors | undefined {
  if (primary !== undefined) { return { ...colors, primary }; }
  return colors?.secondary === undefined ? undefined : { primary: '', secondary: colors.secondary };
}
