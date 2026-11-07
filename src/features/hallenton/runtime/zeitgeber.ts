/**
 * Zeitgeber für Worker und Hauptthread des Hallen-Lautsprechers (H3b-1). Rückgabe der Planer ist die Abbruch-Funktion,
 * damit kein Timer-Handle-Typ (Browser oder Node) nach außen dringt. Im Test ersetzt `ManuelleUhr` (src/test/hallenton).
 */
export interface Zeitgeber {
  /** Monotone Zeit in ms, im Worker und im Hauptthread vergleichbar (`timeOrigin + now`). */
  jetzt(): number;
  wiederholen(fn: () => void, ms: number): () => void;
  spaeter(fn: () => void, ms: number): () => void;
}

export const echterZeitgeber: Zeitgeber = {
  jetzt: () => performance.timeOrigin + performance.now(),
  wiederholen: (fn, ms) => {
    const handle = setInterval(fn, ms);
    return () => clearInterval(handle);
  },
  spaeter: (fn, ms) => {
    const handle = setTimeout(fn, ms);
    return () => clearTimeout(handle);
  },
};
