/**
 * B-50 (@HE-056, @FU-017, @HE-080): Hat der Server Einträge dieses Geräts mit Grund `RIGHTS_REVOKED` zur Klärung gelegt,
 * zeigt das Cockpit „Du hast keinen Zugriff mehr – N Einträge an die Turnierleitung übergeben“ (`zugriffEntzogen`).
 */
import type { OutboxStatus } from '../../core/match/client/outboxTypes';

export function zugriffEntzogenFor(status: OutboxStatus, tournamentId: string): { uebergebeneEintraege: number } | null {
  const count = status.revokedByTournament[tournamentId] ?? 0;
  return count > 0 ? { uebergebeneEintraege: count } : null;
}
