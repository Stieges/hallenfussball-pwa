/**
 * @RE-006 / @RE-007: Fehler, die bei wackligem Netz oder bei jedem Laden wieder auftreten wuerden, werden je Art und
 * Kennung nur einmal je Sitzung gemeldet – sonst fuellt ein einziger Fehler das Kontingent des Fehlerbericht-Dienstes.
 * Bewusst Modul-Ebene (nicht Instanz): mehrere Repository-Instanzen in einer Sitzung teilen sich den Merker.
 * Nur im Arbeitsspeicher – nichts wird auf dem Geraet gespeichert; nach dem Neuladen der Seite ist er leer.
 */
const reported = new Set<string>();

/** true, wenn diese Art/Kennung in dieser Sitzung noch nicht gemeldet wurde (und merkt sie sich). */
export function markReportedOnce(kind: string, id: unknown): boolean {
    const key = `${kind}:${String(id)}`;
    if (reported.has(key)) { return false; }
    reported.add(key);
    return true;
}

/** Nur fuer Tests: bildet das Neuladen der Seite nach. */
export function resetReportedOnceForTest(): void {
    reported.clear();
}
