/**
 * H4-11b (@HT-057, @HT-016, @HT-017, @HT-022, @HT-046, @HT-041): „Abmelden“ an der Karte eines Felds und der Hinweis am abgemeldeten Gerät am Prüfstand
 * tests/e2e/harness/hallenton-abmelden.html (echte Seitenleiste, echte Seitenansicht, echter Hook `useLautsprecherAbmelden`, echte Rückfrage bei laufendem Spiel; nur der Server-Aufruf ist
 * gefälscht) und tests/e2e/harness/hallenton-dieses-geraet.html?fall=abgemeldet (Hinweis „Verstanden“); „Abmelden“, Rückfragen und Bestätigen klickt der Test wie Olli. Bei 360×640 und 1280×720,
 * hell und dunkel, Deutsch (alle Fälle) und Englisch (Hauptfälle), dazu ein Gerätename mit 50 Zeichen. Je Fall: die Wortlaute des Records stehen da, jede Taste ≥ 44 px und im Bild, nichts läuft über,
 * kein HART-Befund von `npm run visual:metrics`, kein Gerätename in einem Attribut. Bilder: Ordner aus H411B_BILDER (sonst Testausgabe). Läuft nur im Projekt `desktop` am Dev-Server.
 */
import type { Page } from '@playwright/test';
import { test, expect } from './helpers/test-fixtures';
import { GERAETE, hartBefunde, speichereBild } from './helpers/hallentonPruefstand';

type Sprache = 'de' | 'en';
interface Fall {
  name: string;
  seite: 'abmelden' | 'dieses-geraet' | 'abgemeldet-eintrag';
  /** Abfrage des Prüfstands. */
  abfrage: string;
  /** Klicks wie Olli, danach die Prüfung (`s` = Sprache). */
  ablauf: (page: Page, s: Sprache) => Promise<void>;
  sprachen?: readonly Sprache[];
  /** Bild des sichtbaren Ausschnitts (offener Dialog) statt der ganzen Seite. */
  dialog?: boolean;
  /** Die Uhr der Seite wird vor dem Laden angehalten (`page.clock`), damit die Sperrzeit des zweiten Dialogs messbar ist. */
  uhr?: boolean;
}

const T = {
  de: {
    abmelden: 'Abmelden', titel: 'Hallen-Lautsprecher abmelden?', kein: 'kein Hallen-Lautsprecher', nochmal: 'Erneut versuchen', verstanden: 'Verstanden',
    folge: 'Für Feld 1 ertönt danach kein Hallenton, bis ein Gerät wieder eingeschaltet wird.', laeuft: 'Auf Feld 1 läuft Spiel 11.', zweiteTitel: 'Abmelden, obwohl ein Spiel läuft', zweiteJa: 'Trotzdem abmelden',
    ergebnis: 'Feld 1 abgemeldet – kein Hallen-Lautsprecher', leer: 'Noch kein Hallen-Lautsprecher eingerichtet', eintrag: 'Feld 1: als Hallen-Lautsprecher abgemeldet', eintragKurz: 'Feld 1 abgemeldet',
    keinNetz: 'Nicht abgemeldet: kein Netz. Der Lautsprecher für Feld 1 ist unverändert.', keinRecht: 'Nicht abgemeldet: dafür fehlt dir das Recht.',
    abgemeldet: 'Die Turnierleitung hat dieses Gerät als Hallen-Lautsprecher für Feld 1 abgemeldet.', eigen: 'Das ist dieses Gerät.',
  },
  en: {
    abmelden: 'Unassign', titel: 'Unassign hall speaker?', kein: 'no hall speaker', nochmal: 'Try again', verstanden: 'Understood',
    folge: 'Afterwards there is no hall tone for field 1 until a device is switched on again.', laeuft: 'Match 11 is running on field 1.', zweiteTitel: 'Unassign although a match is running', zweiteJa: 'Unassign anyway',
    ergebnis: 'Field 1 unassigned – no hall speaker', leer: 'No hall speaker set up yet', eintrag: 'Field 1: unassigned as hall speaker', eintragKurz: 'Field 1 unassigned',
    keinNetz: 'Not unassigned: no connection. The speaker for field 1 is unchanged.', keinRecht: 'Not unassigned: you do not have permission.',
    abgemeldet: 'The tournament director has unassigned this device as the hall speaker for field 1.', eigen: 'This is this device.',
  },
} as const;
const NAMEN = ['Rechner der Turnierleitung', 'Laptop Turnierleitung', 'Tablet Halle Süd am Eingang neben der Kasse, links'];

