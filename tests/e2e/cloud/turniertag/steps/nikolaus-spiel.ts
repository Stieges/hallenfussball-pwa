/**
 * N3 und N4: Spiel 1 des Nikolaus-Turniers am Handy (Meilenstein M-S, Prüfschritte 2 und 3). Die Turnierleitung pfeift Spiel 1 früher
 * an als geplant (16:30), Zuschauer-Seite und Hallenmonitor liegen vorher offen (kein Neuladen); danach trägt sie Tor mit Nummer,
 * Foul, Gelbe Karte, Zeitstrafe und zweite Gelbe Karte (Gelb-Rot) ein. Die Spielzeit von 9 Minuten belegt N3b an der Restzeit. Den Abpfiff
 * löst N4g als Aufbau über die Turnierleitungs-RPC aus (ein Abpfiff von Hand auf dem Server, nicht der Ablauf der 9 Minuten) und prüft dann den Endstand.
 * Die Schritte laufen nacheinander auf Spiel 1, sind aber einzeln lauffähig: jeder öffnet seine Seiten selbst (Playwright startet nach
 * einem fehlgeschlagenen Schritt, auch einem erwartet roten, einen neuen Worker; Modulzustand würde dabei verloren gehen).
 */
import { expect, test, type Browser, type Page } from '@playwright/test';
import { expectEngineMatchRunningUi, fetchEngineRows, openCockpit } from '../../engineHelpers';
import { tippeKarte, wartePicker } from '../../../helpers/cockpitNeu';
import { appendOwner, finishingEvents } from './playViaRpc';
import { DEFAULT_MATCH_COCKPIT_SETTINGS } from '../../../../../src/types/tournament';
import { expectPageAnchor, getRows, vorbedingung } from './shared';
import { ergebnisEreignisse, fetchNikolausSpiele, handyKontext, ladeSpielplan, NIKOLAUS, spielnummer, type NikolausMatch } from './nikolaus-shared';
import type { StepContext, TurniertagStep } from './types';

/** Öffnet das Cockpit von Spiel 1 am Handy der Turnierleitung (Olli leitet das Spiel selbst). */
async function oeffneHandy(browser: Browser, spiel: NikolausMatch): Promise<Page> {
  const { page } = await handyKontext(browser, 'owner');
  await openCockpit(page, NIKOLAUS.tournamentId, spiel.id);
  await expectPageAnchor(page.getByTestId('team-name-home'), 'Cockpit von Spiel 1');
  return page;
}

/** Zuschauer-Seite am Handy (anonym). */
async function oeffneZuschauer(browser: Browser): Promise<Page> {
  const kontext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await kontext.addInitScript(() => window.localStorage.setItem('app:consent', JSON.stringify({ errorTracking: true, sessionReplay: false, timestamp: Date.now(), version: 1 })));
  const seite = await kontext.newPage();
  await seite.goto(`/#/live/${NIKOLAUS.shareCode}`);
  await expectPageAnchor(seite.getByRole('heading', { level: 1 }).first(), 'Zuschauer-Seite');
  return seite;
}

/** Hallenmonitor am Fernseher (anonym, Live-Folie von Feld 1). */
async function oeffneMonitor(browser: Browser): Promise<Page> {
  const kontext = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const seite = await kontext.newPage();
  await seite.goto(`/#/display/${NIKOLAUS.tournamentId}/${NIKOLAUS.monitorId}`);
  return seite;
}

const uhrzeit = (iso: string): string => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

async function spiel1(): Promise<NikolausMatch> {
  const { spiele } = await ladeSpielplan();
  return spiele[0];
}

