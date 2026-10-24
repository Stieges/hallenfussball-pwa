/**
 * B-50 (@HE-056, @FU-017, @HE-080; Review M2): Was das Cockpit eines Spiels zeigt, wenn der Server Einträge dieses Geräts
 * wegen entzogenen Rechts an die Turnierleitung übergeben hat (Grund `RIGHTS_REVOKED`). Nur Spiele MIT übergebenen
 * Einträgen sind betroffen.
 * - `abschliessen`: das Gerät darf wieder schreiben → die übergebenen Einträge als übergeben abschließen, kein Hinweis;
 * - `zusehen`: alle übergebenen Einträge mit Art „zum Zuschauer gemacht“ → Lesesicht bleibt, Hinweis ohne Sperre;
 * - `sperre`: entzogen oder entfernt → „Du hast keinen Zugriff mehr – N Einträge an die Turnierleitung übergeben“.
 */
import type { OutboxStatus } from '../../core/match/client/outboxTypes';

export type Uebergabe = { art: 'abschliessen' | 'zusehen' | 'sperre'; count: number } | null;

export function uebergabeFor(status: OutboxStatus, matchId: string | undefined, kannSteuern: boolean): Uebergabe {
  if (matchId === undefined) {
    return null;
  }
  const key = matchId.toLowerCase();
  const count = status.revokedByMatch[key] ?? 0;
  if (count === 0) {
    return null;
  }
  if (kannSteuern) {
    return { art: 'abschliessen', count };
  }
  return (status.revokedWatchOnlyByMatch[key] ?? 0) === count ? { art: 'zusehen', count } : { art: 'sperre', count };
}
