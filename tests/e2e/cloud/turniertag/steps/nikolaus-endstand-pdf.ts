/**
 * N8: Endstand-PDF nach dem echten Abschluss (N7b schließt das Nikolaus-Turnier per Oberfläche ab; Paket „Endstand-PDF“, Befund
 * C-ENDSTAND-PDF-GESPERRT). Gezählt wird jeder Tipp ab dem Start des Szenarios bis zum Download (der Speichern-Dialog des Geräts zählt
 * nicht, @DR-048). Das heruntergeladene PDF wird mit pdfjs gelesen: Fußzeile „Endstand – abgeschlossen am …“ und die Plätze 1 bis 6 wie
 * im gespeicherten Endstand des Servers (`tournament_final_standings`, @ET-045).
 * Mit `E2E_PDF_ABLAGE=<Ordner>` legt der Lauf die erzeugten PDFs dort ab (Nachweis für Daniel), sonst nur im Testordner.
 */
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { extractPdfText } from '../../../../../src/lib/pdf/__tests__/pdfjsText';
import { getRows, vorbedingung } from './shared';
import { handyKontext, NIKOLAUS, openNikolausPath } from './nikolaus-shared';
import type { StepContext, TurniertagStep } from './types';

interface GespeicherterEndstand { snapshot: { ranking: Array<{ place: number; teamName: string }> }; finished_at: string }

async function gespeichert(): Promise<GespeicherterEndstand> {
  const zeilen = await getRows<GespeicherterEndstand>(`tournament_final_standings?tournament_id=eq.${NIKOLAUS.tournamentId}&select=snapshot,finished_at`, 'gespeicherter Endstand');
  expect(zeilen, 'Vorbedingung: N7b hat den Endstand gespeichert').toHaveLength(1);
  return zeilen[0];
}

async function turnierIstAbgeschlossen(): Promise<void> {
  const zeilen = await getRows<{ lifecycle_status: string }>(`tournaments?id=eq.${NIKOLAUS.tournamentId}&select=lifecycle_status`, 'Zustand des Turniers');
  expect(zeilen[0]?.lifecycle_status, 'Vorbedingung: das Turnier ist abgeschlossen (N7b)').toBe('finished');
}

/** Zählt die Tipps eines Szenarios. */
function tippZaehler(): { tippe: (ziel: Locator) => Promise<void>; anzahl: () => number } {
  let n = 0;
  return {
    tippe: async (ziel) => { await ziel.click(); n += 1; },
    anzahl: () => n,
  };
}

/** „Endstand – abgeschlossen am 28.11.2026 um 12:30“ in der Ortszeit des Browsers (wie das PDF sie druckt). */
async function abschlussZeile(page: Page, finishedAt: string): Promise<string> {
  return page.evaluate((iso) => {
    const d = new Date(iso);
    const zwei = (n: number) => String(n).padStart(2, '0');
    return `Endstand – abgeschlossen am ${zwei(d.getDate())}.${zwei(d.getMonth() + 1)}.${d.getFullYear()} um ${zwei(d.getHours())}:${zwei(d.getMinutes())}`;
  }, finishedAt);
}

/** Letzter Tipp (Haupttaste im PDF-Dialog) und Download lesen; Datei optional ablegen. */
async function speichernUndLesen(page: Page, tippe: (ziel: Locator) => Promise<void>, name: string): Promise<{ seiten: string[][]; datei: string }> {
  const download = page.waitForEvent('download');
  await tippe(page.getByTestId('pdf-save'));
  const geladen = await download;
  const ziel = test.info().outputPath(`${name}-${geladen.suggestedFilename()}`);
  await geladen.saveAs(ziel);
  const ablage = process.env.E2E_PDF_ABLAGE;
  if (ablage) {
    mkdirSync(ablage, { recursive: true });
    copyFileSync(ziel, path.join(ablage, `${name}.pdf`));
  }
  const { pages } = await extractPdfText(new Uint8Array(readFileSync(ziel)), geladen.suggestedFilename());
  return { seiten: pages, datei: geladen.suggestedFilename() };
}