/**
 * N3a: Spiel 1 steht bereit, Anstoß 16:30; der Anstoß liegt in der Zukunft, also steht dort nichts von „überfällig“ (@SL-118). Die Spielnummern stimmen überall
 * (C-SPIELNUMMER-FEHLT, @SL-049, @ZM-007): die Datenbank trägt die Spiele in Spielplan-Reihenfolge als Spiel 1 bis Spiel 15 (nicht „3 … 15, 1, 2“), das Cockpit
 * der Turnierleitung nennt nach Spiel 1 in der Zeile „Nächstes“ „Spiel 2“ mit seiner Paarung (die Spielauswahl gibt es nicht mehr, C-COCKPIT-SPIELAUSWAHL),
 * und die Zuschauer-Seite trägt Spiel 1 als „Spiel 1:“ und Spiel 2 als „Spiel 2:“ (nicht „Spiel 9“).
 */
async function bereitNichtUeberfaellig({ asRole, browser }: StepContext): Promise<void> {
  const { spiele, namen } = await vorbedingung('Spielplan des Nikolaus-Turniers laden', ladeSpielplan);
  const handy = await oeffneHandy(browser, spiele[0]);
  await expect(handy.getByTestId('scoreboard'), 'Anstoß 16:30 steht in der Tafel').toContainText('16:30');
  await expect(handy.getByTestId('scoreboard'), 'der Anstoß liegt noch in der Zukunft: nichts ist überfällig').not.toContainText(/überfällig/);

  const leitung = await asRole('owner');
  await openCockpit(leitung, NIKOLAUS.tournamentId, spiele[0].id);
  await expectPageAnchor(leitung.getByTestId('team-name-home'), 'Cockpit von Spiel 1 (Turnierleitung)');
  // Reihenfolge aller Nummern aus der Datenbank (Spielplan-Reihenfolge, lückenlos), im Cockpit die Nummer des nächsten Spiels
  expect(spiele.map((spiel) => spielnummer(spiel)), 'Spielnummern 1 bis 15 in Spielplan-Reihenfolge').toEqual(spiele.map((_, index) => index + 1));
  const naechstes = leitung.getByTestId('cockpit-naechstes');
  await expect(naechstes, 'Cockpit: nach Spiel 1 folgt „Spiel 2“ (nicht „Spiel 10“)').toContainText(/Spiel 2(?!\d)/);
  await expect(naechstes, 'Cockpit: „Nächstes“ nennt die Paarung von Spiel 2').toContainText(namen.get(spiele[1].team_a_id) ?? '?');
  await expect(naechstes).toContainText(namen.get(spiele[1].team_b_id) ?? '?');

  const zuschauer = await oeffneZuschauer(browser);
  await expect(zeileSpiel1(zuschauer), 'Zuschauer-Seite: Spiel 1 heißt „Spiel 1:“').toBeVisible({ timeout: 10000 });
  await expect(zeileSpiel2(zuschauer), 'Zuschauer-Seite: Spiel 2 heißt „Spiel 2:“').toBeVisible({ timeout: 10000 });
}

/**
 * N3b: Spiel 1 früher als 16:30 anpfeifen: es läuft ab dem Anpfiff, ohne Rückfrage, 9 Minuten Spielzeit (@ZP-008); der Hallenmonitor, schon vorher
 * offen, zeigt es ohne Neuladen innerhalb von 10 Sekunden als live, Spiel 2 bleibt 16:40 (@ZP-092). Die Zuschauer-Seite prüft N3c.
 */
