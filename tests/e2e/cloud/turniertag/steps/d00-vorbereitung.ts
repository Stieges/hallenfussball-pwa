/**
 * D0a-D0e und D16: die Vorbereitung VOR dem Turniertag (Plan "Turnier durchspielbar" (b), Paket DV). Alle Schritte außer D0b sind
 * `expectedFail`: jeder prüft einen Soll-Marker, den der genannte Besitzer erst baut (Regel T3: der Schritt wird grün in dem
 * Paket, das ihn liefert). Die Marker (`data-testid`) präzisiert der Besitzer beim Bauen.
 * ACHTUNG: Nur D0a und D0c prüfen in Teilen schon heute eine fachliche Wirkung; bei D0d, D0e und D16 ist es nur der Marker. D0b ist gebaut (#296) und läuft grün.
 * Der Besitzer MUSS beim Bauen die Wirkung ergänzen (Regel T3), sonst macht ein fremdes Element den Schritt grün.
 */
import { expect, type Locator, type Page } from '@playwright/test';
import { newRoleContext, openCockpit } from '../../engineHelpers';
import { expectPageAnchor, expectSollMarker, fetchTurniertagBracket, getRows, openTurniertagPath, SOLL_TIMEOUT_MS, TURNIERTAG_ID, vorbedingung } from './shared';
import { legeKopieMitDatumAn, momentaufnahme } from './wegwerfKopie';
import type { StepContext, TurniertagStep } from './types';

/** D0a: Wizard (5 Schritte) legt ein Turnier mit eigener Halbfinal-Regel an; die Halbfinals tragen ihre Phase aus dem Generator. */
async function wizardAnlegen({ asRole }: StepContext): Promise<void> {
  const ownerPage = await asRole('owner');
  await ownerPage.goto('/#/tournament/new');
  await ownerPage.waitForLoadState('networkidle');
  await expectPageAnchor(ownerPage.locator('[aria-current="step"]').first(), 'Wizard-Schrittleiste');
  await expectSollMarker(ownerPage, 'wizard-playoff-decision-rule');
  // Wirkung (Cloud): Halbfinals sind als Halbfinale gespeichert, nicht als "final" (C-FINALPHASE-AUS-ID).
  const { finals } = await fetchTurniertagBracket();
  const halbfinals = finals.filter((m) => (m.label ?? '').includes('Halbfinale'));
  expect(halbfinals).toHaveLength(2);
  expect(halbfinals.map((m) => m.phase)).not.toContain('final');
}

/** `tage` Kalendertage vor `tag` (beide `JJJJ-MM-TT`, Kalenderrechnung ohne Zeitzone). */
function tageVor(tag: string, tage: number): string {
  const rechnung = new Date(`${tag}T00:00:00Z`);
  rechnung.setUTCDate(rechnung.getUTCDate() - tage);
  return rechnung.toISOString().slice(0, 10);
}

/**
 * Das Cockpit von Spiel 1 der Kopie auf EINEM Gerät: mit der Uhr 10 Minuten nach dem Anstoß steht dort „überfällig 10 Min“ (@OB-068), 10 Minuten
 * vorher nichts von „überfällig“ (@W5-029). Der Anstoß ist das Datum der Kopie plus die Uhrzeit des Originals. Die Uhr steht fest in der Vergangenheit
 * (Datum der Kopie liegt vor dem heutigen Tag): so bleibt die Anmeldung des Geräts gültig.
 */
async function pruefeUeberfaelligkeit(seite: Page, kopieId: string, spielId: string, anstoss: Date, uhrzeit: string, geraet: string): Promise<void> {
  /** Cockpit von Spiel 1 zur festen Uhrzeit öffnen. Über die Startseite hinein, ohne Neuladen: die Tafel rechnet beim Öffnen neu (Single-Page-App). */
  const tafelZu = async (jetzt: Date): Promise<Locator> => {
    await seite.clock.setFixedTime(jetzt);
    await seite.goto('/#/');
    await openCockpit(seite, kopieId, spielId);
    await expectPageAnchor(seite.getByTestId('team-name-home'), `Cockpit von Spiel 1 der Kopie (${geraet})`);
    const tafel = seite.getByTestId('scoreboard');
    await expect(tafel, `${geraet}: Spiel 1 der Kopie steht um ${uhrzeit}`).toContainText(uhrzeit);
    return tafel;
  };
  const vorher = await tafelZu(new Date(anstoss.getTime() - 10 * 60_000));
  await expect(vorher, `${geraet}: 10 Minuten vor dem Anstoß ist Spiel 1 nicht überfällig`).not.toContainText(/überfällig/, { timeout: 5000 });
  const nachher = await tafelZu(new Date(anstoss.getTime() + 10 * 60_000));
  await expect(nachher, `${geraet}: 10 Minuten nach dem Anstoß am Datum der Kopie ist Spiel 1 „überfällig 10 Min“`).toContainText('überfällig 10 Min', { timeout: 10000 });
}

