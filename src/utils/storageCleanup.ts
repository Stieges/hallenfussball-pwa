/**
 * Storage Cleanup Utilities
 *
 * BUG-CRIT-003 FIX: Handles localStorage quota management
 * - Monitors storage usage
 * - Cleans up old liveMatches data
 * - Provides UI warning mechanism
 */

/**
 * Returns the estimated size of localStorage in bytes
 */
export function getLocalStorageSize(): number {
  let total = 0;
  for (const key in localStorage) {
    if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
      total += localStorage[key].length * 2; // UTF-16 = 2 bytes per char
    }
  }
  return total;
}

/**
 * Returns the estimated free capacity (max 5MB for most browsers)
 */
export function getLocalStorageFreeSpace(): number {
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB
  return MAX_SIZE - getLocalStorageSize();
}

/**
 * Deletes old liveMatches from other tournaments
 * @param currentKey - The key of the current tournament (don't delete)
 * @returns true if something was deleted
 */
export function cleanupOldLiveMatches(currentKey: string): boolean {
  let cleaned = false;
  const liveMatchPrefix = 'liveMatches-';

  // Collect all liveMatches keys with metadata
  const liveMatchKeys: { key: string; size: number; timestamp: number }[] = [];

  for (const key in localStorage) {
    if (key.startsWith(liveMatchPrefix) && key !== currentKey) {
      try {
        const data = localStorage.getItem(key);
        if (data) {
          const parsed = JSON.parse(data);
          const entries = Object.values(parsed);

          // Find the oldest timestamp in this dataset
          let oldestTimestamp = Date.now();
          entries.forEach((match: any) => {
            if (match.timerStartTime) {
              const ts = new Date(match.timerStartTime).getTime();
              if (ts < oldestTimestamp) {oldestTimestamp = ts;}
            }
          });

          liveMatchKeys.push({
            key,
            size: data.length * 2,
            timestamp: oldestTimestamp,
          });
        }
      } catch {
        // Corrupt data - can be deleted
        localStorage.removeItem(key);
        cleaned = true;
        console.log(`[storageCleanup] Removed corrupt data: ${key}`);
      }
    }
  }

  // Sort by age (oldest first)
  liveMatchKeys.sort((a, b) => a.timestamp - b.timestamp);

  // Delete oldest entries until we have enough space (min 100KB)
  const targetFreeSpace = 100 * 1024; // 100KB

  for (const item of liveMatchKeys) {
    if (getLocalStorageFreeSpace() >= targetFreeSpace) {
      break;
    }

    console.log(`[storageCleanup] Removing old liveMatches: ${item.key}`);
    localStorage.removeItem(item.key);
    cleaned = true;
  }

  return cleaned;
}

/**
 * Checks if localStorage is nearly full and returns a status
 */
export function checkStorageHealth(): {
  isHealthy: boolean;
  usedPercent: number;
  usedMB: number;
  message?: string;
} {
  const size = getLocalStorageSize();
  const maxSize = 5 * 1024 * 1024;
  const usedPercent = Math.round((size / maxSize) * 100);
  const usedMB = Math.round((size / 1024 / 1024) * 100) / 100;

  if (usedPercent >= 90) {
    return {
      isHealthy: false,
      usedPercent,
      usedMB,
      message: `Speicher fast voll (${usedPercent}%). Bitte alte Turniere löschen.`,
    };
  }

  if (usedPercent >= 70) {
    return {
      isHealthy: true,
      usedPercent,
      usedMB,
      message: `Speicher zu ${usedPercent}% belegt.`,
    };
  }

  return {
    isHealthy: true,
    usedPercent,
    usedMB,
  };
}

/**
 * Dispatches a custom event for UI to show a warning
 */
export function dispatchStorageWarning(message?: string): void {
  window.dispatchEvent(
    new CustomEvent('storage-quota-warning', {
      detail: {
        message: message || 'Der lokale Speicher ist voll. Änderungen können nicht gespeichert werden.',
        timestamp: Date.now(),
      },
    })
  );
}

/**
 * Safely saves data to localStorage with quota error handling
 * @returns true if saved successfully, false if quota exceeded
 */
export function safeLocalStorageSet(key: string, data: string): boolean {
  try {
    localStorage.setItem(key, data);
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.error('[storageCleanup] localStorage quota exceeded!');

      // Try to cleanup old data
      const cleaned = cleanupOldLiveMatches(key);

      if (cleaned) {
        // Retry after cleanup
        try {
          localStorage.setItem(key, data);
          console.log('[storageCleanup] Successfully saved after cleanup');
          return true;
        } catch {
          // Still full - dispatch warning
          dispatchStorageWarning();
          return false;
        }
      } else {
        dispatchStorageWarning();
        return false;
      }
    } else {
      console.error('[storageCleanup] localStorage error:', error);
      return false;
    }
  }
}
