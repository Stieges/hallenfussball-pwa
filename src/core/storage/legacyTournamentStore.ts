/**
 * Ablage fuer Altformat-Turniere (A-05, @FU-007): Turniere ohne Spielseiten-Slots werden nicht
 * gelesen und nicht geloescht, sondern unter `tournaments_legacy_v1` beiseitegelegt, damit nichts
 * still verloren geht. Die Oberflaeche zeigt dazu einen Hinweis (`LegacyTournamentNotice`).
 */
import { createStorage } from './StorageFactory';

export const LEGACY_TOURNAMENTS_KEY = 'tournaments_legacy_v1';

/** Fensterereignis, wenn beim Laden Altformat-Turniere beiseitegelegt wurden (Hinweis in der Oberflaeche). */
export const LEGACY_TOURNAMENTS_NOTICE_EVENT = 'legacy-tournaments-quarantined';

function entryId(entry: unknown): string | undefined {
  if (typeof entry === 'object' && entry !== null && 'id' in entry) {
    const { id } = entry;
    return typeof id === 'string' ? id : undefined;
  }
  return undefined;
}

async function readStored(): Promise<unknown[]> {
  const storage = await createStorage();
  const stored = await storage.get<unknown>(LEGACY_TOURNAMENTS_KEY);
  return Array.isArray(stored) ? (stored as unknown[]) : [];
}

/** Legt Altformat-Turniere ab. Gleiche Turnier-ID ersetzt den Eintrag (keine Duplikate). */
export async function quarantineLegacyTournaments(items: readonly unknown[]): Promise<void> {
  if (items.length === 0) {
    return;
  }
  const storage = await createStorage();
  const incomingIds = new Set(items.map(entryId).filter((id): id is string => id !== undefined));
  const kept = (await readStored()).filter((entry) => {
    const id = entryId(entry);
    return id === undefined || !incomingIds.has(id);
  });
  await storage.set(LEGACY_TOURNAMENTS_KEY, [...kept, ...items]);
}

/** Anzahl der beiseitegelegten Altformat-Turniere. */
export async function countLegacyTournaments(): Promise<number> {
  return (await readStored()).length;
}