/**
 * D0b: Kopie fürs Proben: Olli kopiert den Turniertag-Cup mit einem früheren Datum X. Spiel 1 der Kopie steht auf jedem Gerät am Datum X zur Uhrzeit des
 * Originals, auch auf Ollis Gerät, auf dem er kopiert hat (ohne Neuladen), und auf einem zweiten Gerät, das die Kopie neu aus der Cloud lädt (@W5-029).
 * @W5-029 nennt „Toms Cockpit“; geprüft wird mit zwei Geräten der Turnierleitung (Helfer gehören nicht zur Kopie, @W5-026). Die Ursache des Befunds
 * (Anstoß aus altem Datum) ist damit abgedeckt: sie hängt am Gerät, das kopiert hat, und am Laden aus der Cloud, nicht an der Rolle.
 * Das Original bleibt unverändert. Die übrigen Eigenschaften der Kopie (leer, ohne Freigabe, archivieren) belegt `kopie-proben.cloud.spec.ts` (@W5-024 bis @W5-027).
 */
async function kopieFuersProben({ browser }: StepContext): Promise<void> {
  const ausgang = await vorbedingung('Original lesen: Datum und Anstoß von Spiel 1', async () => {
    const [turnier] = await getRows<{ date: string }>(`tournaments?id=eq.${TURNIERTAG_ID}&select=date`, 'Datum des Originals');
    const [spiel1] = await getRows<{ scheduled_start: string | null }>(`matches?tournament_id=eq.${TURNIERTAG_ID}&match_number=eq.1&select=scheduled_start`, 'Spiel 1 des Originals');
    expect(spiel1?.scheduled_start, 'Spiel 1 des Originals hat eine Anstoßzeit').toMatch(/^\d{2}:\d{2}:\d{2}$/);
    return { datumOriginal: turnier.date.slice(0, 10), anstossOriginal: spiel1.scheduled_start ?? '', vorher: await momentaufnahme() };
  });
  const datumKopie = tageVor(ausgang.datumOriginal, 2);
  const kopie = await vorbedingung('Kopie fürs Proben mit früherem Datum anlegen', () => legeKopieMitDatumAn(browser, 'D0b', datumKopie));
  let zweitesGeraet: Awaited<ReturnType<typeof newRoleContext>> | undefined;
  try {
    zweitesGeraet = await newRoleContext(browser, 'owner');
    const [kopf] = await getRows<{ date: string }>(`tournaments?id=eq.${kopie.id}&select=date`, 'Datum der Kopie');
    expect(kopf.date.slice(0, 10), 'die Kopie trägt das Datum aus dem Dialog').toBe(datumKopie);
    const [spiel1] = await getRows<{ id: string; scheduled_start: string }>(`matches?tournament_id=eq.${kopie.id}&match_number=eq.1&select=id,scheduled_start`, 'Spiel 1 der Kopie');
    expect(spiel1.scheduled_start, 'Spiel 1 der Kopie hat die Uhrzeit des Originals').toBe(ausgang.anstossOriginal);
    const anstoss = new Date(`${datumKopie}T${ausgang.anstossOriginal}`);
    const uhrzeit = ausgang.anstossOriginal.slice(0, 5);
    await pruefeUeberfaelligkeit(kopie.page, kopie.id, spiel1.id, anstoss, uhrzeit, 'Ollis Gerät, auf dem er kopiert hat');
    await pruefeUeberfaelligkeit(zweitesGeraet.page, kopie.id, spiel1.id, anstoss, uhrzeit, 'zweites Gerät, neu aus der Cloud geladen');
    expect(await momentaufnahme(), 'das Original ist nach dem Kopieren unverändert').toBe(ausgang.vorher);
  } finally {
    await zweitesGeraet?.context.close();
    await kopie.entfernen();
  }
}

