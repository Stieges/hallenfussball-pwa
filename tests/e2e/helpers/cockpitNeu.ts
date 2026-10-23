/**
 * Helfer für das neue Cockpit (Scheibe 3): Team-Spalten, Nummern-Baustein, Kartenart-Schritt.
 * Szenarien: @SL-019/@SL-083 (Tor zählt mit dem ersten Tipp, Nummer als Nachtrag), @SL-020 („ohne Nummer“),
 * @SL-021 (Sperre 300 ms), @SL-088. Stand und Namen: Tafel `scoreboard-box-links|rechts`, Spalte `team-name-home|away`.
 */
import { expect, type Page } from '@playwright/test';

export type Seite = 'home' | 'away';
export type KartenArt = 'Gelb' | 'Gelb-Rot' | 'Rot';

/** Die ersten 300 ms nach dem Öffnen sind gesperrt (@SL-021). */
const SPERRE_MS = 350;

/** Wartet auf den Nummern-Baustein und lässt die Sperre ablaufen. */
export async function wartePicker(page: Page): Promise<void> {
  await expect(page.getByTestId('number-picker')).toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(SPERRE_MS);
}

/** Schließt die Nummernauswahl mit „ohne Nummer“ (das Tor zählt schon, @SL-083/@SL-020). */
export async function schliesseTorAuswahl(page: Page): Promise<void> {
  await wartePicker(page);
  await page.getByTestId('number-picker').getByRole('button', { name: 'ohne Nummer' }).click();
  await expect(page.getByTestId('number-picker')).toBeHidden();
}

/** Tor für `seite` ohne Nummer. */
export async function tippeTor(page: Page, seite: Seite): Promise<void> {
  await page.getByTestId(`goal-button-${seite}`).click();
  await schliesseTorAuswahl(page);
}

/** Karte für `seite`: Knopf, Art im Kartenart-Schritt; mit `nummer` eine Nummer, sonst „ohne Nummer“. */
export async function tippeKarte(page: Page, seite: Seite, art: KartenArt, nummer?: number): Promise<void> {
  await page.getByTestId(`card-button-${seite}`).click();
  await page.getByTestId('card-kind-step').getByRole('button', { name: art, exact: true }).click();
  await wartePicker(page);
  const picker = page.getByTestId('number-picker');
  if (nummer === undefined) {
    await picker.getByRole('button', { name: 'ohne Nummer' }).click();
  } else {
    await picker.getByRole('button', { name: String(nummer), exact: true }).click();
  }
  await expect(picker).toBeHidden();
}

/** Zeitstrafe für `seite` ohne Nummer (die Dauer kommt aus der Regel, @SL-029). */
export async function tippeZeitstrafe(page: Page, seite: Seite): Promise<void> {
  await page.getByTestId(`penalty-button-${seite}`).click();
  await schliesseTorAuswahl(page);
}