async function frueherAnpfiff({ browser }: StepContext): Promise<void> {
  const spiel = await spiel1();
  const handy = await oeffneHandy(browser, spiel);
  const monitor = await oeffneMonitor(browser);
  // Ohne laufendes Spiel zeigt der Monitor die Zuschauer-QR-Folie (@OB-011), die Live-Folie wartet auf den Anpfiff.
  await expectPageAnchor(monitor.getByText('Ergebnisse aufs Handy'), 'Hallenmonitor (Zuschauer-QR-Folie vor dem Anpfiff)');
  const vorher = Date.now();
  await handy.getByTestId('match-start-button').click();
  const klick = Date.now();
  await expectEngineMatchRunningUi(handy);
  await expect(handy.getByRole('alertdialog'), 'beim Anpfiff gibt es keine Rückfrage').toHaveCount(0);
  await expect(handy.getByRole('dialog'), 'beim Anpfiff gibt es keine Rückfrage').toHaveCount(0);
  await expect.poll(async () => (await fetchEngineRows(spiel.id)).map((r) => r.type), { timeout: 10000 }).toEqual(['MATCH_START']);
  const start = Date.parse((await fetchEngineRows(spiel.id))[0].client_time ?? '');
  expect(Math.abs(start - vorher), 'das Spiel läuft ab dem Anpfiff, nicht ab 16:30').toBeLessThan(15000);
  await expect(handy.getByTestId('scoreboard-clock-rest'), 'Spielzeit 9 Minuten in einem Abschnitt').toHaveText(/^8:\d\d$/);
  // @ZP-092: der Monitor, schon vorher offen, zeigt Spiel 1 ohne Neuladen innerhalb von 10 Sekunden als live mit laufender Uhr
  await expect(monitor.locator('body'), 'Hallenmonitor: Spiel 1 ist live').toContainText(/Live\s*Feld 1\s*—\s*Spiel 1[\s\S]*TSV Waging rot/, { timeout: Math.max(1000, 10000 - (Date.now() - klick)) });
  test.info().annotations.push({ type: 'Monitor live nach (ms)', description: String(Date.now() - klick) });
  await expect(monitor.locator('body'), 'Hallenmonitor: die Uhr läuft').toContainText(/0[0-8]:\d\d/);
  expect((await fetchNikolausSpiele())[1].scheduled_start, 'Spiel 2 steht weiter um 16:40').toBe('16:40:00');
}

/** Zeile von Spiel 1 auf der Zuschauer-Seite: Beschriftung „Spiel 1: …“ (@ZM-007, @SL-049). */
const zeileSpiel1 = (seite: Page) => seite.locator('[aria-label="Spiel 1: TSV Waging rot gegen TSV 1921 Fridolfing"]:visible');
/** Zeile von Spiel 2: „Spiel 2: …“. */
const zeileSpiel2 = (seite: Page) => seite.locator('[aria-label="Spiel 2: DJK Otting gegen TSV Waging blau"]:visible');

/** Tatsächliche Anpfiffzeit von Spiel 1 (Ortszeit, HH:MM) aus der Datenbank. */
async function anpfiffzeit(): Promise<string> {
  const spiel = (await fetchNikolausSpiele())[0];
  expect(spiel.actual_start, 'Spiel 1 ist angepfiffen (N3b gelaufen)').toBeTruthy();
  return uhrzeit(spiel.actual_start ?? '');
}

/** N3c: Zuschauer-Seite und Hallenmonitor zeigen bei Spiel 1 „Live“ und die tatsächliche Anpfiffzeit („angepfiffen HH:MM“), nicht „ursprünglich“; Spiel 2 bleibt 16:40 (@ZP-051, @ZP-092). */
async function anpfiffzeitAnzeige({ browser }: StepContext): Promise<void> {
  const echt = await vorbedingung('Spiel 1 ist angepfiffen (N3b)', anpfiffzeit);
  const zuschauer = await oeffneZuschauer(browser);
  await expectPageAnchor(zeileSpiel1(zuschauer), 'Zeile von Spiel 1 auf der Zuschauer-Seite');
  await expect(zeileSpiel1(zuschauer), 'Zuschauer-Seite: Spiel 1 ist live').toContainText(/live/i, { timeout: 5000 });
  await expect(zeileSpiel1(zuschauer), `Zuschauer-Seite: bei Spiel 1 steht die Anpfiffzeit ${echt}`).toContainText(`angepfiffen ${echt}`, { timeout: 5000 });
  await expect(zeileSpiel1(zuschauer)).not.toContainText(/ursprünglich/);
  await expect(zeileSpiel2(zuschauer)).toContainText('16:40');
  await expect(zeileSpiel2(zuschauer)).not.toContainText(/ursprünglich/);
  const monitor = await oeffneMonitor(browser);
  await expect(monitor.locator('body'), `Hallenmonitor: angepfiffen ${echt}`).toContainText(`angepfiffen ${echt}`, { timeout: 5000 });
}