/** D0c: Anmelden am Turniertag: kein Registrieren, ehrliche Hinweise, bei langsamem Netz keine stille Abmeldung. */
async function anmeldenTurniertag({ anonPage }: StepContext): Promise<void> {
  await anonPage.goto('/#/login');
  await expectPageAnchor(anonPage.locator('input[type="email"]').first(), 'Anmeldeseite');
  // @AN-005 / @AN-015: die Anmeldeseite bietet kein Registrieren und nur Wege an, die es gibt.
  await expect(anonPage.getByRole('link', { name: /registrieren/i }), 'kein Registrieren-Link').toHaveCount(0, { timeout: SOLL_TIMEOUT_MS });
  await expect(anonPage.getByRole('button', { name: /passwort vergessen/i }), 'kein "Passwort vergessen" ohne Mailversand (@AN-010)').toHaveCount(0, { timeout: SOLL_TIMEOUT_MS });
  // C-SITZUNG-STILL: langsames Netz beim Start meldet "Sitzung abgelaufen" ehrlich statt still abzumelden.
  await expectSollMarker(anonPage, 'session-expired-notice');
}

/** D0d: Turnier teilen: Aushang (A5-Format) mit QR drucken. */
async function turnierTeilen({ asRole }: StepContext): Promise<void> {
  const ownerPage = await asRole('owner');
  await openTurniertagPath(ownerPage, '/admin/visibility');
  await expectPageAnchor(ownerPage.getByRole('heading', { name: 'Sichtbarkeit' }).first(), 'Admin-Kategorie Sichtbarkeit');
  await expectSollMarker(ownerPage, 'share-poster-print');
}

/** D16: Spielplan auf Anfang setzen / ein Spiel zurücksetzen (@SA-001, @SA-015; Stufe 3). @SA-001 ist der Testabend VOR dem Turnier: der Schritt steht deshalb
 * in der Vorbereitung und gehört auf die Kopie aus D0b (der Besitzer richtet ihn beim Bauen darauf aus); er läuft auf dem noch unbespielten Cup. */
async function aufAnfang({ asRole }: StepContext): Promise<void> {
  const ownerPage = await asRole('owner');
  await openTurniertagPath(ownerPage, '/admin/danger');
  await expectSollMarker(ownerPage, 'schedule-reset-button');
}

/** D0e: Monitor einrichten: Monitor aus der Ferne neu laden, Dauerbetrieb der Live-Folie. */
async function monitorEinrichten({ asRole }: StepContext): Promise<void> {
  const ownerPage = await asRole('owner');
  await openTurniertagPath(ownerPage, '/monitors');
  await expectPageAnchor(ownerPage.getByRole('heading', { level: 2, name: 'Monitore konfigurieren' }), 'Reiter Monitore');
  await expectSollMarker(ownerPage, 'monitor-remote-reload');
}

export const steps: readonly TurniertagStep[] = [
  { id: 'D0a', title: 'Turnier im Wizard anlegen (1 und 2 Gruppen, Halbfinal-Regel, Wertung)', scenarios: ['@TM-004', '@W2A-025'], befunde: ['C-FINALPHASE-AUS-ID'], owner: 'A-12a/b (GA4-Oberfläche)', expectedFail: true, run: wizardAnlegen },
  { id: 'D0b', title: 'Kopie fürs Proben: Spiel 1 steht am Datum der Kopie, auf jedem Gerät', scenarios: ['@W5-029'], owner: 'Anstoß aus Turnierdatum und Uhrzeit (gebaut, #296)', expectedFail: false, run: kopieFuersProben },
  { id: 'D16', title: 'Spielplan auf Anfang setzen, Spiel zurücksetzen (auf der Kopie fürs Proben)', scenarios: ['@SA-001', '@SA-015'], owner: 'A-33/B-36 (Stufe 3)', expectedFail: true, run: aufAnfang },
  { id: 'D0c', title: 'Anmelden am Turniertag: kein Registrieren, ehrliche Hinweise, Sitzung im langsamen Netz', scenarios: ['@AN-005', '@AN-006', '@AN-010', '@AN-015'], befunde: ['C-REG', 'C-SMTP', 'C-SITZUNG-STILL'], owner: 'A-27 / B-30 / B-31', expectedFail: true, run: anmeldenTurniertag },
  { id: 'D0d', title: 'Turnier teilen: Aushang mit QR drucken', scenarios: ['@BM-001'], owner: 'A-36d / C9-C11', expectedFail: true, run: turnierTeilen },
  { id: 'D0e', title: 'Monitor einrichten: aus der Ferne neu laden', scenarios: ['@ME-028'], owner: 'MS3 / B-18 / B-48b/c', expectedFail: true, run: monitorEinrichten },
];