/** Plätze des Blocks „Platzierung“ bzw. der „Abschlusstabelle“ (Jeder gegen jeden, @DR-009): Teamnamen nach der Überschrift in Reihenfolge. */
function plaetzeImPdf(seiten: string[][], namen: readonly string[]): string[] {
  const text = seiten.flat();
  const start = Math.max(text.lastIndexOf('Abschlusstabelle'), text.lastIndexOf('Platzierung'));
  return start < 0 ? [] : text.slice(start + 1).filter((s) => namen.includes(s.trim())).map((s) => s.trim());
}

async function pruefeEndstandPdf(page: Page, seiten: string[][], datei: string): Promise<void> {
  const { snapshot, finished_at } = await gespeichert();
  const erwartet = [...snapshot.ranking].sort((a, b) => a.place - b.place).map((zeile) => zeile.teamName);
  const zeile = await abschlussZeile(page, finished_at);
  expect(seiten.length, 'PDF hat Seiten').toBeGreaterThan(0);
  for (const [i, seite] of seiten.entries()) {
    expect(seite.join(' '), `Seite ${String(i + 1)}: Abschlusszeile statt Stand (@DR-011)`).toContain(zeile);
    expect(seite.join(' '), `Seite ${String(i + 1)}: kein „Stand …“`).not.toMatch(/Stand \d{2}\.\d{2}\. \d{2}:\d{2}/);
  }
  expect(plaetzeImPdf(seiten, erwartet), 'Plätze 1 bis 6 wie im gespeicherten Endstand').toEqual(erwartet);
  expect(datei, 'Dateiname nennt den Endstand').toMatch(/_Endstand_\d{4}-\d{2}-\d{2}_\d{4}\.pdf$/);
}

/** N8a (@DR-048 Z. 3, @DR-011): „Als PDF“ in der Endstand-Ansicht (Reiter „Tabellen“), höchstens 3 Tipps ab dem geöffneten Turnier. */
async function ausEndstandAnsicht({ asRole }: StepContext): Promise<void> {
  await vorbedingung('Turnier abgeschlossen', turnierIstAbgeschlossen);
  for (const rolle of ['owner', 'coadmin'] as const) {
    const seite = await asRole(rolle);
    await openNikolausPath(seite, '/schedule');
    const { tippe, anzahl } = tippZaehler();
    await tippe(seite.getByRole('button', { name: 'Tabellen', exact: true }).first());
    await tippe(seite.getByTestId('final-standings-pdf'));
    await expect(seite.getByTestId('pdf-choice-final'), '„Endstand“ ist vorgewählt').toHaveAttribute('aria-checked', 'true', { timeout: 15_000 });
    const { seiten, datei } = await speichernUndLesen(seite, tippe, `endstand-ansicht-${rolle}`);
    expect(anzahl(), `${rolle}: Tipps ab geöffnetem Turnier`).toBeLessThanOrEqual(3);
    await pruefeEndstandPdf(seite, seiten, datei);
  }
}

/** N8b (@DR-048 Z. 2, @DR-009): „Als PDF“ im Turnier: „Endstand“ ist vorgewählt – ein Tipp auf „Als PDF“, einer auf „Speichern“. */
async function imTurnierVorgewaehlt({ asRole }: StepContext): Promise<void> {
  await vorbedingung('Turnier abgeschlossen', turnierIstAbgeschlossen);
  const seite = await asRole('owner');
  await openNikolausPath(seite, '/schedule');
  const { tippe, anzahl } = tippZaehler();
  await tippe(seite.getByTestId('schedule-action-pdf'));
  await expect(seite.getByTestId('pdf-choice-final'), '„Endstand“ ist vorgewählt').toHaveAttribute('aria-checked', 'true', { timeout: 15_000 });
  const { seiten, datei } = await speichernUndLesen(seite, tippe, 'endstand-dialog');
  expect(anzahl(), 'Tipps ab dem Spielplan').toBe(2);
  await pruefeEndstandPdf(seite, seiten, datei);
}

