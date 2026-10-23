/**
 * Steuer je Feld aus Sicht dieses Geräts (B-49, rein, ohne React): aus dem Stand `field_control_state` wird für ein Feld
 * „frei“, „dieses Gerät“, „anderes Gerät“ oder „unbekannt“.
 *
 * - `foreign` heißt: ein anderes Gerät steuert (auch ein anderes Gerät desselben Kontos, @HE-049) – dieses Gerät ist nur
 *   lesend (@FU-026, @SL-046).
 * - `unknown` (Gast, ohne Netz seit dem Öffnen, noch nicht gelesen): die App sperrt nichts, der Server entscheidet
 *   (Einträge eines fremden Feldes lehnt er mit NOT_CONTROLLER ab). Der zuletzt gelesene Stand bleibt ohne Netz gültig.
 * - `free`: nie oder nicht mehr gesteuert; der erste Anpfiff mit Geräte-ID macht dieses Gerät zum Halter (@FU-030).
 */
import type { FieldControlInfo } from '../repositories/fieldControlRpc';

export type FieldControlView =
  | { kind: 'unknown'; epoch: 0 }
  | { kind: 'free'; epoch: number }
  | { kind: 'mine'; epoch: number; info: FieldControlInfo }
  | { kind: 'foreign'; epoch: number; info: FieldControlInfo };

/** Halter belegt: der Server setzt `claimedAt` genau dann, wenn `holder_user_id` gesetzt ist (Name und Rolle können fehlen). */
function hasHolder(info: FieldControlInfo): boolean {
  return info.isMine || info.claimedAt !== null;
}

export function fieldControlView(list: readonly FieldControlInfo[] | null, field: number): FieldControlView {
  if (list === null) {
    return { kind: 'unknown', epoch: 0 };
  }
  const info = list.find((entry) => entry.field === field);
  if (!info || !hasHolder(info)) {
    return { kind: 'free', epoch: info?.epoch ?? 0 };
  }
  return info.isMine ? { kind: 'mine', epoch: info.epoch, info } : { kind: 'foreign', epoch: info.epoch, info };
}

/** Darf dieses Gerät auf dem Feld eintragen? Nur ein fremd gesteuertes Feld sperrt (Recht `writeMatchData` prüft der Aufrufer). */
export function mayControlField(view: FieldControlView): boolean {
  return view.kind !== 'foreign';
}

/** Felder, die dieses Gerät steuert, aber noch ohne Gerätebezeichnung (Anspruch per Anpfiff setzt keine, @HE-049). */
export function ownFieldsWithoutLabel(list: readonly FieldControlInfo[] | null): FieldControlInfo[] {
  return (list ?? []).filter((entry) => entry.isMine && (entry.holderDeviceLabel ?? '').trim() === '');
}
