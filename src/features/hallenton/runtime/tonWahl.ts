/**
 * Tonwahl des Hallen-Lautsprechers (H3b-2b Fixrunde 1, Ruling Ledger 07.11., @HT-025, @HT-027, @HT-028):
 * - Abpfiff: die Hupe aus den Turnier-Einstellungen `matchCockpitSettings.soundId` (wie heute im Cockpit, IDs wie
 *   `PRESET_SOUNDS`); ein eigener Abpfiff-Ton (`endCustomPath` aus `hall_sound_status`) hat Vorrang. Fehlt die Hupe oder ist
 *   es der eigene Ton des Cockpits (`custom`, liegt nur lokal im Browser, kein `blob:` wegen CSP), gilt „Hupe 1“.
 * - Halbzeit: `halftimeSound` aus `hall_sound_status`, bei `custom` der eigene Ton (`halftimeCustomPath`).
 * Eigene Töne über die öffentliche Storage-Adresse (`oeffentlicheUrl`); lädt er nicht, fällt der Spieler auf „Hupe 1“ zurück.
 */
import type { HallStatusVoll } from '../../../core/repositories/hallentonRpc';
import type { MatchSoundPreset } from '../../../types/tournament';
import type { HupenId, TonArt, TonWahl } from './hallTonSpieler';

export const VORBELEGUNG: Record<TonArt, TonWahl> = { abpfiff: 'horn-1', halbzeit: 'horn-1' };

const HUPEN: readonly string[] = ['horn-1', 'horn-2', 'horn-3'];
const alsHupe = (id: string | null | undefined): HupenId => (id && HUPEN.includes(id) ? (id as HupenId) : 'horn-1');

export function tonWahlAus(
  soundId: MatchSoundPreset | null | undefined,
  settings: HallStatusVoll['settings'] | null,
  oeffentlicheUrl: (pfad: string) => string,
): Record<TonArt, TonWahl> {
  const abpfiff: TonWahl = settings?.endCustomPath ? { eigeneUrl: oeffentlicheUrl(settings.endCustomPath) } : alsHupe(soundId);
  const halbzeit: TonWahl = settings?.halftimeSound === 'custom' && settings.halftimeCustomPath
    ? { eigeneUrl: oeffentlicheUrl(settings.halftimeCustomPath) }
    : alsHupe(settings?.halftimeSound);
  return { abpfiff, halbzeit };
}