/**
 * N8b2 (@DR-048 Z. 2 wörtlich): ab der Startseite höchstens 3 Tipps – Karte, „Als PDF“, Speichern. Heute steht ein abgeschlossenes Turnier
 * sofort im Archiv (ein Tipp mehr); das ändert @OB-081 (#451: bis Tagesende unter „Heute“).
 */
async function abStartseite({ asRole }: StepContext): Promise<void> {
  await vorbedingung('Turnier abgeschlossen', turnierIstAbgeschlossen);
  const seite = await asRole('owner');
  await seite.goto('/#/');
  const { tippe, anzahl } = tippZaehler();
  await expect(seite.getByTestId(`tournament-card-${NIKOLAUS.tournamentId}`), 'Karte ohne weiteren Tipp auf der Startseite (@OB-081)').toBeVisible({ timeout: 15_000 });
  await tippe(seite.getByTestId(`tournament-card-${NIKOLAUS.tournamentId}`));
  await tippe(seite.getByTestId('schedule-action-pdf'));
  await expect(seite.getByTestId('pdf-choice-final')).toHaveAttribute('aria-checked', 'true', { timeout: 15_000 });
  const { seiten, datei } = await speichernUndLesen(seite, tippe, 'endstand-startseite');
  expect(anzahl()).toBeLessThanOrEqual(3);
  await pruefeEndstandPdf(seite, seiten, datei);
}

/** N8c (@BM-041): Mama Petra auf der Zuschauer-Seite: „Als PDF“, „Endstand“ ist vorgewählt, Speichern – Plätze 1 bis 6 und die Ergebnisse. */
async function zuschauerEndstand({ anonPage }: StepContext): Promise<void> {
  await vorbedingung('Turnier abgeschlossen', turnierIstAbgeschlossen);
  await anonPage.goto(`/#/live/${NIKOLAUS.shareCode}`);
  await expect(anonPage.getByTestId('final-standings-list'), 'Endstand der Zuschauer-Seite').toBeVisible({ timeout: 20_000 });
  const { tippe, anzahl } = tippZaehler();
  await tippe(anonPage.getByTestId('public-pdf-button').first());
  await expect(anonPage.getByTestId('pdf-choice-final'), '„Endstand“ ist vorgewählt').toHaveAttribute('aria-checked', 'true', { timeout: 15_000 });
  const { seiten, datei } = await speichernUndLesen(anonPage, tippe, 'endstand-zuschauer');
  expect(anzahl()).toBe(2);
  await pruefeEndstandPdf(anonPage, seiten, datei);
  // „die Ergebnisse aller Spiele“: jedes Spiel trägt im PDF ein Ergebnis „n : m“ (ein Doppelpunkt zwischen zwei Zahlen)
  const ergebnisse = seiten.flat().join(' ').match(/\b\d+ : \d+\b/g) ?? [];
  expect(ergebnisse.length, 'Ergebnisse aller 15 Spiele').toBeGreaterThanOrEqual(15);
}

