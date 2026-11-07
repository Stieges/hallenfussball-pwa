/**
 * Lesen des Gerätespeichers der App (IndexedDB `hallenfussball`, Speicher `cache`, Schlüssel `tournaments`) aus einem Test.
 *
 * Läuft per `page.evaluate` im Browser und muss deshalb ohne Importe auskommen.
 */

/** Rohliste der lokalen Turnierkopien; `null`, wenn es den Gerätespeicher (noch) nicht gibt oder er nicht lesbar ist. */
export function readCachedTournamentsInPage(): Promise<Array<Record<string, unknown>> | null> {
  return new Promise((resolve) => {
    const request = indexedDB.open('hallenfussball');
    // Nie selbst anlegen: sonst entsteht Version 1 ohne `cache`, und die App öffnet sie danach ohne Upgrade
    // (C-GERAET-FOLGT-WACKELT). Abbrechen lässt die Datenbank ungeschaffen, `onerror` meldet „noch nicht da“.
    request.onupgradeneeded = () => { request.transaction?.abort(); };
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('cache')) { db.close(); resolve(null); return; }
      const read = db.transaction('cache', 'readonly').objectStore('cache').get('tournaments');
      read.onsuccess = () => { db.close(); resolve(((read.result as { value?: Array<Record<string, unknown>> } | undefined)?.value) ?? []); };
      read.onerror = () => { db.close(); resolve(null); };
    };
    request.onerror = () => resolve(null);
  });
}
