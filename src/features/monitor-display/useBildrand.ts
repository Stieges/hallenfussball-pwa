import type { TournamentMonitor, PerformanceSettings } from '../../types/monitor';
import { usePixelShift } from '../../hooks/usePixelShift';
import { maxPixelVerschiebung, randAusAdresse, sichererBereichStyle, wirksamerRand } from './overscan';

/**
 * Bildrand der Monitor-Seite (@ME-067, @ME-020) und Einbrennschutz.
 *
 * Gespeicherter Rand in Prozent; `?rand=` in der Adresse überschreibt ihn nur für diese Sitzung (R-MS-3).
 * Die Verschiebung gegen Einbrennen wächst mit dem Rand und entfällt ohne Rand, sonst würde sie Inhalt abschneiden.
 */
export function useBildrand(monitor: TournamentMonitor | null, performanceSettings: PerformanceSettings) {
  const overscanPercent = wirksamerRand(
    monitor?.overscanPercent,
    randAusAdresse(window.location.hash, window.location.search),
  );
  const maxPixelShift = maxPixelVerschiebung(overscanPercent, window.innerHeight);
  const pixelShift = usePixelShift(60_000, maxPixelShift, performanceSettings.enableAnimations);
  return { overscanPercent, pixelShift, sichererBereich: sichererBereichStyle(overscanPercent) };
}