/** Kindermodus am (abgeschlossenen) Turnier umschalten: nur als Datenbank-Eigentümer mit dem Server-Schalter (wie N7d). */
function setzeKindermodus(an: boolean): void {
  const sql = `BEGIN; SELECT set_config('app.lifecycle_write','on',true); UPDATE public.tournaments SET config = jsonb_set(coalesce(config,'{}'::jsonb), '{hideScoresForPublic}', '${an ? 'true' : 'false'}'::jsonb) WHERE id = '${NIKOLAUS.tournamentId}'; COMMIT;`;
  execFileSync('docker', ['exec', '-i', 'supabase_db_hallenfussball-pwa', 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', sql], { stdio: 'pipe' });
}

/** N8d (Record Endstand, Gegenbeispiel „Kindermodus-Lecks“): im Kindermodus bietet die Zuschauer-Seite kein Endstand-PDF an. */
async function zuschauerKindermodus({ anonPage }: StepContext): Promise<void> {
  await vorbedingung('Turnier abgeschlossen', turnierIstAbgeschlossen);
  setzeKindermodus(true);
  try {
    await anonPage.goto(`/#/live/${NIKOLAUS.shareCode}`);
    await expect(anonPage.getByTestId('final-standings-kids')).toBeVisible({ timeout: 20_000 });
    await anonPage.getByTestId('public-pdf-button').first().click();
    await expect(anonPage.getByTestId('pdf-viewer-plan'), 'nur „Spielplan“').toBeVisible();
    await expect(anonPage.getByTestId('pdf-choice-final'), 'kein Endstand-PDF im Kindermodus').toHaveCount(0);
  } finally {
    setzeKindermodus(false);
  }
}

/** N8e (@OB-082): am Handy steht am Zahnrad „Verwaltung“; ein Tipp öffnet die Verwaltung. */
async function verwaltungAmHandy({ browser }: StepContext): Promise<void> {
  const { context, page } = await handyKontext(browser, 'owner');
  try {
    await page.setViewportSize({ width: 360, height: 640 });
    await openNikolausPath(page, '/schedule');
    const zahnrad = page.getByTestId('management-admin-entry');
    await expect(zahnrad).toContainText('Verwaltung', { timeout: 15_000 });
    const box = await zahnrad.boundingBox();
    expect(box?.height ?? 0, 'Tippfläche ≥ 44 px').toBeGreaterThanOrEqual(44);
    await zahnrad.click();
    await expect(page).toHaveURL(new RegExp(`/tournament/${NIKOLAUS.tournamentId}/admin`));
  } finally {
    await context.close();
  }
}

export const steps: readonly TurniertagStep[] = [
  { id: 'N8a', title: 'Endstand-PDF aus der Endstand-Ansicht (Reiter Tabellen): Olli und Maria, ≤ 3 Tipps, Abschlusszeile, Plätze wie gespeichert', scenarios: ['@DR-048', '@DR-011'], befunde: ['C-ENDSTAND-PDF-GESPERRT'], owner: 'Paket Endstand-PDF', expectedFail: false, run: ausEndstandAnsicht },
  { id: 'N8b', title: 'Endstand-PDF im Turnier: „Endstand“ im Dialog vorgewählt, Abschlusszeile, Plätze wie gespeichert', scenarios: ['@DR-048', '@DR-011', '@DR-009'], befunde: ['C-ENDSTAND-PDF-GESPERRT'], owner: 'Paket Endstand-PDF', expectedFail: false, run: imTurnierVorgewaehlt },
  { id: 'N8b2', title: 'Endstand-PDF ab der Startseite in ≤ 3 Tipps (abgeschlossen bleibt bis Tagesende unter „Heute“)', scenarios: ['@DR-048', '@OB-081'], owner: '#451 (@OB-081 Startseite)', expectedFail: true, run: abStartseite },
  { id: 'N8c', title: 'Zuschauer-Seite: Endstand-PDF nach dem Abschluss mit Plätzen und Ergebnissen', scenarios: ['@BM-041'], owner: 'Paket Endstand-PDF', expectedFail: false, run: zuschauerEndstand },
  { id: 'N8d', title: 'Zuschauer-Seite im Kindermodus: kein Endstand-PDF', scenarios: ['@BM-041'], owner: 'Paket Endstand-PDF', expectedFail: false, run: zuschauerKindermodus },
  { id: 'N8e', title: 'Handy 360×640: Zahnrad mit dem Wort „Verwaltung“ öffnet die Verwaltung', scenarios: ['@OB-082'], owner: 'Paket Endstand-PDF', expectedFail: false, run: verwaltungAmHandy },
];
