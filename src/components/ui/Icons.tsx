/**
 * Sammel-Export aller Symbole. Die Symbole selbst stehen nach Gruppen getrennt unter `ui/icons/` (Datei zu lang, B-26);
 * Name und Aufruf (`Icons.Plus`) bleiben gleich. Neue Symbole kommen in die passende Gruppe.
 */
import { iconsAktion } from './icons/iconsAktion';
import { iconsGeraet } from './icons/iconsGeraet';
import { iconsNavigation } from './icons/iconsNavigation';
import { iconsPfeile } from './icons/iconsPfeile';
import { iconsStatus } from './icons/iconsStatus';

export const Icons = {
  ...iconsAktion,
  ...iconsPfeile,
  ...iconsNavigation,
  ...iconsStatus,
  ...iconsGeraet,
};