/** Ereignisarten in Annahme-Reihenfolge ohne den Anpfiff. */
const ereignisse = async (spiel: NikolausMatch): Promise<string[]> => (await fetchEngineRows(spiel.id)).map((r) => r.type).filter((typ) => typ !== 'AMEND').slice(1);

/** Öffnet das laufende Spiel 1 (nach N3b) im Cockpit am Handy und prüft, dass es läuft. */
async function laufendesSpiel({ browser }: StepContext): Promise<{ spiel: NikolausMatch; handy: Page }> {
  const spiel = await spiel1();
  const handy = await oeffneHandy(browser, spiel);
  await expectEngineMatchRunningUi(handy);
  return { spiel, handy };
}

/** N4a: Tor mit Rückennummer zählt mit dem ersten Tipp und trägt die Nummer (@SL-019). */
async function torMitNummer(ctx: StepContext): Promise<void> {
  const { spiel, handy } = await laufendesSpiel(ctx);
  await handy.getByTestId('goal-button-home').click();
  await expect(handy.getByTestId('scoreboard-box-links')).toHaveText('1');
  await wartePicker(handy);
  await handy.getByTestId('number-picker').getByRole('button', { name: '7', exact: true }).click();
  await expect(handy.getByTestId('number-picker')).toBeHidden();
  await expect(handy.getByTestId('scoreboard-box-links')).toHaveText('1');
  await expect(handy.getByTestId('scoreboard-box-rechts')).toHaveText('0');
  await expect.poll(() => ereignisse(spiel), { timeout: 10000 }).toEqual(['GOAL']);
  // Die Nummer kommt als Nachtrag (AMEND) zum Tor (@SL-019: das Tor zählt mit dem ersten Tipp).
  await expect.poll(async () => JSON.stringify((await fetchEngineRows(spiel.id)).filter((r) => r.type === 'AMEND').map((r) => r.payload)), { timeout: 10000, message: 'der Nachtrag trägt die Rückennummer 7' }).toMatch(/7/);
}

/** N4b: Foul für das Gastteam zählt gegen die Grenze von 5 (@SL-033). */
async function foul(ctx: StepContext): Promise<void> {
  const { spiel, handy } = await laufendesSpiel(ctx);
  await expect(handy.getByTestId('team-fouls-away')).toHaveText('Foul 0/5');
  await handy.getByTestId('foul-button-away').click();
  await expect(handy.getByTestId('team-fouls-away')).toHaveText('Foul 1/5');
  await expect(handy.getByTestId('team-fouls-home')).toHaveText('Foul 0/5');
  await expect.poll(() => ereignisse(spiel), { timeout: 10000 }).toEqual(['GOAL', 'FOUL']);
}

/** N4c: eine Gelbe Karte (Nr. 5, Gast) zählt als Foul (@SL-023). */
async function gelbeKarte(ctx: StepContext): Promise<void> {
  const { spiel, handy } = await laufendesSpiel(ctx);
  await tippeKarte(handy, 'away', 'Gelb', 5);
  await expect(handy.getByTestId('team-fouls-away')).toHaveText('Foul 2/5');
  await expect.poll(() => ereignisse(spiel), { timeout: 10000 }).toEqual(['GOAL', 'FOUL', 'YELLOW_CARD']);
}

/** Restzeit der Zeitstrafe (Nr. 9) in Sekunden aus der Spalte des Heimteams, `null` solange sie nicht steht. */
async function strafRestzeit(handy: Page): Promise<number | null> {
  const text = await handy.getByTestId('team-column-home').getByText(/^Nr\. 9 · \d+:\d{2}$/).textContent({ timeout: 3000 }).catch(() => null);
  const treffer = /(\d+):(\d{2})$/.exec(text ?? '');
  return treffer ? Number(treffer[1]) * 60 + Number(treffer[2]) : null;
}

