/** Beschriftungen der drei Eröffnungsarten (@W4-033, @W4-048); wörtliche Schlüssel, damit die Typprüfung sie kennt. */
import type { OpeningMode } from '../../../types/tournament';

export const HOST_MODE_TEXT: Record<OpeningMode, { title: string; description: string }> = {
  'guest-opening': { title: 'step4.host.mode.guest.title', description: 'step4.host.mode.guest.description' },
  'club-derby': { title: 'step4.host.mode.derby.title', description: 'step4.host.mode.derby.description' },
  'both-home': { title: 'step4.host.mode.bothHome.title', description: 'step4.host.mode.bothHome.description' },
};
