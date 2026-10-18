import type { LiveColorScheme } from '../../types/monitor';

/** Teamfarbe (wenn eingeschaltet und vorhanden), sonst Farbe des Schemas für die Seite. */
export function resolveColor(
  position: 'home' | 'away',
  scheme: LiveColorScheme,
  team?: { colors?: { primary?: string } },
): string {
  if (scheme.useTeamColors && team?.colors?.primary) {
    return team.colors.primary;
  }
  return position === 'home' ? scheme.homeColor : scheme.awayColor;
}
