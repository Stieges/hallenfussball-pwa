/**
 * E2E (G2 Spur A, Regel T2-UI): die Aktionsauswahl am Spiel im Spielplan der Turnierleitung, offline (Gast = Turnierleitung,
 * Wegwerf-Turnier im lokalen Speicher, ohne Server). Läuft in den Projekten `desktop` und `mobile-md`.
 *
 * Szenarien (Gherkin wörtlich, docs/anforderungen/2026-10-02_spiel-leiten.md):
 * - @SL-193 Tipp auf ein Spiel zeigt beschriftete Aktionen, in Gruppenphase und Finalrunde gleich: Finalrunde beendet →
 *   „Ergebnis korrigieren“, „Protokoll ansehen“; Gruppenphase geplant → die sechs Aktionen der Turnierleitung.
 * - @EK-063 „Ergebnis korrigieren“ öffnet denselben Dialog wie das Cockpit (bisher und neu).
 * - @SL-194 Rückfrage beim Wechsel: „Spiel 1 läuft weiter. Trotzdem zu Spiel 2 wechseln?“, nach „Wechseln“ läuft Spiel 1 weiter
 *   und die Adresse trägt kein `?matchId=` mehr (C-MATCHID-URL-BLEIBT).
 * - @FU-080 „Protokoll ansehen“ öffnet das Protokoll des Spiels (C-PROTOKOLL-OHNE-EINSTIEG).
 * - @SL-239 (G3-N N3) Kopf mit Abzeichen und Spielzeile, „X“ oben, gefüllte Haupttaste zuletzt und ohne Scrollen erreichbar.
 * Größen: jede Aktion ≥ 56 px hoch (Haupttaste), „X“ ≥ 44 px.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
import { animationenFertig } from '../helpers/animationenFertig';
import { cup, ID, NAMEN, TEAMS, anpfeifen } from '../helpers/laptopCup';

const HF1 = '00000000-0000-4000-8000-000000000a01';
const HF2 = '00000000-0000-4000-8000-000000000a02';

/** Vier Teams in einer Gruppe, sechs Gruppenspiele (geplant) und eine Finalrunde: Halbfinale 1 beendet 2:1, Halbfinale 2 geplant. */
function turnierMitFinalrunde(): Record<string, unknown> {
  const basis = cup();
  const date = (basis as { date: string }).date;
  const halbfinale = (id: string, nr: number, a: number, b: number, extra: Record<string, unknown>) => ({
    id, matchNumber: nr, round: nr, field: 1, phase: 'semifinal', label: `Halbfinale ${nr - 6}`, teamA: TEAMS[a], teamB: TEAMS[b],
    slotA: { kind: 'team', teamId: TEAMS[a] }, slotB: { kind: 'team', teamId: TEAMS[b] },
    scheduledTime: `${date}T12:${nr === 7 ? '00' : '12'}:00.000Z`, time: nr === 7 ? '12:00' : '12:12', ...extra,
  });
  return {
    ...basis,
    groupSystem: 'groupsAndFinals', finals: { enabled: true }, finalsConfig: { preset: 'top-4', tiebreaker: 'shootout' },
    matches: [
      ...(basis as { matches: unknown[] }).matches,
      halbfinale(HF1, 7, 0, 1, { matchStatus: 'finished', scoreA: 2, scoreB: 1 }),
      halbfinale(HF2, 8, 2, 3, { matchStatus: 'scheduled' }),
    ],
  };
}

async function spielplan(page: Page): Promise<void> {
  await page.goto(`/#/tournament/${ID}/schedule`);
  await expect(page.locator('[data-match-card]:visible').first()).toBeVisible({ timeout: 15_000 });
}

/** Tipp auf ein Spiel der Finalrunde: Zeile (Desktop) bzw. Karte (Handy); getippt wird auf den Namen des Heimteams. */
async function tippeFinalspiel(page: Page, id: string): Promise<void> {
  const ziel = page.locator(`[data-testid="final-row-${id}"]:visible, [data-testid="final-card-${id}"]:visible`).first();
  await expect(ziel).toBeVisible({ timeout: 15_000 });
  await ziel.getByText(NAMEN[0]).first().click();
}

const menue = (page: Page) => page.getByTestId('match-action-menu');