const taste = (page: Page) => page.getByTestId('lautsprecher-feld-1-abmelden');
const ja = (page: Page) => page.getByTestId('confirm-dialog-confirm');

const FAELLE: readonly Fall[] = [
  {
    name: 'abmelden-anderes-geraet', seite: 'abmelden', abfrage: 'fall=bereit', async ablauf(page, s) {
      await expect(taste(page)).toHaveText(T[s].abmelden);
      await expect(page.getByTestId('lautsprecher-feld-2-abmelden'), '@HT-016 Feld ohne Lautsprecher hat keine Aktion').toHaveCount(0);
      await expect(page.getByTestId('lautsprecher-feld-2-zustand')).toHaveText(T[s].kein);
      await expect(page.getByTestId('lautsprecher-feld-1-geraet')).toContainText('Rechner der Turnierleitung');
    },
  },
  {
    name: 'abmelden-meldet-sich-nicht', seite: 'abmelden', abfrage: 'fall=meldetSichNicht', sprachen: ['de'], async ablauf(page) {
      await expect(page.getByTestId('lautsprecher-feld-1-zustand')).toContainText('meldet sich nicht');
      await expect(taste(page)).toBeVisible();
    },
  },
  {
    name: 'abmelden-eigenes-geraet', seite: 'abmelden', abfrage: 'fall=eigenes', sprachen: ['de'], dialog: true, async ablauf(page, s) {
      await taste(page).click();
      await expect(page.getByText(T[s].titel)).toBeVisible();
      await expect(page.getByRole('dialog')).toContainText(T[s].eigen);
    },
  },
  {
    name: 'rueckfrage', seite: 'abmelden', abfrage: 'fall=bereit', dialog: true, async ablauf(page, s) {
      await taste(page).click();
      await expect(page.getByText(T[s].titel)).toBeVisible();
      await expect(page.getByRole('dialog')).toContainText(T[s].folge);
      await expect(page.getByRole('dialog')).toContainText('Rechner der Turnierleitung');
      await expect(page.getByTestId('lautsprecher-feld-1-zustand'), 'noch nichts ist abgemeldet').not.toHaveText(T[s].kein);
    },
  },
  {
    name: 'rueckfrage-laufendes-spiel', seite: 'abmelden', abfrage: 'fall=bereit&spiel=1', dialog: true, async ablauf(page, s) {
      await taste(page).click();
      await ja(page).click();
      await expect(page.getByText(T[s].zweiteTitel)).toBeVisible();
      await expect(page.getByRole('dialog')).toContainText(T[s].laeuft);
      await expect(page.getByRole('dialog')).toContainText('Rechner der Turnierleitung'); // auch die zweite Rückfrage nennt das Gerät
      await expect(page.getByTestId('confirm-dialog-confirm')).toHaveText(T[s].zweiteJa);
      await expect(page.getByTestId('confirm-dialog-cancel'), 'Gefahr-Dialog: Fokus auf „Abbrechen“, Enter löst nichts aus').toBeFocused();
    },
  },
  {
    name: 'nochmal-fragt-wieder', seite: 'abmelden', abfrage: 'fall=bereit&fehler=netz', sprachen: ['de'], dialog: true, async ablauf(page, s) {
      await taste(page).click();
      await ja(page).click();
      await expect(page.getByTestId('lautsprecher-feld-1-abmelden-fehler')).toBeVisible();
      await page.getByTestId('lautsprecher-feld-1-abmelden-nochmal').click();
      await expect(page.getByText(T[s].titel), '„Erneut versuchen“ fragt wieder, es meldet nie direkt ab').toBeVisible();
    },
  },
  {
    name: 'rueckfrage-sperrzeit-gesperrt', seite: 'abmelden', abfrage: 'fall=bereit&spiel=1', sprachen: ['de'], dialog: true, uhr: true, async ablauf(page, s) {
      await taste(page).click();
      await ja(page).click();
      await page.clock.runFor(100);
      await expect(ja(page), 'in der Sperrzeit: sichtbar abgeblendet').toHaveAttribute('aria-disabled', 'true');
      await ja(page).click({ force: true }); // der zweite Tipp eines Doppeltipps
      await expect(page.getByText(T[s].zweiteTitel), 'der Dialog bleibt stehen').toBeVisible();
      await expect(page.getByTestId('confirm-dialog-cancel')).not.toHaveAttribute('aria-disabled', 'true');
    },
  },
  {
    name: 'rueckfrage-sperrzeit-frei', seite: 'abmelden', abfrage: 'fall=bereit&spiel=1', sprachen: ['de'], dialog: true, uhr: true, async ablauf(page, s) {
      await taste(page).click();
      await ja(page).click();
      await page.clock.runFor(600);
      await expect(ja(page), 'nach der Sperrzeit bedienbar').not.toHaveAttribute('aria-disabled', 'true');
      await expect(page.getByText(T[s].zweiteTitel)).toBeVisible();
    },
  },
  {
    name: 'rueckfrage-langer-name', seite: 'abmelden', abfrage: 'fall=bereit&name=lang', sprachen: ['de'], dialog: true, async ablauf(page, s) {
      await taste(page).click();
      await expect(page.getByRole('dialog')).toContainText('Tablet Halle Süd am Eingang neben der Kasse, links');
      await expect(page.getByText(T[s].titel)).toBeVisible();
    },
  },
  {
    name: 'ergebnis-kein-lautsprecher', seite: 'abmelden', abfrage: 'fall=bereit', async ablauf(page, s) {
      await taste(page).click();
      await ja(page).click();
      await expect(page.getByTestId('lautsprecher-feld-1-zustand')).toHaveText(T[s].kein);
      await expect(taste(page)).toHaveCount(0);
      await expect(page.getByTestId('lautsprecher-feld-1-abgemeldet')).toHaveText(T[s].ergebnis);
      await expect(page.getByTestId('hallenton-felder-leer'), 'nach einer bewussten Abmeldung nicht „Noch kein Hallen-Lautsprecher eingerichtet“').toHaveCount(0);
      await expect(page.locator('body')).not.toContainText(T[s].leer);
    },
  },
  {
    name: 'abbrechen-aendert-nichts', seite: 'abmelden', abfrage: 'fall=bereit', sprachen: ['de'], async ablauf(page, s) {
      await taste(page).click();
      await page.getByTestId('confirm-dialog-cancel').click();
      await expect(page.getByTestId('lautsprecher-feld-1-zustand')).not.toHaveText(T[s].kein);
      await expect(taste(page)).toBeVisible();
    },
  },
  {
    name: 'fehler-kein-netz', seite: 'abmelden', abfrage: 'fall=keinNetz', async ablauf(page, s) {
      await expect(page.getByTestId('lautsprecher-feld-1-zustand')).toContainText(s === 'de' ? 'Status unbekannt' : /status unknown/i);
      await taste(page).click();
      await expect(page.getByTestId('lautsprecher-feld-1-abmelden-fehler')).toContainText(T[s].keinNetz);
      await expect(page.getByTestId('lautsprecher-feld-1-abmelden-nochmal')).toHaveText(T[s].nochmal);
    },
  },
  {
    name: 'fehler-kein-recht', seite: 'abmelden', abfrage: 'fall=bereit&fehler=kein_recht', async ablauf(page, s) {
      await taste(page).click();
      await ja(page).click();
      await expect(page.getByTestId('lautsprecher-feld-1-abmelden-fehler')).toContainText(T[s].keinRecht);
      await expect(page.getByTestId('lautsprecher-feld-1-abmelden-nochmal')).toHaveCount(0);
      await expect(page.getByTestId('lautsprecher-feld-1-zustand'), 'der Zustand bleibt').not.toHaveText(T[s].kein);
    },
  },
  {
    name: 'eintrag-verwaltung', seite: 'abgemeldet-eintrag', abfrage: 'ansicht=verwaltung', async ablauf(page, s) {
      await expect(page.getByTestId('hallenton-status-zeile')).toContainText(T[s].eintrag, { ignoreCase: false });
    },
  },
  {
    name: 'eintrag-ohne-kopf', seite: 'abgemeldet-eintrag', abfrage: 'ansicht=ohne', async ablauf(page, s) {
      await expect(page.getByTestId('hallenton-geraet-streifen')).toContainText(T[s].eintrag);
    },
  },
  {
    name: 'gerät-hinweis-abgemeldet', seite: 'dieses-geraet', abfrage: 'fall=abgemeldet', async ablauf(page, s) {
      await expect(page.getByTestId('geraet-banner-abgemeldet')).toContainText(T[s].abgemeldet);
      await expect(page.getByTestId('geraet-verstanden')).toHaveText(T[s].verstanden);
      await expect(page.getByTestId('geraet-banner-uebernommen')).toHaveCount(0);
    },
  },
];

