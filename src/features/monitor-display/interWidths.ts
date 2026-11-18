/**
 * Zeichenbreiten der Monitor-Schrift „Inter Variable“ (Normalschnitt, Gewicht 400) in em, für das Höhen- und Breitenmodell der Listen-Folien
 * (`listCompact.ts`). Gemessen mit `measureText` bei 1000 px an der ausgelieferten Schrift (`@fontsource-variable/inter`, Teilmenge „latin“);
 * die Messung an der gerenderten Seite prüft `tests/e2e/listen-folien-monitor.spec.ts` (Zeilenzahl je Name). Unbekannte Zeichen zählen mit
 * `FALLBACK_EM`, und `SICHERHEIT` macht jede Breite etwas größer: das Modell ist nie optimistischer als die echte Schrift.
 */
export const INTER_BREITE_EM: Readonly<Record<string, number>> = {
  " ": 0.281, "!": 0.288, "\"": 0.466, "#": 0.633, "$": 0.642, "%": 0.982, "&": 0.644, "'": 0.3, "(": 0.365, ")": 0.365,
  "*": 0.501, "+": 0.662, ",": 0.288, "-": 0.46, ".": 0.288, "/": 0.36, "0": 0.631, "1": 0.407, "2": 0.61, "3": 0.618, "4": 0.646,
  "5": 0.593, "6": 0.62, "7": 0.566, "8": 0.619, "9": 0.62, ":": 0.288, ";": 0.302, "<": 0.662, "=": 0.662, ">": 0.662, "?": 0.511,
  "@": 0.966, "A": 0.69, "B": 0.654, "C": 0.73, "D": 0.722, "E": 0.601, "F": 0.59, "G": 0.746, "H": 0.743, "I": 0.269, "J": 0.571,
  "K": 0.672, "L": 0.565, "M": 0.903, "N": 0.753, "O": 0.765, "P": 0.639, "Q": 0.765, "R": 0.644, "S": 0.642, "T": 0.646,
  "U": 0.744, "V": 0.69, "W": 0.985, "X": 0.682, "Y": 0.679, "Z": 0.629, "[": 0.365, "\\": 0.36, "]": 0.365, "^": 0.471,
  "_": 0.456, "`": 0.323, "a": 0.562, "b": 0.612, "c": 0.571, "d": 0.612, "e": 0.583, "f": 0.37, "g": 0.613, "h": 0.591,
  "i": 0.242, "j": 0.242, "k": 0.549, "l": 0.242, "m": 0.876, "n": 0.591, "o": 0.6, "p": 0.612, "q": 0.612, "r": 0.376, "s": 0.528,
  "t": 0.327, "u": 0.591, "v": 0.562, "w": 0.818, "x": 0.546, "y": 0.562, "z": 0.552, "{": 0.426, "|": 0.333, "}": 0.426,
  "~": 0.662, "’": 0.3, "‘": 0.3, "´": 0.323,
  // Zeichen der Teilmenge „latin-ext“ und weitere Akzentbuchstaben: Breite des Grundbuchstabens (ein Akzent ändert die Schrittweite nicht), „ł“ etwas breiter
  "ş": 0.528, "Ş": 0.642, "ğ": 0.613, "Ğ": 0.746, "ı": 0.242, "İ": 0.269, "č": 0.571, "Č": 0.73, "ć": 0.571, "Ć": 0.73, "š": 0.528, "Š": 0.642,
  "ž": 0.552, "Ž": 0.629, "ł": 0.27, "Ł": 0.565, "ż": 0.552, "Ż": 0.629, "ź": 0.552, "ř": 0.376, "Ř": 0.644, "É": 0.601, "È": 0.601, "Á": 0.69, "À": 0.69,
  "Â": 0.69, "â": 0.562, "ê": 0.583, "ë": 0.583, "î": 0.242, "ï": 0.242, "í": 0.242, "ì": 0.242, "ó": 0.6, "ò": 0.6, "õ": 0.6, "ú": 0.591, "ù": 0.591,
  "û": 0.591, "ý": 0.562, "ã": 0.562, "å": 0.562, "ø": 0.6, "Ø": 0.765, "æ": 0.9, "œ": 0.95, "ď": 0.612, "ě": 0.583, "ň": 0.591, "ő": 0.6, "ű": 0.591,
  "ą": 0.562, "ę": 0.583, "ń": 0.591, "ś": 0.528, "Ś": 0.642, "ţ": 0.327, "ț": 0.327, "ș": 0.528, "ă": 0.562, "Ă": 0.69, "Ő": 0.765,
  "Ä": 0.69, "Ö": 0.765, "Ü": 0.744, "ß": 0.616, "à": 0.562, "á": 0.562, "ä": 0.562, "ç": 0.571, "è": 0.583,
  "é": 0.583, "ñ": 0.591, "ô": 0.6, "ö": 0.6, "ü": 0.591, "–": 0.5, "—": 1,
};

/** Breite eines Zeichens, das nicht in der Tabelle steht (breiter als fast jedes Zeichen): gilt für die neue Aufteilung, damit das Modell nie optimistisch ist. */
export const FALLBACK_EM = 1;
/** Breite eines unbekannten Zeichens für die Schätzung der bisherigen Zeilen: die schmalste denkbare (die Zeilen von main sind nie weniger), damit ein unbekanntes Zeichen die bisherige Zeilenzahl nie aufbläht. */
export const FALLBACK_SCHMAL_EM = 0.2;
/** Zuschlag auf jede gemessene Breite (Kerning, Rundung, andere Rasterung der Schrift). */
export const SICHERHEIT = 1.03;
