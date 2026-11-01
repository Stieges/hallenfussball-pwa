/**
 * Vorbelegung der Tor-Felder beim Eintragen im Spielplan: ein laufendes Spiel mit dem Stand 0:0 zeigt leere Felder statt
 * vorbelegter Nullen (@FU-101, @FU-112) – so beendet ein einzelnes getipptes Tor nie ein Spiel mit „2:0“.
 */
export function entryScore(score: number | undefined, other: number | undefined, isRunning: boolean): number | undefined {
  return isRunning && score === 0 && other === 0 ? undefined : score;
}
