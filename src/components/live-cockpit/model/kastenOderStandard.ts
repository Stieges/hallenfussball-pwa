/**
 * kastenOderStandard – die Kästen des Cockpits; ohne Angabe (Spiel noch nicht im Turnier, Vorschau) die Standardfarben Heim/Gast
 * wie am Hallenmonitor ohne Ansicht (`LiveMatchDisplay`, @ZM-159 Fall A).
 */
import { resolveBoxColors } from '../../../core/models/scoreBoxColors';
import { DEFAULT_SPECTATOR_DISPLAY } from '../../../core/models/spectatorDisplay';
import type { CockpitKasten } from '../typesFarben';

const STANDARD: CockpitKasten = (() => {
  const { a, b } = resolveBoxColors({ worn: {}, settings: DEFAULT_SPECTATOR_DISPLAY });
  return { home: a, away: b };
})();

export function kastenOderStandard(kasten: CockpitKasten | undefined): CockpitKasten {
  return kasten ?? STANDARD;
}
