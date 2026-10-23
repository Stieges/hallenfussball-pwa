/**
 * Anzeige des Halters eines Feldes (B-49, @HE-049 „Feld 2: Tom (Handy)“, @FU-026 „Feld 2 wird von Tom gesteuert“).
 * Name wie `match_event_author_names` (nie die E-Mail), Gerät über `deviceLabelText` (sprachneutraler Schlüssel → DE/EN).
 * Ohne Namen gibt es keinen Text (`null`): der Aufrufer zeigt dann „einem anderen Gerät“.
 */
import { deviceLabelText } from '../../core/device/deviceLabel';
import type { FieldControlInfo } from '../../core/repositories/fieldControlRpc';

export function fieldHolderText(info: Pick<FieldControlInfo, 'holderName' | 'holderDeviceLabel'>): string | null {
  const name = info.holderName?.trim() ?? '';
  if (name === '') {
    return null;
  }
  const geraet = deviceLabelText(info.holderDeviceLabel);
  return geraet ? `${name} (${geraet})` : name;
}
