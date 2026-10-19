/**
 * Sync-Quelle des angemeldeten Kontos für die Rechte-Frage (Review A-11 A4, Befund C-RECHTE-NACH-ANLEGEN-UNBEKANNT,
 * @FU-098/@FU-099/@FU-100 in `plattform/2026-09-24_fundament-gemeinsamer-stand.md`).
 *
 * Frage: „Hat dieses Konto das Turnier auf diesem Gerät angelegt, und ist es noch nicht (sicher) in der Cloud?“ Dann ist
 * die Antwort der Eigentümer-Prüfung (`has_tournament_permission` = false, weil die Cloud-Zeile fehlt) kein „bestätigt
 * kein Mitglied“. Die lokale Markierung `Tournament.ownerId` allein reicht NICHT: sie ist der Konto-Marker der lokalen
 * Kopie (A-07e) und steht auch auf der aus der Cloud geladenen Kopie eines Helfers.
 *
 * Gesetzt vom `RepositoryProvider` (OfflineRepository des Kontos), sonst `null` (Gast, Tests ohne Provider).
 * Framework-frei: nur ein Halter mit Abonnement.
 */
export interface TournamentSyncSource {
  /** Turnier liegt lokal für dieses Konto vor, wurde nie aus der Cloud übernommen und hat noch Ungesendetes. */
  isAwaitingFirstUpload(tournamentId: string): Promise<boolean>;
  /** Meldet jede Änderung der Warteschlange (gesendet, gescheitert, neu eingereiht). */
  subscribe(listener: () => void): () => void;
}

let active: TournamentSyncSource | null = null;
const holderListeners = new Set<() => void>();

export function setActiveTournamentSyncSource(source: TournamentSyncSource | null): void {
  if (active === source) {
    return;
  }
  active = source;
  holderListeners.forEach((listener) => listener());
}

export function getActiveTournamentSyncSource(): TournamentSyncSource | null {
  return active;
}

/** Meldet, wenn eine andere Quelle aktiv wird (Konto-Wechsel). */
export function subscribeActiveTournamentSyncSource(listener: () => void): () => void {
  holderListeners.add(listener);
  return () => {
    holderListeners.delete(listener);
  };
}
