/**
 * Paket Z2 (Zuschauer-Seite, Kopfblock): oben „Läuft gerade“ / „Als Nächstes“ / „Zuletzt beendet“, ein Turnier-Kopf (@ZM-141).
 *
 * Saat `hallencup-messlauf` (Code MESS26): das Finale (Spiel 16) läuft seit 320 s, Heim „Sportgemeinschaft Fußballfreunde
 * Nordheim-Süd 1921“ (langer Name, @ZM-087/@ZM-148), Spiel 15 ist ungespielt; PHASEH: Spiel in der Halbzeitpause.
 * „Kein Spiel läuft“ und „alles beendet“ entstehen aus derselben Saat im Test (Spiel 16 geplant bzw. 15 und 16 beendet).
 * „Ohne zu scrollen“ heißt: der ganze Kopfblock liegt über der festen Reiterleiste unten, auf 360×640 gemessen.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
// @ts-expect-error – .mjs ohne Typen; derselbe Lader wie bei `npm run visual:metrics --saat`
import { installiereSaat, leseSaat } from '../../../scripts/visual-metrics/saat/lader.mjs';

const HANDY = { width: 360, height: 640 };
const FINALE = '00000003-0000-4000-8000-000000000016';
const PLATZ_3 = '00000003-0000-4000-8000-000000000015';
const HALBFINALE_1 = '00000003-0000-4000-8000-000000000013'; // 1:1, Verlängerung 1:0, Heim gewinnt
const LANGER_NAME = 'Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921';

interface SaatMatch { id: string; matchStatus?: string; scoreA?: number; scoreB?: number; liveState?: unknown; timerStartTime?: unknown; timerElapsedSeconds?: number }
interface SaatDatei { datenbanken: { eintraege: { tournaments?: { matches: SaatMatch[] }[] } }[] }

/** Die Saat mit veränderten Spielen des Messlauf-Turniers (erstes Turnier im Zwischenspeicher). */
function saatMit(aendere: (matches: SaatMatch[]) => void): SaatDatei {
  const saat = leseSaat('hallencup-messlauf') as SaatDatei;
  const turnier = saat.datenbanken[0].eintraege.tournaments?.[0];
  if (turnier === undefined) { throw new Error('Saat ohne Turnier'); }
  aendere(turnier.matches);
  return saat;
}
const finaleGeplant = (matches: SaatMatch[]): void => {
  for (const m of matches.filter((x) => x.id === FINALE)) {
    Object.assign(m, { matchStatus: 'scheduled', timerElapsedSeconds: 0 });
    delete m.scoreA; delete m.scoreB; delete m.liveState; delete m.timerStartTime;
  }
};
/** Nur das Halbfinale 1 (nach Verlängerung) bleibt beendet, alle anderen Spiele fallen aus: es ist das zuletzt beendete Spiel. */
const nurHalbfinaleBeendet = (matches: SaatMatch[]): void => {
  for (const m of matches.filter((x) => x.id !== HALBFINALE_1)) {
    Object.assign(m, { matchStatus: 'skipped' });
    delete m.liveState; delete m.timerStartTime;
  }
};
const letzteBeendet = (matches: SaatMatch[]): void => {
  for (const m of matches.filter((x) => x.id === FINALE || x.id === PLATZ_3)) {
    Object.assign(m, { matchStatus: 'finished', scoreA: 3, scoreB: 1, timerElapsedSeconds: 600 });
    delete m.liveState; delete m.timerStartTime;
  }
};

async function oeffne(page: Page, code: string, saat: SaatDatei = leseSaat('hallencup-messlauf')) {
  await page.setViewportSize(HANDY);
  await installiereSaat(page.context(), saat);
  await page.goto(`/#/live/${code}`);
  await expect(page.locator('[data-testid="public-current"]')).toBeAttached({ timeout: 25000 });
}

const kopf = (page: Page) => page.locator('[data-testid="public-current"]');

