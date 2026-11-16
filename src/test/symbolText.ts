/**
 * Prüfmuster für @OB-038 (Symbole statt Emojis): `OHNE_EMOJI` findet Emoji und Bildzeichen, `OHNE_SYMBOLERSATZ` die Textzeichen,
 * die bisher als Symbol dienten (Haken, Kreuz, Warn- und Info-Zeichen, Schloss-Ersatz). © ® ™ sind keine Symbole der Oberfläche.
 */
export const OHNE_EMOJI = /(?![©®™])\p{Extended_Pictographic}/u;
export const OHNE_SYMBOLERSATZ = /[✓✔✕✖✗✘×⚠ℹ✉●○◉▼▲▾▴⋮]/u;