/** N4d: Zeitstrafe (Nr. 9, Heim) ohne Dauer-Auswahl: die Restzeit beginnt bei der Dauer aus den Turnierregeln (2:00) und zählt mit der Spieluhr herunter (@SL-029). */
async function zeitstrafe(ctx: StepContext): Promise<void> {
  const { spiel, handy } = await laufendesSpiel(ctx);
  const dauer = DEFAULT_MATCH_COCKPIT_SETTINGS.timePenaltyDurationSeconds;
  await handy.getByTestId('penalty-button-home').click();
  await wartePicker(handy);
  await handy.getByTestId('number-picker').getByRole('button', { name: '9', exact: true }).click();
  await expect(handy.getByTestId('number-picker')).toBeHidden();
  await expect.poll(() => strafRestzeit(handy), { message: 'Restzeit der Zeitstrafe in der Spalte', timeout: 5000 }).not.toBeNull();
  const erste = (await strafRestzeit(handy)) ?? 0;
  expect(erste, `die Restzeit beginnt bei der Dauer aus den Turnierregeln (${dauer} s)`).toBeLessThanOrEqual(dauer);
  expect(erste, 'die Restzeit ist frisch (höchstens 30 s nach dem Eintrag)').toBeGreaterThan(dauer - 30);
  await expect.poll(async () => (await strafRestzeit(handy)) ?? Number.POSITIVE_INFINITY, { message: 'die Restzeit zählt herunter', timeout: 10000 }).toBeLessThan(erste);
  await expect.poll(() => ereignisse(spiel), { timeout: 10000 }).toEqual(['GOAL', 'FOUL', 'YELLOW_CARD', 'TIME_PENALTY']);
}

/** N4e: eine zweite Gelbe Karte für Nr. 5: das Cockpit weist darauf hin und bietet Gelb-Rot an (@SL-088). */
async function gelbRot(ctx: StepContext): Promise<void> {
  const { spiel, handy } = await laufendesSpiel(ctx);
  await handy.getByTestId('card-button-away').click();
  await handy.getByTestId('card-kind-step').getByRole('button', { name: 'Gelb', exact: true }).click();
  await wartePicker(handy);
  await handy.getByTestId('number-picker').getByRole('button', { name: '5', exact: true }).click();
  const frage = handy.getByTestId('second-yellow-question');
  await expect(frage, 'das Cockpit weist darauf hin, dass Nr. 5 schon Gelb hat').toContainText(/5/);
  await frage.getByRole('button', { name: /Gelb-Rot/ }).click();
  await expect.poll(() => ereignisse(spiel), { timeout: 10000 }).toEqual(['GOAL', 'FOUL', 'YELLOW_CARD', 'TIME_PENALTY', 'YELLOW_RED_CARD']);
}

/**
 * N4g: nach dem Abpfiff zeigt das Cockpit 30 Sekunden lang den Endstand mit den Einträgen des Spiels, mit „Weiter“ und ohne Taste zum Bestätigen (@SL-048).
 * Aufbau (Vorbedingung): Spiel 1 wird über die Turnierleitungs-RPC beendet. Das ist ein Abpfiff von Hand auf dem Server (Spieluhr ca. 1 Minute),
 * nicht der Ablauf der 9 Minuten: @SL-009 belegt `tests/e2e/flows/cockpit-halbzeit.spec.ts` mit echtem Ablauf, dieser Schritt behauptet es nicht.
 */