/** Der Kopfblock liegt ganz im sichtbaren Bereich über der festen Reiterleiste (kein Scrollen nötig). */
async function ohneScrollenSichtbar(page: Page): Promise<{ unten: number; leiste: number }> {
  return page.evaluate(() => {
    const k = document.querySelector('[data-testid="public-current"]')!.getBoundingClientRect();
    const leiste = document.querySelector('nav')!.getBoundingClientRect();
    return { unten: k.bottom, leiste: leiste.top };
  });
}

test.describe('@ZM-141 Kopfblock oben, ohne zu scrollen (360×640)', () => {
  test('@ZM-141 Spiel läuft: „Läuft gerade“ mit Stand 2:1, Live-Abzeichen und Restzeit, langer Name vollständig', async ({ page }) => {
    await oeffne(page, 'MESS26');
    await expect(kopf(page).getByRole('heading', { name: 'Läuft gerade' })).toBeVisible();
    await expect(kopf(page).locator(`[data-testid="public-current-badge-${FINALE}"]`)).toHaveText('Live');
    await expect(kopf(page).locator(`[data-testid="match-goals-kopf-${FINALE}-home"]`)).toHaveText('2');
    await expect(kopf(page).locator(`[data-testid="match-goals-kopf-${FINALE}-away"]`)).toHaveText('1');
    await expect(kopf(page).locator(`[data-testid="public-current-clock-${FINALE}"]`)).toHaveText(/^4:[0-4]\d$/);
    const name = kopf(page).locator(`[data-testid="match-name-kopf-${FINALE}-home"]`);
    await expect(name).toHaveText(LANGER_NAME);
    const { unten, leiste } = await ohneScrollenSichtbar(page);
    expect(unten).toBeLessThanOrEqual(leiste);
  });

  test('@OB-067 Kopf 360×640: Stand und Restzeit sind die größten Texte der Spielanzeige, Schriftstärke 800, gleich breite Ziffern', async ({ page }) => {
    await oeffne(page, 'MESS26');
    const stil = await page.evaluate((id) => {
      const karte = document.querySelector(`[data-testid="public-current-card-${id}"]`)!;
      const messe = (selektor: string) => {
        const el = document.querySelector<HTMLElement>(selektor)!;
        const s = getComputedStyle(el);
        return { gewicht: s.fontWeight, ziffern: s.fontVariantNumeric, groesse: parseFloat(s.fontSize) };
      };
      const andere = Array.from(karte.querySelectorAll<HTMLElement>('*'))
        .filter((e) => e.children.length === 0 && (e.textContent ?? '').trim() !== '' && !e.matches('[data-testid$="-digits"], [data-testid^="public-current-clock-"]'))
        .map((e) => parseFloat(getComputedStyle(e).fontSize));
      return {
        stand: [messe(`[data-testid="match-box-kopf-${id}-home-digits"]`), messe(`[data-testid="match-box-kopf-${id}-away-digits"]`)],
        zeit: messe(`[data-testid="public-current-clock-${id}"]`),
        andere: Math.max(...andere),
      };
    }, FINALE);
    for (const m of [...stil.stand, stil.zeit]) {
      expect(m.gewicht).toBe('800');
      expect(m.ziffern).toContain('tabular-nums');
      expect(m.groesse).toBeGreaterThan(stil.andere);
    }
  });

  test('@ZM-087 @ZM-148 langer Name im Kopf: bricht um, kein „…“, nichts läuft über den Rand der Karte', async ({ page }) => {
    await oeffne(page, 'MESS26');
    const mass = await page.evaluate((id) => {
      const karte = document.querySelector(`[data-testid="public-current-card-${id}"]`)!.getBoundingClientRect();
      const name = document.querySelector<HTMLElement>(`[data-testid="match-name-kopf-${id}-home"]`)!;
      const tore = document.querySelector(`[data-testid="match-goals-kopf-${id}-home"]`)!.getBoundingClientRect();
      const r = name.getBoundingClientRect();
      return {
        ellipsis: getComputedStyle(name).textOverflow === 'ellipsis',
        ueberlaeuft: name.scrollWidth > name.clientWidth + 1,
        rechts: r.right, toreLinks: tore.left, karteRechts: karte.right, seite: document.documentElement.scrollWidth,
      };
    }, FINALE);
    expect(mass.ellipsis).toBe(false);
    expect(mass.ueberlaeuft).toBe(false);
    expect(mass.rechts).toBeLessThanOrEqual(mass.toreLinks);
    expect(mass.karteRechts).toBeLessThanOrEqual(HANDY.width);
    expect(mass.seite).toBeLessThanOrEqual(HANDY.width);
  });

  test('@ZM-141 @ZM-041 Halbzeit: Spiel als laufend mit dem Abzeichen „Halbzeit“, nicht als nächstes Spiel', async ({ page }) => {
    await oeffne(page, 'PHASEH');
    await expect(kopf(page).getByRole('heading', { name: 'Läuft gerade' })).toBeVisible();
    await expect(kopf(page).locator('[data-testid^="public-current-badge-"]')).toHaveText('Halbzeit');
    await expect(kopf(page).getByRole('heading', { name: 'Als Nächstes' })).toHaveCount(0);
    const { unten, leiste } = await ohneScrollenSichtbar(page);
    expect(unten).toBeLessThanOrEqual(leiste);
  });

  test('@ZM-141 @ZM-195 kein Spiel läuft: Spiel 15 als nächstes Spiel mit Uhrzeit, Kästen mit 0 vor dem Anpfiff, ohne Uhr', async ({ page }) => {
    await oeffne(page, 'MESS26', saatMit(finaleGeplant));
    await expect(kopf(page).getByRole('heading', { name: 'Als Nächstes' })).toBeVisible();
    await expect(kopf(page).locator(`[data-testid="public-current-badge-${PLATZ_3}"]`)).toHaveText(/^\d\d:\d\d$/);
    await expect(kopf(page).locator(`[data-testid="public-current-meta-${PLATZ_3}"]`)).toContainText('Spiel 15');
    await expect(kopf(page).locator(`[data-testid="match-box-kopf-${PLATZ_3}-home"]`)).toBeVisible();
    await expect(kopf(page).locator(`[data-testid="match-goals-kopf-${PLATZ_3}-home"]`)).toContainText('0');
    await expect(kopf(page).locator('[data-testid^="public-current-clock-"]')).toHaveCount(0);
    const { unten, leiste } = await ohneScrollenSichtbar(page);
    expect(unten).toBeLessThanOrEqual(leiste);
  });

  test('@OB-064 @ZM-158 nach Verlängerung: „nach Verlängerung“ klein beim Stand des Siegers, rechtsbündig unter seinem Kasten, nicht beim Namen', async ({ page }) => {
    await oeffne(page, 'MESS26', saatMit(nurHalbfinaleBeendet));
    await expect(kopf(page).locator(`[data-testid="match-overtime-kopf-${HALBFINALE_1}-home"]`)).toHaveText('nach Verlängerung');
    await expect(kopf(page).locator(`[data-testid="match-overtime-kopf-${HALBFINALE_1}-away"]`)).toHaveCount(0);
    const m = await page.evaluate((id) => {
      const r = (sel: string) => document.querySelector(sel)!.getBoundingClientRect();
      // Die Zeile reicht über die ganze Breite; gemessen wird der Text selbst (rechtsbündig)
      const zeile = document.querySelector(`[data-testid="match-overtime-kopf-${id}-home"]`)!;
      const text = document.createRange();
      text.selectNodeContents(zeile);
      const note = text.getBoundingClientRect();
      const heim = r(`[data-testid="match-box-kopf-${id}-home"]`);
      const gast = r(`[data-testid="match-box-kopf-${id}-away"]`);
      const name = r(`[data-testid="match-name-kopf-${id}-home"]`);
      return { noteTop: note.top, noteBottom: note.bottom, noteRight: note.right, heimBottom: heim.bottom, heimRight: heim.right, gastTop: gast.top, nameBottom: name.bottom, seite: document.documentElement.scrollWidth };
    }, HALBFINALE_1);
    // unter dem Kasten des Siegers und über dem des Gastes, rechtsbündig mit dem Kasten (Ring und Rahmen bis 6 px); steht nicht beim Namen
    expect(m.noteTop).toBeGreaterThanOrEqual(m.heimBottom - 1);
    expect(m.noteBottom).toBeLessThanOrEqual(m.gastTop + 1);
    expect(Math.abs(m.noteRight - m.heimRight)).toBeLessThanOrEqual(6);
    expect(m.noteTop).toBeGreaterThanOrEqual(m.nameBottom - 1);
    expect(m.seite).toBeLessThanOrEqual(HANDY.width);
  });

  test('@ZM-141 alles beendet, Turnier nicht abgeschlossen: das zuletzt beendete Spiel mit Ergebnis 3:1', async ({ page }) => {
    await oeffne(page, 'MESS26', saatMit(letzteBeendet));
    await expect(kopf(page).getByRole('heading', { name: 'Zuletzt beendet' })).toBeVisible();
    await expect(kopf(page).locator(`[data-testid="public-current-badge-${FINALE}"]`)).toHaveText('Ende');
    await expect(kopf(page).locator(`[data-testid="match-goals-kopf-${FINALE}-home"]`)).toHaveText('3');
    await expect(kopf(page).locator(`[data-testid="match-goals-kopf-${FINALE}-away"]`)).toHaveText('1');
    // Kasten wie auf der Karte: Ring beim Sieger, Pokal in der Finalrunde (@ZM-158, @OB-064)
    await expect(kopf(page).locator(`[data-testid="match-box-kopf-${FINALE}-home"]`)).toHaveAttribute('data-outcome', 'winner');
    await expect(kopf(page).locator(`[data-testid="match-box-kopf-${FINALE}-home-cup"]`)).toBeVisible();
    await expect(kopf(page).locator(`[data-testid="match-box-kopf-${FINALE}-away"]`)).toHaveAttribute('data-outcome', 'loser');
    const { unten, leiste } = await ohneScrollenSichtbar(page);
    expect(unten).toBeLessThanOrEqual(leiste);
  });
});

