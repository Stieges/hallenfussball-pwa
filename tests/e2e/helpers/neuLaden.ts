/**
 * Neu laden erst, wenn keine Navigation der App mehr ansteht (E2E-Helfer). Alle E2E-Tests laden über diesen Helfer neu;
 * ein direktes `page.reload()` meldet ESLint (eslint.config.js, Block „E2E: Neuladen nur über neuLaden“).
 *
 * Ursache des Wacklers `page.reload: net::ERR_ABORTED; maybe frame was detached?` (nachgewiesen 07.11. mit
 * CDP-Mitschnitt): Ein Dialog mit eigenem History-Eintrag (useFocusTrap, @OB-012 „Zurück-Taste schließt den Dialog“)
 * räumt beim Schließen seinen Eintrag wieder ab – per `setTimeout(0)` und `history.back()`
 * (src/hooks/useFocusTrap.ts, Cleanup des History-Effekts). Diese Rückwärts-Navigation läuft asynchron. Startet
 * `page.reload()` in diesem Fenster (Test schließt einen Dialog und lädt sofort neu), überholt die Rückwärts-Navigation
 * im alten Dokument das Neuladen, und Chromium bricht das Neuladen mit ERR_ABORTED ab (lokal auch: Neuladen hängt bis
 * zum Timeout). Mitschnitt: `frameStartedNavigating reload` → `requestfailed … ERR_ABORTED` →
 * `frameStartedNavigating historySameDocument`.
 *
 * Ruhiger Zustand = Dokument fertig geladen UND kein History-Eintrag eines schon geschlossenen Dialogs mehr oben.
 * Liegt ein solcher Eintrag oben, wartet der Helfer auf das `popstate` der ausstehenden Rückwärts-Navigation. Kommt
 * keins (z. B. der Eintrag stammt aus einem Neuladen bei offenem Dialog und wird nie abgeräumt), geht es nach
 * `GEISTER_EINTRAG_MS` weiter – dann steht auch keine Navigation an, die das Neuladen abbrechen könnte.
 */
import type { Page, Response } from '@playwright/test';

/** Obergrenze für das Warten auf das `popstate` der Rückwärts-Navigation (sie selbst dauert wenige Millisekunden). */
const GEISTER_EINTRAG_MS = 2000;

type ReloadOptionen = Parameters<Page['reload']>[0];

/** Wartet, bis keine Navigation der App mehr ansteht (siehe Dateikopf). */
export async function warteAufRuheVorNeuladen(page: Page): Promise<void> {
  await page.evaluate(async (geisterMs) => {
    if (document.readyState !== 'complete') {
      await new Promise<void>((resolve) => { window.addEventListener('load', () => { resolve(); }, { once: true }); });
    }
    const state: unknown = window.history.state;
    const dialogEintragOben = typeof state === 'object' && state !== null && 'dialogId' in state;
    const dialogOffen = document.querySelector('[role="dialog"][aria-modal="true"]') !== null;
    if (!dialogEintragOben || dialogOffen) {
      return;
    }
    await new Promise<void>((resolve) => {
      const fertig = (): void => {
        clearTimeout(zeitgeber);
        window.removeEventListener('popstate', fertig);
        resolve();
      };
      const zeitgeber = setTimeout(fertig, geisterMs);
      window.addEventListener('popstate', fertig);
    });
  }, GEISTER_EINTRAG_MS);
}

/** `page.reload()` erst im ruhigen Zustand (siehe Dateikopf); Optionen wie bei `page.reload`. */
export async function neuLaden(page: Page, optionen?: ReloadOptionen): Promise<Response | null> {
  await warteAufRuheVorNeuladen(page);
  // eslint-disable-next-line no-restricted-syntax -- der eine erlaubte Aufruf: nach dem Warten auf Ruhe
  return page.reload(optionen);
}