async function endstandQuittung({ browser }: StepContext): Promise<void> {
  const spiel = await spiel1();
  const handy = await vorbedingung('Spiel 1 über die RPC abpfeifen, Cockpit zeigt „Ende“ 1:0 (@SL-152, @OB-066)', async () => {
    const ende = finishingEvents(await fetchEngineRows(spiel.id), ergebnisEreignisse(spiel, 0, 0));
    expect((await appendOwner(spiel.id, ende)).results.map((r) => r.status), 'Abpfiff angenommen').toEqual(ende.map(() => 'accepted'));
    await expect.poll(async () => (await getRows<{ match_status: string; score_a: number; score_b: number }>(`matches?id=eq.${spiel.id}&select=match_status,score_a,score_b`, 'Spiel 1'))[0], { timeout: 10000 }).toEqual({ match_status: 'finished', score_a: 1, score_b: 0 });
    const seite = await oeffneHandy(browser, spiel);
    await expect(seite.getByTestId('scoreboard-state')).toHaveText('Ende', { timeout: 10000 });
    await expect(seite.getByTestId('scoreboard-box-links')).toHaveText('1');
    await expect(seite.getByTestId('scoreboard-box-rechts')).toHaveText('0');
    return seite;
  });
  await expect(handy.getByRole('button', { name: /Weiter/ }), 'Taste „Weiter“').toBeVisible({ timeout: 3000 });
  await expect(handy.getByRole('button', { name: /bestätigen/i }), 'keine Taste zum Bestätigen').toHaveCount(0);
  await expect(handy.locator('body'), 'Einträge des Spiels: Tor Nr. 7, Gelbe Karte, Zeitstrafe, Gelb-Rot').toContainText(/Nr\. 7/, { timeout: 3000 });
}

export const steps: readonly TurniertagStep[] = [
  { id: 'N3a', title: 'Spiel 1 steht bereit: Anstoß 16:30, nichts überfällig, Spielnummern im Cockpit („Nächstes“) und auf der Zuschauer-Seite', scenarios: ['@SL-118', '@SL-049', '@ZM-007'], owner: 'Anstoßzeit mit Datum im Cockpit (gebaut, #295)', expectedFail: false, run: bereitNichtUeberfaellig },
  { id: 'N3b', title: 'Früher Anpfiff: Spiel 1 läuft ab dem Anpfiff, ohne Rückfrage, Monitor live ohne Neuladen', scenarios: ['@ZP-008', '@ZP-092'], owner: 'B-11 / B-15 (gebaut)', expectedFail: false, run: frueherAnpfiff },
  { id: 'N3c', title: 'Zuschauer-Seite und Monitor zeigen „live“ und die tatsächliche Anpfiffzeit', scenarios: ['@ZP-051', '@ZP-092'], owner: 'B-27', expectedFail: true, run: anpfiffzeitAnzeige },
  { id: 'N4a', title: 'Spiel 1: Tor mit Rückennummer', scenarios: ['@SL-019'], owner: 'B-11 (gebaut)', expectedFail: false, run: torMitNummer },
  { id: 'N4b', title: 'Spiel 1: Foul zählt gegen die Grenze', scenarios: ['@SL-033'], owner: 'B-10b (gebaut)', expectedFail: false, run: foul },
  { id: 'N4c', title: 'Spiel 1: Gelbe Karte zählt als Foul', scenarios: ['@SL-023'], owner: 'B-10b (gebaut)', expectedFail: false, run: gelbeKarte },
  { id: 'N4d', title: 'Spiel 1: Zeitstrafe mit Dauer aus den Regeln, Restzeit zählt herunter', scenarios: ['@SL-029'], owner: 'B-10b (gebaut)', expectedFail: false, run: zeitstrafe },
  { id: 'N4e', title: 'Spiel 1: zweite Gelbe Karte bietet Gelb-Rot an', scenarios: ['@SL-088'], owner: 'B-10b (gebaut)', expectedFail: false, run: gelbRot },
  { id: 'N4g', title: 'Spiel 1: nach dem Abpfiff Endstand 30 Sekunden mit Einträgen und „Weiter“, ohne Bestätigen', scenarios: ['@SL-048'], owner: 'B-10a2', expectedFail: true, run: endstandQuittung },
];