test.describe('@ZM-141 ein Turnier-Kopf, darunter der Spielplan', () => {
  test('@ZM-141 Zuschauer-Seite: der Titel steht einmal, keine zweite Turnierkarte mit Info-Box; der Kopfblock steht über „Mein Team“', async ({ page }) => {
    await oeffne(page, 'MESS26');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.locator('.tournament-header')).toHaveCount(0);
    const oben = await page.evaluate(() => {
      const k = document.querySelector('[data-testid="public-current"]')!.getBoundingClientRect().top;
      const m = document.querySelector('[data-testid="my-team-bar"]')!.getBoundingClientRect().top;
      const plan = document.querySelector('.group-stage-schedule')!.getBoundingClientRect().top;
      return { k, m, plan };
    });
    expect(oben.k).toBeLessThan(oben.m);
    expect(oben.m).toBeLessThan(oben.plan);
  });

  test('@ZM-141 Gegenbeispiel: die Verwaltung (Spielplan der Turnierleitung) behält ihre Turnierkarte', async ({ page }) => {
    await page.setViewportSize(HANDY);
    await installiereSaat(page.context(), leseSaat('hallencup-messlauf'));
    await page.goto('/#/tournament/hallencup-messlauf/schedule');
    await expect(page.locator('.tournament-header')).toBeAttached({ timeout: 25000 });
    await expect(page.locator('[data-testid="public-current"]')).toHaveCount(0);
  });
});
