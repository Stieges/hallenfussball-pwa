/**
 * Konto-Wechsel (@HT-060): Was eine Sitzung im Arbeitsspeicher des Tabs gemerkt hat (z. B. Gerätenamen des Hallen-Lautsprechers),
 * darf einen Wechsel des Kontos nicht überleben. Die Anmeldung meldet jeden Wechsel hier; wer solchen Stand hält, trägt sich ein und
 * räumt ihn auf. So greift weder `features/hallenton` in `features/auth` noch umgekehrt. Ein Wechsel ist: Abmelden, Anmelden eines
 * anderen Kontos (auch ohne ausdrückliches Abmelden, auch nach abgelaufener Sitzung). Reines TypeScript, ohne React.
 */
type Zuhoerer = () => void;

const zuhoerer = new Set<Zuhoerer>();

/** Trägt einen Aufräumer ein; die Rückgabe trägt ihn wieder aus. */
export function beiKontoWechsel(fn: Zuhoerer): () => void {
  zuhoerer.add(fn);
  return () => { zuhoerer.delete(fn); };
}

/** Ruft alle Aufräumer; ein Fehler in einem hält die anderen nicht auf. */
export function meldeKontoWechsel(): void {
  for (const fn of [...zuhoerer]) {
    try {
      fn();
    } catch {
      // Aufräumen darf das Abmelden nie blockieren
    }
  }
}
