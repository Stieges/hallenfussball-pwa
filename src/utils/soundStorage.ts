/**
 * Sound Storage Utility
 *
 * Manages custom sound file storage using IndexedDB via idb-keyval.
 * Custom sounds are stored per-tournament to allow different sounds per event.
 *
 * @see docs/concepts/MATCH-COCKPIT-PRO-KONZEPT.md Section 3.3
 */

import { get, set, del, createStore } from 'idb-keyval';

// Create a dedicated store for sound files
const soundStore = createStore('hallenfussball-sounds', 'custom-sounds');

// Maximum file size in bytes (500 KB as per spec)
export const MAX_SOUND_FILE_SIZE = 500 * 1024;

// Supported audio formats
export const SUPPORTED_AUDIO_FORMATS = ['audio/mpeg', 'audio/wav', 'audio/ogg'];

/**
 * Storage key for a tournament's custom sound
 */
function getStorageKey(tournamentId: string): string {
  return `custom-sound-${tournamentId}`;
}

/**
 * Stored sound metadata
 */
export interface StoredSound {
  /** Original filename */
  filename: string;
  /** MIME type */
  mimeType: string;
  /** File size in bytes */
  size: number;
  /** Base64-encoded audio data */
  data: string;
  /** When the sound was uploaded */
  uploadedAt: string;
}

/**
 * Validate an audio file before storing
 */
export function validateAudioFile(file: File): { valid: boolean; error?: string } {
  if (!SUPPORTED_AUDIO_FORMATS.includes(file.type)) {
    return {
      valid: false,
      error: `Nicht unterstütztes Format: ${file.type}. Erlaubt: MP3, WAV, OGG`,
    };
  }

  if (file.size > MAX_SOUND_FILE_SIZE) {
    const sizeMB = (file.size / 1024 / 1024).toFixed(2);
    return {
      valid: false,
      error: `Datei zu groß (${sizeMB} MB). Maximum: 500 KB`,
    };
  }

  return { valid: true };
}

/**
 * Convert a File to base64 string
 */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix (e.g., "data:audio/mpeg;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error('Failed to read file'));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Convert base64 string back to Blob
 */
function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

/**
 * Store a custom sound for a tournament
 */
export async function storeCustomSound(
  tournamentId: string,
  file: File
): Promise<{ success: boolean; error?: string }> {
  const validation = validateAudioFile(file);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  try {
    const base64Data = await fileToBase64(file);

    const storedSound: StoredSound = {
      filename: file.name,
      mimeType: file.type,
      size: file.size,
      data: base64Data,
      uploadedAt: new Date().toISOString(),
    };

    await set(getStorageKey(tournamentId), storedSound, soundStore);
    return { success: true };
  } catch (error) {
    console.error('[soundStorage] Failed to store custom sound:', error);
    return {
      success: false,
      error: 'Fehler beim Speichern des Sounds',
    };
  }
}

/**
 * Retrieve a custom sound for a tournament
 */
export async function getCustomSound(tournamentId: string): Promise<StoredSound | null> {
  try {
    const sound = await get<StoredSound>(getStorageKey(tournamentId), soundStore);
    return sound ?? null;
  } catch (error) {
    console.error('[soundStorage] Failed to retrieve custom sound:', error);
    return null;
  }
}

/**
 * Get the audio Blob for a stored custom sound
 */
export async function getCustomSoundBlob(tournamentId: string): Promise<Blob | null> {
  const sound = await getCustomSound(tournamentId);
  if (!sound) {
    return null;
  }

  try {
    return base64ToBlob(sound.data, sound.mimeType);
  } catch (error) {
    console.error('[soundStorage] Failed to convert sound to blob:', error);
    return null;
  }
}

/**
 * Create an object URL for a stored custom sound
 * Remember to revoke the URL when done using URL.revokeObjectURL()
 */
export async function getCustomSoundUrl(tournamentId: string): Promise<string | null> {
  const blob = await getCustomSoundBlob(tournamentId);
  if (!blob) {
    return null;
  }

  return URL.createObjectURL(blob);
}

/**
 * Delete a custom sound for a tournament
 */
export async function deleteCustomSound(tournamentId: string): Promise<void> {
  try {
    await del(getStorageKey(tournamentId), soundStore);
  } catch (error) {
    console.error('[soundStorage] Failed to delete custom sound:', error);
  }
}

/**
 * Check if a tournament has a custom sound stored
 */
export async function hasCustomSound(tournamentId: string): Promise<boolean> {
  const sound = await getCustomSound(tournamentId);
  return sound !== null;
}