test.describe('G2 Spur A: Aktionsauswahl am Spiel (offline, Gast = Turnierleitung)', () => {
  test.beforeEach(async ({ seedIndexedDB }) => {
    await seedIndexedDB({ tournaments: [turnierMitFinalrunde()] });
  });

  test('@SL-193 @EK-063 Finalrunde beendet: Tipp → „Ergebnis korrigieren“ und „Protokoll ansehen“; „Ergebnis korrigieren“ öffnet den Dialog des Cockpits mit bisher 2:1', async ({ page }) => {
    await spielplan(page);
    await tippeFinalspiel(page, HF1);
    await expect(menue(page)).toBeVisible();
    await expect(menue(page).getByRole('listitem')).toHaveText(['Protokoll ansehen', 'Ergebnis korrigieren']); // @SL-239: die gefüllte Haupttaste steht zuletzt (Menge ohne feste Reihenfolge, @SL-193)

    await page.getByTestId('match-action-correct').click();
    const dialog = page.getByTestId('cockpit-korrektur-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Ergebnis von Spiel 7 korrigieren');
    await expect(dialog).toContainText(`${NAMEN[0]} 2:1 ${NAMEN[1]}`);
    await expect(page.getByTestId('cockpit-korrektur-home')).toHaveValue('2');
    await expect(page.getByTestId('cockpit-korrektur-weiter')).toBeDisabled(); // ohne Änderung kein „Weiter“
    await page.getByTestId('cockpit-korrektur-cancel').click();
    await expect(dialog).toHaveCount(0);
  });

  test('@SL-193 Gruppenphase geplant: die Turnierleitung sieht genau die sechs Aktionen aus dem Szenario (Felder und Schiedsrichter nur, wenn eingerichtet)', async ({ page }) => {
    await spielplan(page);
    const karte = page.locator('[data-match-card]:visible').filter({ hasText: NAMEN[0] }).first();
    await karte.getByText(NAMEN[0]).first().click();
    // Das Turnier hat ein Feld und keine Schiedsrichter: „Feld ändern“ und „Schiedsrichter ändern“ sind nicht angeschlossen und fehlen (kein stummer Knopf)
    await expect(menue(page).getByRole('listitem')).toHaveText(['Im Cockpit anpfeifen', 'Ab hier verschieben', 'Nicht angetreten', 'Ergebnis eintragen']); // @SL-239: Haupttaste „Ergebnis eintragen“ zuletzt
  });

  test('@SL-193 Tippflächen: jede Aktion mindestens 56 px hoch, „Schließen“ mindestens 44 px, Auswahl schließt mit Esc', async ({ page }) => {
    await spielplan(page);
    await tippeFinalspiel(page, HF1);
    for (const eintrag of await menue(page).getByRole('listitem').all()) {
      const box = await eintrag.getByRole('button').boundingBox();
      expect(box?.height ?? 0).toBeGreaterThan(55.9);
    }
    const schliessen = await page.getByTestId('match-action-menu-close').boundingBox();
    expect(schliessen?.height ?? 0).toBeGreaterThan(43.9);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(menue(page)).toHaveCount(0);
  });

  for (const [name, breite, hoehe] of [['360x640', 360, 640], ['390x844', 390, 844], ['1280x720', 1280, 720]] as const) {
    test(`@SL-239 @OB-022 ${name}: „X“ oben, Abzeichen neben dem Titel, Haupttaste gefüllt und zuletzt, alles ohne Scrollen im Fenster`, async ({ page }) => {
      await page.setViewportSize({ width: breite, height: hoehe });
      await spielplan(page);
      const karte = page.locator('[data-match-card]:visible').filter({ hasText: NAMEN[0] }).first();
      await karte.getByText(NAMEN[0]).first().click(); // Gruppenspiel geplant: vier Aktionen, Haupttaste „Ergebnis eintragen“
      const blatt = menue(page);
      await expect(blatt).toBeVisible();
      await animationenFertig(page); // das Blatt gleitet 0,3 s ein; erst danach messen (sonst stehen Titel und Abzeichen in verschiedenen Bildern)
      const kopf = blatt.getByTestId('dialog-surface-header');

      // Kopf: Titel und Abzeichen in einer Zeile (Abzeichen rechts vom Titel, auf der Grundlinie), „X“ am rechten Rand oben
      const titel = await kopf.getByRole('heading').boundingBox();
      const abzeichen = await kopf.getByTestId('match-action-badge').boundingBox();
      const kreuz = await page.getByTestId('match-action-menu-close').boundingBox();
      expect(abzeichen!.x, 'Abzeichen steht rechts vom Titel').toBeGreaterThan(titel!.x + titel!.width - 1);
      expect(abzeichen!.y + abzeichen!.height, 'Abzeichen auf der Grundlinie des Titels (Unterkante nicht unter dem Titel)').toBeLessThanOrEqual(titel!.y + titel!.height + 4);
      expect(abzeichen!.y, 'Abzeichen nicht über dem Titel').toBeGreaterThanOrEqual(titel!.y - 4);
      expect(kreuz!.y, '„X“ oben im Kopf').toBeLessThan(titel!.y + titel!.height);
      expect(kreuz!.x + kreuz!.width, '„X“ rechts').toBeGreaterThan(breite / 2);
      expect(kreuz!.height, '„X“ mindestens 44 px').toBeGreaterThan(43.9);
      await expect(kopf).toContainText(/\d\d:\d\d Uhr · Feld 1/);

      // Haupttaste: gefüllt (data-primary), ≥ 56 px, letzte Taste, ganz im Fenster ohne Scrollen
      const haupt = page.getByTestId('match-action-enterResult');
      await expect(haupt).toHaveAttribute('data-primary', 'true');
      const hb = await haupt.boundingBox();
      expect(hb!.height, 'Haupttaste mindestens 56 px').toBeGreaterThan(55.9);
      expect(hb!.y + hb!.height, 'Haupttaste ganz im Fenster').toBeLessThanOrEqual(hoehe);
      for (const andere of ['kickOff', 'shiftFrom', 'forfeit']) {
        const ab = await page.getByTestId(`match-action-${andere}`).boundingBox();
        expect(ab!.y + ab!.height, `${andere} liegt über der Haupttaste`).toBeLessThanOrEqual(hb!.y + 1);
        await expect(page.getByTestId(`match-action-${andere}`)).not.toHaveAttribute('data-primary', 'true');
      }
      await expect(blatt.locator('[data-primary="true"]')).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      // Unten keine Taste „Schließen“ mehr: genau ein Knopf mit diesem Namen, und der steht im Kopf
      await expect(blatt.getByRole('button', { name: 'Schließen' })).toHaveCount(1);
      await expect(kopf.getByRole('button', { name: 'Schließen' })).toHaveCount(1);
    });
  }

  test('@SL-239 @EK-063 beendetes Spiel: Abzeichen „Ende“, Spielzeile mit Endstand, Haupttaste „Ergebnis korrigieren“ zuletzt', async ({ page }) => {
    await spielplan(page);
    await tippeFinalspiel(page, HF1);
    const kopf = menue(page).getByTestId('dialog-surface-header');
    await expect(kopf.getByTestId('match-action-badge')).toHaveText('Ende');
    await expect(kopf.getByTestId(`match-box-aktion-${HF1}-home-digits`)).toHaveText('2');
    await expect(kopf.getByTestId(`match-box-aktion-${HF1}-away-digits`)).toHaveText('1');
    await expect(page.getByTestId('match-action-correct')).toHaveAttribute('data-primary', 'true');
    await expect(menue(page).getByRole('button').last()).toHaveAttribute('data-testid', 'match-action-correct');
  });

  test('@FU-080 Protokoll ansehen: das beendete Halbfinale öffnet das Protokoll des Spiels, nur lesend', async ({ page }) => {
    await spielplan(page);
    await tippeFinalspiel(page, HF1);
    await page.getByTestId('match-action-protocol').click();
    const blatt = page.getByTestId('event-log-sheet');
    await expect(blatt).toBeVisible();
    await expect(blatt).toContainText('Ereignisprotokoll');
    await expect(blatt.getByRole('button', { name: /Bearbeiten/ })).toHaveCount(0);
  });

  test('@SL-194 C-MATCHID-URL-BLEIBT: Spiel 1 läuft, „Im Cockpit anpfeifen“ bei Spiel 2 fragt „Spiel 1 läuft weiter. Trotzdem zu Spiel 2 wechseln?“; nach „Wechseln“ läuft Spiel 1 weiter und die Adresse trägt kein ?matchId=', async ({ page }) => {
    await anpfeifen(page); // Spiel 1 läuft
    await spielplan(page);
    const karte = page.locator('[data-match-card]:visible').filter({ hasText: NAMEN[2] }).first(); // Spiel 2: TSV Ost gegen FC West
    await karte.getByText(NAMEN[2]).first().click();
    await page.getByTestId('match-action-kickOff').click();

    const frage = page.getByRole('dialog').filter({ hasText: 'läuft weiter' });
    await expect(frage).toHaveText(/Spiel 1 läuft weiter\. Trotzdem zu Spiel 2 wechseln\?/);
    await expect(page.getByTestId('confirm-dialog-confirm')).toHaveText('Wechseln');
    await page.getByTestId('confirm-dialog-confirm').click();

    await expect(page).toHaveURL(new RegExp(`/tournament/${ID}/live`));
    await expect.poll(() => page.url()).not.toContain('matchId');
    // Spiel 1 läuft unverändert weiter: im Spielplan zeigt seine Karte weiter „Live“
    await spielplan(page);
    await expect(page.locator('[data-match-card]:visible').filter({ hasText: NAMEN[0] }).first()).toContainText(/Live|läuft/i);
  });
});
