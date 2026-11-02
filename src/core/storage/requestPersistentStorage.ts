/**
 * Bittet den Browser, den Gerätespeicher dauerhaft zu halten (`navigator.storage.persist()`), R8 des PDF-Pakets:
 * Safari räumt skriptbeschreibbaren Speicher nach 7 Tagen ohne Nutzung, wenn die App nicht auf dem Home-Bildschirm liegt;
 * Turniere kommen aus der Cloud zurück, die Turniergrafiken (nur auf diesem Gerät) nicht. Ohne Garantie: der Browser darf
 * ablehnen, und fehlt die Schnittstelle oder wirft sie, ist das Ergebnis `false`. Die Anfrage stört das Speichern nie.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.storage?.persist !== 'function') { return false; }
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
