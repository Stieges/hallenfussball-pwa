/**
 * D11b-D18: Folgen des Abschlusses und Betrieb (Plan (b)). Alle expectedFail mit Besitzer.
 * Reihenfolge (Fixrunde 1, A3): D13b/D13c (Zeiten, Hallenton) gehören an den Turniertag VOR den Abschluss (Export `stepsNachZeitplan`,
 * im Spec vor D8); nach dem Abschluss ist das Turnier gesperrt.
 */
import { expect } from '@playwright/test';
import { E2E_TURNIERTAG_SHARE_CODE } from '../../testData';
import { restAsRole } from '../../restAsRole';
import { expectPageAnchor, expectSollMarker, getRows, openTurniertagPath, SOLL_TIMEOUT_MS, TURNIERTAG_ID } from './shared';
import type { StepContext, TurniertagStep } from './types';

/**
 * D11b: nach dem Abschluss ist der Helfer-QR ungültig (`join_code_info` nennt „closed“, @HE-038) und der Zustand steht am Server auf „abgeschlossen“ –
 * nicht schon vorher (C-ZUSTAND-ABGELEITET, C-E2E-N7B-SPALTE: die Spalte ist `lifecycle_status`, nicht `status`). Wie D11 bis Teil F erwartet rot.
 */
async function nachAbschluss({ asRole }: StepContext): Promise<void> {
  const ownerPage = await asRole('owner');
  await openTurniertagPath(ownerPage, '/admin/dashboard');
  await expectPageAnchor(ownerPage.getByText('Dashboard', { exact: true }).first(), 'Admin-Kategorie Dashboard');
  const zustand = (await getRows<{ lifecycle_status: string }>(`tournaments?id=eq.${TURNIERTAG_ID}&select=lifecycle_status`, 'Zustand des Turniers'))[0]?.lifecycle_status;
  expect(zustand, 'Turnier ist abgeschlossen').toBe('finished');
  const code = await restAsRole('owner', 'POST', 'rpc/ensure_helper_code', { p_tournament_id: TURNIERTAG_ID });
  expect(code.status, 'Helfer-Code lesbar (bleibt nach dem Abschluss verwaltbar)').toBe(200);
  const info = await restAsRole('owner', 'POST', 'rpc/join_code_info', { p_code: (code.json as { code: string }).code });
  expect((info.json as { state: string }).state, 'der QR ist nach dem Abschluss ungültig (@HE-038)').toBe('closed');
}

/** Uhrzeit `hh:mm` plus `minuten` (Tageszeit, ohne Datum). */
function plusMinuten(uhrzeit: string, minuten: number): string {
  const [h, m] = uhrzeit.split(':').map(Number);
  const gesamt = (h * 60 + m + minuten + 24 * 60) % (24 * 60);
  return `${String(Math.floor(gesamt / 60)).padStart(2, '0')}:${String(gesamt % 60).padStart(2, '0')}`;
}

/**
 * D13b: Zeiten ehrlich (@ZP-004): nachdem Olli in D13 alle Felder um 10 Minuten nach hinten verschoben und bestätigt hat, zeigt die
 * Zuschauer-Seite bei einem verschobenen Spiel groß die neue Uhrzeit und klein „(war hh:mm)“ – die neue Uhrzeit ist die alte plus 10 Minuten.
 */
async function zeitenEhrlich({ anonPage }: StepContext): Promise<void> {
  await anonPage.goto(`/#/live/${E2E_TURNIERTAG_SHARE_CODE}`);
  await expectPageAnchor(anonPage.getByRole('heading', { level: 1 }).first(), 'Zuschauer-Seite');
  // Die Verschiebung aus D13 geht über die Warteschlange in die Cloud: höchstens 30 s warten, bis die Spiele ihre ursprüngliche Uhrzeit tragen.
  const verschobeneSpiele = (): Promise<{ id: string }[]> =>
    getRows<{ id: string }>(`matches?tournament_id=eq.${TURNIERTAG_ID}&original_start=not.is.null&select=id`, 'verschobene Spiele');
  await expect.poll(async () => (await verschobeneSpiele()).length, { message: 'die Verschiebung aus D13 steht in der Cloud (matches.original_start)', timeout: 30_000 }).toBeGreaterThan(0);
  const verschoben = await verschobeneSpiele();
  // Die Liste rendert nur Karten im Umfeld des sichtbaren Bereichs: beim Sammeln über die Seite blättern.
  const paare = new Map<string, { war: string; gross: string }>();
  await expect(async () => {
    for (const anteil of [0, 0.25, 0.5, 0.75, 1]) {
      await anonPage.evaluate((f) => window.scrollTo(0, document.body.scrollHeight * f), anteil);
      await anonPage.waitForTimeout(250);
      const gefunden = await anonPage.locator('[data-testid^="match-original-"]').evaluateAll((els) => els.map((el) => {
        // Groß steht die neue Uhrzeit in derselben Zeitzelle, klein dahinter „(war …)“; laufende Spiele zeigen statt der Uhrzeit „live“.
        const zelle = (el.parentElement?.innerText ?? '').replace(el.textContent ?? '', '');
        return { id: el.getAttribute('data-testid') ?? '', text: (el.textContent ?? '').trim(), gross: /\d{2}:\d{2}/.exec(zelle)?.[0] ?? '' };
      }));
      for (const g of gefunden) {
        expect(g.text, 'klein „(war hh:mm)“').toMatch(/^\(war \d{2}:\d{2}\)$/);
        paare.set(g.id, { war: /\d{2}:\d{2}/.exec(g.text)?.[0] ?? '', gross: g.gross });
      }
    }
    expect([...paare.values()].filter((p) => p.gross !== '').length, `mindestens ein verschobenes Spiel mit großer Uhrzeit und „(war …)“ (in der Cloud verschoben: ${verschoben.length})`).toBeGreaterThan(0);
  }).toPass({ timeout: 20_000 });
  for (const { war, gross } of [...paare.values()].filter((p) => p.gross !== '')) {
    expect(gross, `groß die neue Uhrzeit (war ${war}, 10 Minuten nach hinten)`).toBe(plusMinuten(war, 10));
  }
}