async function keineNamenInAttributen(page: Page): Promise<void> {
  const treffer = await page.evaluate((namen) => {
    const funde: string[] = [];
    // Das Eingabefeld „Gerätename“ von „Dieses Gerät“ (H4-9) zeigt den eigenen Namen als Wert; das ist die Eingabe selbst, kein Attribut zum Beschriften
    for (const el of Array.from(document.querySelectorAll('*:not(input)'))) {
      for (const a of Array.from(el.attributes)) {
        if (namen.some((n) => a.value.includes(n))) { funde.push(`${a.name}=${a.value}`); }
      }
    }
    return funde;
  }, NAMEN);
  expect(treffer, 'kein Gerätename steht in einem Attribut (Fehler-Brotkrumen)').toEqual([]);
}

test.describe('@HT-057 H4-11b Abmelden (Prüfstand)', () => {
  test.beforeEach(({ browserName, page }, testInfo) => {
    page.on('pageerror', (e) => { testInfo.annotations.push({ type: 'seitenfehler', description: e.message.slice(0, 300) }); });
    test.skip(testInfo.project.name !== 'desktop' || browserName !== 'chromium', 'setzt Fenstergröße selbst');
    test.skip(!!process.env.CI_E2E_USE_PREVIEW, 'Prüfstand nur am Dev-Server (im gebauten Stand nicht vorhanden)');
  });

  for (const f of FAELLE) {
    for (const sprache of f.sprachen ?? ['de', 'en']) {
      for (const g of GERAETE) {
        for (const thema of ['light', 'dark'] as const) {
          test(`${f.name} ${sprache} ${g.name}, ${thema}: Wortlaute, Tasten ≥ 44 px und im Bild, nichts läuft über, kein Gerätename im Attribut`, async ({ page }, testInfo) => {
            await page.setViewportSize({ width: g.width, height: g.height });
            await page.emulateMedia({ colorScheme: thema });
            if (f.uhr === true) { await page.clock.install(); }
            await page.goto(`/tests/e2e/harness/hallenton-${f.seite}.html?${f.abfrage}&lang=${sprache}`);
            await expect(page.getByTestId('hallenton-seite')).toBeVisible();
            await f.ablauf(page, sprache);
            await keineNamenInAttributen(page);
            for (const k of await page.locator('button').all()) {
              if (await k.isVisible()) {
                const box = await k.boundingBox();
                expect(box?.height ?? 0, `Taste ${await k.textContent()}`).toBeGreaterThanOrEqual(44);
                if (f.dialog === true && (await k.getAttribute('data-testid'))?.startsWith('confirm-dialog')) {
                  expect((box?.x ?? -1) >= 0 && (box?.x ?? 0) + (box?.width ?? 0) <= g.width && (box?.y ?? 0) + (box?.height ?? 0) <= g.height, `Taste ${await k.textContent()} liegt im Bild`).toBe(true);
                }
              }
            }
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'kein waagerechtes Scrollen').toBe(true);
            const ueberlauf = await page.evaluate(() => Array.from(document.querySelectorAll('[data-testid="hallenton-seite"] *')).filter((el) => el.scrollWidth - el.clientWidth > 1).map((el) => el.textContent));
            expect(ueberlauf, 'kein Überlauf').toEqual([]);
            if (f.dialog !== true) {
              await page.evaluate(() => window.scrollTo(0, 0));
              await page.waitForTimeout(300);
              await page.addStyleTag({ content: 'aside { visibility: hidden; }' });
              expect(await hartBefunde(page, g.art), 'kein HART-Befund der visuellen Messung (Seite ohne Seitenleiste)').toEqual([]);
              await page.addStyleTag({ content: 'aside { visibility: visible; }' });
            }
            await speichereBild(page, testInfo.outputDir, 'H411B_BILDER', `h4-11b-${f.name}-${sprache}-${g.name}-${thema}`, f.dialog !== true);
          });
        }
      }
    }
  }

  // Cockpit (@HT-057): der Eintrag steht wie jeder Eintrag der Statuszeile UNTER dem Kopf (bestehende Regeln: Langform bei einem Eintrag). Die Reihe Foul/Zeitstrafe/Karte ist am Handy dabei
  // beschnitten – das ist ein Befund des Stands von origin/main (siehe `hallenton-befund-cockpit-statuszeile.spec.ts`), hier wird er nur nicht verschwiegen: Tor-Tasten bleiben im Bild.
  for (const sprache of ['de', 'en'] as const) {
    for (const g of GERAETE) {
      for (const thema of ['light', 'dark'] as const) {
        test(`eintrag-cockpit ${sprache} ${g.name}, ${thema}: Eintrag unter dem Kopf, Tor-Tasten im Bild, Tasten ≥ 44 px`, async ({ page }, testInfo) => {
          await page.setViewportSize({ width: g.width, height: g.height });
          await page.emulateMedia({ colorScheme: thema });
          await page.clock.setFixedTime(new Date(2026, 10, 21, 14, 0));
          await page.goto(`/tests/e2e/harness/cockpit-hallenton.html?fall=abgemeldet&lang=${sprache}`);
          const zeile = page.getByTestId('hallenton-status-zeile');
          await expect(zeile).toBeVisible({ timeout: 15_000 });
          await expect(zeile).toContainText(T[sprache].eintrag); // ein Eintrag: Langform, auch am Handy
          const kopf = await page.getByTestId('cockpit-slim-header').boundingBox();
          const z = await zeile.boundingBox();
          expect((z?.y ?? 0) >= (kopf?.y ?? 0) + (kopf?.height ?? 0) - 1, 'die Zeile steht unter dem Kopf').toBe(true);
          await expect(page.getByTestId('scoreboard')).toContainText('4:32');
          for (const seite of ['home', 'away']) {
            const box = await page.getByTestId(`goal-button-${seite}`).first().boundingBox();
            expect((box?.y ?? 0) + (box?.height ?? 0), `Tor-Taste ${seite} liegt im Bild`).toBeLessThanOrEqual(g.height);
            expect(box?.height ?? 0, `Tor-Taste ${seite} ≥ 56 px`).toBeGreaterThanOrEqual(56);
          }
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'kein waagerechtes Scrollen').toBe(true);
          await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined))));
          await speichereBild(page, testInfo.outputDir, 'H411B_BILDER', `h4-11b-eintrag-cockpit-${sprache}-${g.name}-${thema}`, false);
        });
      }
    }
  }
});
