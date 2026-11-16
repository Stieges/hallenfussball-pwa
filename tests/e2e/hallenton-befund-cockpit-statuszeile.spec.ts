/**
 * BEFUND (nicht behoben, H4-11b Fixrunde 2): Steht eine Statuszeile unter dem Kopf des Cockpits, wird am Handy die Reihe Foul/Zeitstrafe/Karte beschnitten. Gemessen mit dem echten Kopf
 * (`CockpitSlimHeader` mit Feldwahl und Online-Anzeige) im Prüfstand `cockpit-hallenton.html` bei 360×640 und 390×664, hell, in drei Fällen: ohne Eintrag, mit „Lautsprecher Feld 1 bereit“ (ein
 * eingerichteter Hallen-Lautsprecher – das gilt schon für origin/main, die beteiligten Dateien sind dort und hier byte-gleich) und mit „abgemeldet“. Je Fall: untere Kante der Foul-Reihe, bis wohin sie
 * sichtbar ist (Tipp-Test von oben nach unten) und ob sie im Bild liegt. Die Messwerte stehen als `BEFUND …`-Zeilen in der Ausgabe; der Test bewertet nicht, er misst und speichert die Bilder
 * (`befund-cockpit-statuszeile-…`, Ordner aus H411B_BILDER). Läuft nur im Projekt `desktop` am Dev-Server.
 */
import { test } from './helpers/test-fixtures';
import { speichereBild } from './helpers/hallentonPruefstand';

const GROESSEN = [{ name: '360x640', width: 360, height: 640 }, { name: '390x664', width: 390, height: 664 }] as const;
const FAELLE = [{ name: 'ohne-eintrag', fall: 'kopf-ohne' }, { name: 'lautsprecher-bereit', fall: 'kopf-bereit' }, { name: 'abgemeldet', fall: 'abgemeldet' }] as const;

test.describe('Befund Cockpit Statuszeile (Messung)', () => {
  test.beforeEach(({ browserName }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop' || browserName !== 'chromium', 'setzt Fenstergröße selbst');
    test.skip(!!process.env.CI_E2E_USE_PREVIEW, 'Prüfstand nur am Dev-Server');
  });
  for (const g of GROESSEN) {
    for (const f of FAELLE) {
      test(`befund ${f.name} ${g.name}`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width: g.width, height: g.height });
        await page.clock.setFixedTime(new Date(2026, 10, 21, 14, 0));
        await page.goto(`/tests/e2e/harness/cockpit-hallenton.html?fall=${f.fall}`);
        await page.getByTestId('goal-button-home').waitFor({ timeout: 15_000 });
        const m = await page.evaluate(() => {
          const box = (id: string) => document.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect();
          const foul = box('foul-button-home');
          let sichtbarBis = 0;
          for (let y = Math.floor(foul.top); y < window.innerHeight; y += 1) {
            if (document.elementFromPoint(foul.left + foul.width / 2, y)?.closest('[data-testid="foul-button-home"]') !== null) { sichtbarBis = y + 1; }
          }
          const main = document.querySelector('main')!.getBoundingClientRect();
          return {
            kopfUndZeile: Math.round(document.querySelector('[data-testid="hallenton-status-zeile"]')?.getBoundingClientRect().bottom ?? document.querySelector('[data-testid="cockpit-slim-header"]')!.getBoundingClientRect().bottom),
            foulOben: Math.round(foul.top), foulUnten: Math.round(foul.bottom), sichtbarBis, tastenflaecheUnten: Math.round(main.bottom),
            zeile: document.querySelector('[data-testid="hallenton-status-zeile"]') !== null,
          };
        });
        const imBild = m.sichtbarBis >= m.foulUnten - 1;
        console.log(`BEFUND ${g.name} ${f.name} ${JSON.stringify({ ...m, imBild })}`);
        testInfo.annotations.push({ type: 'befund', description: JSON.stringify({ ...m, imBild }) });
        await speichereBild(page, testInfo.outputDir, 'H411B_BILDER', `befund-cockpit-statuszeile-${f.name}-${g.name}-light`, false);
      });
    }
  }
});
