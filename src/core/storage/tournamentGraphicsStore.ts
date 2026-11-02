/**
 * Gerätespeicher für die Turniergrafiken (@W3-030, PDF-Paket T3): Turnierlogo links, zweite Grafik rechts und die
 * daraus gerechnete Akzentfarbe, je Turnier-ID ein Eintrag unter `tournament-graphics-<id>`.
 *
 * Die Grafiken stehen bewusst NICHT im `Tournament` und nicht unter `STORAGE_KEYS.TOURNAMENTS`. Kein Mapper und kein
 * Weg des Cloud-Abgleichs kennt den Schlüssel, deshalb kann der Abgleich sie weder überschreiben noch in die Cloud
 * schicken (Logos in der Cloud: MVP+). Ein anderes Gerät hat keinen Eintrag und druckt ohne Grafik (@DR-024).
 * Ein Fehler beim Speichern (etwa die Quote) wird geworfen, nie verschluckt.
 */
import { z } from 'zod';
import { STORAGE_KEYS } from '../../constants/storage';
import type { IStorageAdapter } from './IStorageAdapter';
import { StorageError } from './StorageError';
import { createStorage } from './StorageFactory';

const StoredGraphicSchema = z.object({
  /** Nur `data:image/png;base64,…` oder `data:image/jpeg;base64,…`; nie SVG (@W3-030), auch nicht von außen hineingeraten. */
  dataUrl: z.string().regex(/^data:image\/(png|jpeg);base64,/),
  widthPx: z.number().positive(),
  heightPx: z.number().positive(),
  /** Höhe vor dem Verkleinern: daraus kommt die Warnung „unscharf“ (@DR-040). */
  originalHeightPx: z.number().positive(),
});

const TournamentGraphicsSchema = z.object({
  left: StoredGraphicSchema.optional(),
  right: StoredGraphicSchema.optional(),
  /** Akzentfarbe aus der linken Grafik (`#RRGGBB`, schon für den Druck abgedunkelt); fehlt ohne brauchbare Farbe. */
  accent: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
});

export type StoredGraphic = z.infer<typeof StoredGraphicSchema>;
export type TournamentGraphics = z.infer<typeof TournamentGraphicsSchema>;

export interface TournamentGraphicsStore {
  /** Die Grafiken des Turniers; ohne Eintrag oder bei beschädigtem Eintrag (auch kaputtes JSON im localStorage) `{}`, kein Fehler; ein echter Lesefehler wirft. */
  load(tournamentId: string): Promise<TournamentGraphics>;
  /** Ersetzt den Eintrag; ein leerer Satz entfernt ihn. Wirft bei Speicherfehlern (Quote) und bei ungültigen Daten (SVG). */
  save(tournamentId: string, graphics: TournamentGraphics): Promise<void>;
  /** Entfernt den Eintrag dieses Turniers. */
  remove(tournamentId: string): Promise<void>;
  /** Kopiert den Eintrag auf eine neue Turnier-ID (Kopie auf demselben Gerät); ohne Eintrag passiert nichts. */
  copy(fromId: string, toId: string): Promise<void>;
}

export function createTournamentGraphicsStore(getStorage: () => Promise<IStorageAdapter> = createStorage): TournamentGraphicsStore {
  async function load(tournamentId: string): Promise<TournamentGraphics> {
    const storage = await getStorage();
    let raw: unknown;
    try {
      raw = await storage.get<unknown>(STORAGE_KEYS.tournamentGraphics(tournamentId));
    } catch (error) {
      // Nur beschädigte Daten (localStorage-Rückfall: JSON.parse wirft, der StorageError trägt den SyntaxError) gelten wie
      // bei IndexedDB als „keine Grafik“. Ein echter Lesefehler (IndexedDB UnknownError u. a.) wird geworfen, damit die App
      // ihn zeigt (@DR-024: konnte die Datei nicht geladen werden, sagt die App das).
      if (error instanceof StorageError && error.originalError instanceof SyntaxError) { return {}; }
      throw error;
    }
    const parsed = TournamentGraphicsSchema.safeParse(raw);
    return parsed.success ? parsed.data : {};
  }

  async function save(tournamentId: string, graphics: TournamentGraphics): Promise<void> {
    const checked = TournamentGraphicsSchema.parse(graphics); // wirft bei SVG oder falschen Maßen
    const storage = await getStorage();
    const key = STORAGE_KEYS.tournamentGraphics(tournamentId);
    if (checked.left === undefined && checked.right === undefined) {
      await storage.delete(key);
      return;
    }
    await storage.set(key, checked);
  }

  async function remove(tournamentId: string): Promise<void> {
    const storage = await getStorage();
    await storage.delete(STORAGE_KEYS.tournamentGraphics(tournamentId));
  }

  async function copy(fromId: string, toId: string): Promise<void> {
    const graphics = await load(fromId);
    if (graphics.left === undefined && graphics.right === undefined) { return; }
    await save(toId, graphics);
  }

  return { load, save, remove, copy };
}

/** Der Speicher der App (IndexedDB, sonst localStorage über `createStorage`). */
export const tournamentGraphicsStore: TournamentGraphicsStore = createTournamentGraphicsStore();