/** D13c: Hallenton an Abschnittsende und Spielende, Lautsprecher-Seite (@HT-001, @HT-004). */
async function hallenton({ asRole }: StepContext): Promise<void> {
  const ownerPage = await asRole('owner');
  await openTurniertagPath(ownerPage, '/admin/dashboard');
  await expectPageAnchor(ownerPage.getByText('Dashboard', { exact: true }).first(), 'Admin-Kategorie Dashboard');
  await expectSollMarker(ownerPage, 'hall-speaker-start');
}

/** D17: Impressum und Datenschutz mit echtem Text, von der Zuschauer-Seite erreichbar, Fußzeile nicht verdeckt (C-LEGAL). */
async function rechtstexte({ anonPage }: StepContext): Promise<void> {
  await anonPage.setViewportSize({ width: 390, height: 844 });
  await anonPage.goto(`/#/live/${E2E_TURNIERTAG_SHARE_CODE}`);
  await expectPageAnchor(anonPage.getByRole('heading', { level: 1 }).first(), 'Zuschauer-Seite');
  await anonPage.getByRole('link', { name: /impressum/i }).first().click({ timeout: SOLL_TIMEOUT_MS });
  await expect(anonPage.locator('body'), 'echtes Impressum, kein Platzhalter').not.toHaveText(/platzhalter|TODO|Mustermann/i, { timeout: SOLL_TIMEOUT_MS });
  await expectSollMarker(anonPage, 'legal-text-complete');
}

/** D18: Lastmessung: ein Turniertag gegen den lokalen Stack, Verbrauch für beide Abrufwege (@FT-002, Paket 11b). */
async function lastmessung({ asRole }: StepContext): Promise<void> {
  const ownerPage = await asRole('owner');
  await openTurniertagPath(ownerPage, '/admin/dashboard');
  await expectPageAnchor(ownerPage.getByText('Dashboard', { exact: true }).first(), 'Admin-Kategorie Dashboard');
  await expectSollMarker(ownerPage, 'load-test-report');
}

export const steps: readonly TurniertagStep[] = [
  { id: 'D11b', title: 'Nach dem Abschluss: Helfer-QR ungültig, Dashboard nicht vorzeitig beendet', scenarios: ['@HE-038'], befunde: ['C-ZUSTAND-ABGELEITET', 'C-E2E-N7B-SPALTE'], owner: 'Teil F (Endstand mit Finalrunde); Abschluss-Dialog gebaut (R3-4)', expectedFail: true, run: nachAbschluss },
];

/** Nach D13 (Zeitplan verschieben). */
export const stepsNachZeitplan: readonly TurniertagStep[] = [
  { id: 'D13b', title: 'Zeiten ehrlich: Zuschauer-Seite zeigt die neue Uhrzeit und klein „(war …)“', scenarios: ['@ZP-004'], owner: 'B-26/B-27 (Verschiebung erreicht die Cloud, behoben mit #471)', expectedFail: false, run: zeitenEhrlich },
  { id: 'D13c', title: 'Hallenton an Abschnittsende und Spielende', scenarios: ['@HT-001', '@HT-004'], owner: 'B-46', expectedFail: true, run: hallenton },
];

/** Ende des Ablaufs (nach Sicherung und zweitem Turnier). D16 steht in der Vorbereitung (d00-vorbereitung.ts). */
export const stepsEnde: readonly TurniertagStep[] = [
  { id: 'D17', title: 'Impressum und Datenschutz mit echtem Text, Fußzeile erreichbar (Handy)', scenarios: ['@RE-001', '@RE-004'], befunde: ['C-LEGAL', 'C-FUSS-LINKS-UNTER-LEISTE'], owner: 'B-32 / Kleinfix', expectedFail: true, run: rechtstexte },
  { id: 'D18', title: 'Lastmessung: ein Turniertag gegen den lokalen Stack', scenarios: ['@FT-002'], owner: '11b (FT-Messlauf)', expectedFail: true, run: lastmessung },
];
