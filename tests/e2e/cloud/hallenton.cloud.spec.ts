/**
 * tests/e2e/cloud/hallenton.cloud.spec.ts -- Hallenton Ende-zu-Ende gegen den lokalen Stack mit zwei Geräten (H4-14, Plan H4).
 * Erwartungen wörtlich aus docs/anforderungen/2026-10-15_hallenton.md (Szenarien @HT-001 … @HT-059).
 *
 * Gerät A = leitende Person (Cockpit und Verwaltung), Gerät B = Rechner der Turnierleitung als Hallen-Lautsprecher: zwei Browser-Kontexte
 * mit je eigener Geräte-ID. Der Ton wird beobachtet (Spion auf `AudioBufferSourceNode.prototype.start`, `hallentonHelfer.ts`), nicht gehört.
 * Jeder Fall legt seine eigene Kopie des Freigabe-Cup an (`cloneReleaseCup`) und löscht sie im `finally`. Nur cloud-desktop.
 */
import { test, expect } from './fixtures';
import { addMember, cloneReleaseCup, deleteCup } from './coadminEinsatz';
import { expectEngineMatchRunningUi, fetchUserIdByEmail, openCockpit } from './engineHelpers';
import { safeCleanup } from './helpers';
import { E2E_USERS } from './testData';
import { abpfiffHalten } from '../helpers/abpfiff';
import { neuLaden } from '../helpers/neuLaden';
import {
  aktiviereTon, beobachteKeinenWeiterenTon, bleibtText, entferneAusgang, installiereAusgangAttrappe, neuesGeraet, sinkAufrufe, steckeAusgangAn, stelleUhrVor, installiereTonSpion, klingtUm, oeffneVerwaltung, richteLautsprecherEin, tonBeginne, warteAufEndeAmServer, warteAufToene,
} from './hallentonHelfer';

const LAUTSPRECHER = 'Rechner der Turnierleitung';

test.describe('Hallenton (zwei Geräte, lokaler Stack)', () => {
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!testInfo.project.name.includes('desktop'), 'Eigene Turnierkopie je Fall, nur auf cloud-desktop.');
  });

  test('@HT-001 @HT-002 B wird Hallen-Lautsprecher für Feld 1: B und die Verwaltung auf A zeigen „bereit“', async ({ browser }) => {
    test.setTimeout(120_000);
    const cup = await cloneReleaseCup('ht1', { withCoAdmin: false });
    const a = await neuesGeraet(browser, 'owner');
    const b = await neuesGeraet(browser, 'owner');
    try {
      await richteLautsprecherEin(b.page, cup.id, LAUTSPRECHER);
      await expect(b.page.getByTestId('geraet-banner-bereit')).toContainText('Lautsprecher bereit');
      await expect(b.page.getByTestId('geraet-banner-bereit')).toContainText(`Feld 1 · ${LAUTSPRECHER}`);

      // @HT-001 Kopfzeile: in einem anderen Unterpunkt (ohne neues Laden, der Ton bleibt aktiv) steht „Lautsprecher Feld 1 bereit“
      await b.page.getByRole('button', { name: /Dashboard/ }).first().click();
      await expect(b.page.getByTestId('hallenton-status-zeile')).toContainText('Lautsprecher Feld 1 bereit', { timeout: 20_000 });

      // Verwaltung auf A: „Hallen-Lautsprecher: Rechner der Turnierleitung, bereit“
      await oeffneVerwaltung(a.page, cup.id);
      await expect(a.page.getByTestId('lautsprecher-feld-1-zustand')).toHaveText('bereit', { timeout: 30_000 });
      await expect(a.page.getByTestId('lautsprecher-feld-1-geraet')).toContainText(`Hallen-Lautsprecher: ${LAUTSPRECHER}`);
    } finally {
      await a.context.close();
      await b.context.close();
      await safeCleanup('HT1 Kopie löschen', () => deleteCup(cup.id));
    }
  });

  test('@HT-003 @HT-008 A beendet das Spiel: B spielt genau einen Ton, höchstens ~1 s nach dem Ende am Server; ein zweites Cockpit erzeugt keinen zweiten', async ({ browser }) => {
    test.setTimeout(150_000);
    const cup = await cloneReleaseCup('ht2', { withCoAdmin: false });
    const a = await neuesGeraet(browser, 'owner');
    const b = await neuesGeraet(browser, 'owner');
    const zweites = await neuesGeraet(browser, 'owner');
    try {
      await installiereTonSpion(b.context);
      await richteLautsprecherEin(b.page, cup.id, LAUTSPRECHER);
      expect(await tonBeginne(b.page), 'vor dem Ende kein Ton auf B').toHaveLength(0);

      await openCockpit(zweites.page, cup.id, cup.matchId);
      await openCockpit(a.page, cup.id, cup.matchId);
      await a.page.locator('[data-testid="match-start-button"]').click();
      await expectEngineMatchRunningUi(a.page);
      expect(await tonBeginne(b.page), 'der Anpfiff gibt keinen Ton (@HT-003)').toHaveLength(0);

      await abpfiffHalten(a.page);
      const endeAmServer = await warteAufEndeAmServer(cup.matchId);
      await warteAufToene(b.page, 1);
      const toene = await tonBeginne(b.page);
      expect(toene, 'genau ein Ton auf B (@HT-008)').toHaveLength(1);
      const verzoegerung = klingtUm(toene[0]) - endeAmServer;
      test.info().annotations.push({ type: 'hallenton-verzoegerung-ms', description: String(Math.round(verzoegerung)) });
      expect(verzoegerung, `Ton höchstens ~1 s nach dem Ende am Server (gemessen ${Math.round(verzoegerung)} ms)`).toBeLessThanOrEqual(1500);
      await beobachteKeinenWeiterenTon(b.page, 1);
    } finally {
      await a.context.close();
      await b.context.close();
      await zweites.context.close();
      await safeCleanup('HT2 Kopie löschen', () => deleteCup(cup.id));
    }
  });

  test('@HT-015 Ablösen: C übernimmt Feld 1 mit Rückfrage; danach tönt nur C, B zeigt den Hinweis', async ({ browser }) => {
    test.setTimeout(180_000);
    const cup = await cloneReleaseCup('ht3', { withCoAdmin: false });
    const a = await neuesGeraet(browser, 'owner');
    const b = await neuesGeraet(browser, 'owner');
    const c = await neuesGeraet(browser, 'owner');
    try {
      await installiereTonSpion(b.context);
      await installiereTonSpion(c.context);
      await richteLautsprecherEin(b.page, cup.id, LAUTSPRECHER);
      await richteLautsprecherEin(c.page, cup.id, 'Zweiter Rechner', { abloesen: true });

      // Rückfrage nennt das bisherige Gerät, B sagt „von einem anderen Gerät übernommen“
      await expect(b.page.getByTestId('geraet-banner-uebernommen')).toContainText('Feld 1 von einem anderen Gerät übernommen', { timeout: 30_000 });

      await openCockpit(a.page, cup.id, cup.matchId);
      await a.page.locator('[data-testid="match-start-button"]').click();
      await expectEngineMatchRunningUi(a.page);
      await abpfiffHalten(a.page);
      await warteAufToene(c.page, 1);
      expect(await tonBeginne(c.page), 'nur das neue Gerät tönt, genau einmal').toHaveLength(1);
      await beobachteKeinenWeiterenTon(c.page, 1);
      expect(await tonBeginne(b.page), 'das abgelöste Gerät tönt nie').toHaveLength(0);
    } finally {
      await a.context.close();
      await b.context.close();
      await c.context.close();
      await safeCleanup('HT15 Kopie löschen', () => deleteCup(cup.id));
    }
  });

  test('@HT-057 Die Turnierleitung meldet B ab: B zeigt „abgemeldet“ mit „Verstanden“, kein Ton, die Verwaltung zeigt „kein Hallen-Lautsprecher“', async ({ browser }) => {
    test.setTimeout(180_000);
    const cup = await cloneReleaseCup('ht57', { withCoAdmin: false });
    const a = await neuesGeraet(browser, 'owner');
    const b = await neuesGeraet(browser, 'owner');
    try {
      await installiereTonSpion(b.context);
      await richteLautsprecherEin(b.page, cup.id, LAUTSPRECHER);
      await oeffneVerwaltung(a.page, cup.id);
      await expect(a.page.getByTestId('lautsprecher-feld-1-zustand')).toHaveText('bereit', { timeout: 30_000 });

      await a.page.getByTestId('lautsprecher-feld-1-abmelden').click();
      await expect(a.page.getByRole('dialog')).toContainText('abgemeldet werden');
      await a.page.getByTestId('confirm-dialog-confirm').click();
      await expect(a.page.getByTestId('lautsprecher-feld-1-zustand')).toHaveText('kein Hallen-Lautsprecher', { timeout: 30_000 });

      const hinweis = b.page.getByTestId('geraet-banner-abgemeldet');
      await expect(hinweis).toContainText('Die Turnierleitung hat dieses Gerät als Hallen-Lautsprecher für Feld 1 abgemeldet.', { timeout: 30_000 });
      await expect(b.page.getByTestId('geraet-verstanden')).toHaveText('Verstanden');

      // kein Ton mehr für das Feld
      await openCockpit(a.page, cup.id, cup.matchId);
      await a.page.locator('[data-testid="match-start-button"]').click();
      await expectEngineMatchRunningUi(a.page);
      await abpfiffHalten(a.page);
      await warteAufEndeAmServer(cup.matchId);
      await beobachteKeinenWeiterenTon(b.page, 0, 6000);

      await b.page.getByTestId('geraet-verstanden').click();
      await expect(b.page.getByTestId('geraet-banner-abgemeldet')).toHaveCount(0);
    } finally {
      await a.context.close();
      await b.context.close();
      await safeCleanup('HT57 Kopie löschen', () => deleteCup(cup.id));
    }
  });

  test('@HT-022 Ein Helfer sieht den Unterpunkt „Hallenton“ nicht (Menü und direkte Adresse)', async ({ browser }) => {
    test.setTimeout(90_000);
    const cup = await cloneReleaseCup('ht22', { withCoAdmin: false });
    const olli = await neuesGeraet(browser, 'owner');
    const heiko = await neuesGeraet(browser, 'helper');
    try {
      await addMember(cup.id, await fetchUserIdByEmail(E2E_USERS.helper.email), 'collaborator', cup.ownerId);
      // Gegenprobe: die Turnierleitung sieht den Menüpunkt (die Suche greift)
      await olli.page.goto(`/#/tournament/${cup.id}/admin/dashboard`);
      await expect(olli.page.getByRole('button', { name: /Hallenton/ }).first()).toBeVisible({ timeout: 20_000 });

      await heiko.page.goto(`/#/tournament/${cup.id}/admin/hallenton`);
      await expect(heiko.page.getByText('Ändern nur durch die Turnierleitung')).toBeVisible({ timeout: 20_000 });
      await expect(heiko.page.getByTestId('hallenton-seite')).toHaveCount(0);
      await expect(heiko.page.getByTestId('geraet-schalter')).toHaveCount(0);
      await expect(heiko.page.getByRole('button', { name: /Hallenton/ })).toHaveCount(0);
    } finally {
      await olli.context.close();
      await heiko.context.close();
      await safeCleanup('HT22 Kopie löschen', () => deleteCup(cup.id));
    }
  });

  test('@HT-017 „Testton in der Halle“ von A: B spielt, A zeigt die Quittung „gespielt HH:MM“', async ({ browser }) => {
    test.setTimeout(120_000);
    const cup = await cloneReleaseCup('ht17', { withCoAdmin: false });
    const a = await neuesGeraet(browser, 'owner');
    const b = await neuesGeraet(browser, 'owner');
    try {
      await installiereTonSpion(b.context);
      await richteLautsprecherEin(b.page, cup.id, LAUTSPRECHER);
      await oeffneVerwaltung(a.page, cup.id);
      await expect(a.page.getByTestId('lautsprecher-feld-1-zustand')).toHaveText('bereit', { timeout: 30_000 });
      expect(await tonBeginne(b.page)).toHaveLength(0);

      await a.page.getByTestId('testton-halle-1').click();
      await warteAufToene(b.page, 1);
      await expect(a.page.getByTestId('testton-feld-1-ergebnis')).toHaveText(/gespielt \d{2}:\d{2}/, { timeout: 30_000 });
      expect(await tonBeginne(b.page), 'der Testton spielt genau einmal').toHaveLength(1);
      await expect(b.page.getByTestId('ton-aktivieren'), 'B bleibt bereit').toHaveCount(0);
    } finally {
      await a.context.close();
      await b.context.close();
      await safeCleanup('HT17 Kopie löschen', () => deleteCup(cup.id));
    }
  });
});

test.describe('Hallenton Störungen (zwei Geräte, lokaler Stack)', () => {
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!testInfo.project.name.includes('desktop'), 'Eigene Turnierkopie je Fall, nur auf cloud-desktop.');
  });

  test('@HT-039 @HT-040 B nicht bereit: Verwaltung zeigt die Pille, das Cockpit den Kasten mit Grund; wieder bereit: verschwindet', async ({ browser }) => {
    test.setTimeout(180_000);
    const cup = await cloneReleaseCup('ht39', { withCoAdmin: false });
    const a = await neuesGeraet(browser, 'owner');
    const b = await neuesGeraet(browser, 'owner');
    try {
      await richteLautsprecherEin(b.page, cup.id, LAUTSPRECHER);
      await oeffneVerwaltung(a.page, cup.id);
      await expect(a.page.getByTestId('lautsprecher-feld-1-zustand')).toHaveText('bereit', { timeout: 30_000 });

      // „Ton nicht aktiviert“: B lädt neu, der Browser braucht wieder einen Klick
      await neuLaden(b.page);
      await expect(b.page.getByTestId('ton-aktivieren')).toBeVisible({ timeout: 20_000 });
      await expect(a.page.getByTestId('lautsprecher-feld-1-zustand')).toHaveText('nicht bereit – Ton nicht aktiviert', { timeout: 30_000 });
      await a.page.getByRole('button', { name: /Dashboard/ }).first().click();
      await expect(a.page.getByTestId('hallenton-status-zeile')).toContainText('Lautsprecher Feld 1 nicht bereit', { timeout: 30_000 });

      // Cockpit vor dem Anpfiff: Kasten mit Grund
      await openCockpit(a.page, cup.id, cup.matchId);
      const kasten = a.page.getByTestId('cockpit-hall-aus');
      await expect(kasten).toContainText('Hallen-Lautsprecher aus – Ende selbst anzeigen', { timeout: 30_000 });
      await expect(kasten).toContainText('Grund: Ton nicht aktiviert');

      // wieder bereit: der Kasten verschwindet
      await aktiviereTon(b.page);
      await expect(a.page.getByTestId('cockpit-hall-aus')).toHaveCount(0, { timeout: 30_000 });

      // „meldet sich nicht“: B schließt, nach höchstens 15 s steht „meldet sich nicht (zuletzt HH:MM)“
      await b.page.close();
      await expect(a.page.getByTestId('cockpit-hall-aus')).toContainText(/Grund: meldet sich nicht \(zuletzt \d{2}:\d{2}\)/, { timeout: 40_000 });
    } finally {
      await a.context.close();
      await b.context.close();
      await safeCleanup('HT39 Kopie löschen', () => deleteCup(cup.id));
    }
  });

  test('@HT-059 Cockpit: bei „bereit“ keine Statuszeile; bei der Störung des gezeigten Felds der Kasten und keine Pille', async ({ browser }) => {
    test.setTimeout(180_000);
    const cup = await cloneReleaseCup('ht59', { withCoAdmin: false });
    const a = await neuesGeraet(browser, 'owner');
    const verwaltung = await neuesGeraet(browser, 'owner');
    const b = await neuesGeraet(browser, 'owner');
    try {
      await richteLautsprecherEin(b.page, cup.id, LAUTSPRECHER);
      await oeffneVerwaltung(verwaltung.page, cup.id);
      await expect(verwaltung.page.getByTestId('lautsprecher-feld-1-zustand')).toHaveText('bereit', { timeout: 30_000 });
      // Gegenprobe: die Verwaltung zeigt die Zeile (in einem anderen Unterpunkt)
      await verwaltung.page.getByRole('button', { name: /Dashboard/ }).first().click();
      await expect(verwaltung.page.getByTestId('hallenton-status-zeile')).toContainText('Lautsprecher Feld 1 bereit', { timeout: 20_000 });

      await openCockpit(a.page, cup.id, cup.matchId);
      await expect(a.page.locator('[data-testid="goal-button-home"], [data-testid="match-start-button"]').first()).toBeVisible({ timeout: 20_000 });
      await expect(a.page.getByTestId('hallenton-status-zeile'), 'bei „bereit“ keine Statuszeile im Cockpit').toHaveCount(0);

      await neuLaden(b.page);
      await expect(a.page.getByTestId('cockpit-hall-aus')).toContainText('Grund: Ton nicht aktiviert', { timeout: 40_000 });
      await expect(a.page.getByTestId('hallenton-status-zeile'), 'Kasten statt Pille').toHaveCount(0);
    } finally {
      await a.context.close();
      await verwaltung.context.close();
      await b.context.close();
      await safeCleanup('HT59 Kopie löschen', () => deleteCup(cup.id));
    }
  });

  test('@HT-041 Verwaltung ohne Netz: „Status unbekannt“; mit Netz wieder der Stand vom Server', async ({ browser }) => {
    test.setTimeout(180_000);
    const cup = await cloneReleaseCup('ht41', { withCoAdmin: false });
    const a = await neuesGeraet(browser, 'owner');
    const b = await neuesGeraet(browser, 'owner');
    try {
      await richteLautsprecherEin(b.page, cup.id, LAUTSPRECHER);
      await oeffneVerwaltung(a.page, cup.id);
      await expect(a.page.getByTestId('lautsprecher-feld-1-zustand')).toHaveText('bereit', { timeout: 30_000 });
      // beide Unterpunkte einmal online besuchen (ihre Teile sind danach geladen), dann auf der Seite „Hallenton“ das Netz verlieren
      await a.page.getByRole('button', { name: /Dashboard/ }).first().click();
      await expect(a.page.getByTestId('hallenton-status-zeile')).toContainText('Lautsprecher Feld 1 bereit', { timeout: 20_000 });
      await a.page.getByRole('button', { name: /Hallenton/ }).first().click();
      await expect(a.page.getByTestId('lautsprecher-feld-1-zustand')).toHaveText('bereit', { timeout: 30_000 });

      await a.context.setOffline(true);
      await expect(a.page.getByTestId('hallenton-kein-netz')).toContainText('Kein Netz – Status unbekannt', { timeout: 40_000 });
      await expect(a.page.getByTestId('lautsprecher-feld-1-zustand')).toHaveText('Status unbekannt');
      await a.page.getByTestId('testton-halle-1').click();
      await expect(a.page.getByTestId('testton-feld-1-ergebnis')).toContainText('Kein Testton: kein Netz');
      await a.page.getByRole('button', { name: /Dashboard/ }).first().click();
      await expect(a.page.getByTestId('hallenton-status-zeile')).toContainText('Lautsprecher: Status unbekannt', { timeout: 20_000 });

      await a.context.setOffline(false);
      await expect(a.page.getByTestId('hallenton-status-zeile')).toContainText('Lautsprecher Feld 1 bereit', { timeout: 40_000 });
      await a.page.getByRole('button', { name: /Hallenton/ }).first().click();
      await expect(a.page.getByTestId('lautsprecher-feld-1-zustand')).toHaveText('bereit', { timeout: 40_000 });
      await expect(a.page.getByTestId('hallenton-kein-netz')).toHaveCount(0);
    } finally {
      await a.context.setOffline(false).catch(() => undefined);
      await a.context.close();
      await b.context.close();
      await safeCleanup('HT41 Kopie löschen', () => deleteCup(cup.id));
    }
  });

  test('@HT-054 @HT-055 Ausgang verloren: nicht bereit, kein Ton; Rückkehr ohne neue Wahl; nach dem Neuladen „Ausgang bestätigen“ (simuliert)', async ({ browser }) => {
    test.setTimeout(240_000);
    const cup = await cloneReleaseCup('ht54', { withCoAdmin: false });
    const a = await neuesGeraet(browser, 'owner');
    const b = await neuesGeraet(browser, 'owner');
    try {
      await installiereTonSpion(b.context);
      await installiereAusgangAttrappe(b.context);
      await richteLautsprecherEin(b.page, cup.id, LAUTSPRECHER);
      await oeffneVerwaltung(a.page, cup.id);
      await expect(a.page.getByTestId('lautsprecher-feld-1-zustand')).toHaveText('bereit', { timeout: 30_000 });

      // Ausgang wählen: Mikrofon erlauben (simuliert), Dock wählen
      await b.page.getByTestId('ausgang-aendern').click();
      await b.page.getByTestId('mikrofon-erlauben').click();
      await b.page.getByTestId('ausgang-wahl-1').click();
      await expect(b.page.getByTestId('ausgang-name')).toHaveText('Hallenanlage (Dock)');
      await expect(b.page.getByTestId('geraet-banner-bereit')).toBeVisible({ timeout: 20_000 });
      expect(await sinkAufrufe(b.page)).toContain('dock-1');

      // @HT-054: Dock abgezogen
      await entferneAusgang(b.page, 'dock-1');
      await expect(a.page.getByTestId('lautsprecher-feld-1-zustand')).toHaveText('nicht bereit – Ausgang verloren', { timeout: 40_000 });
      await openCockpit(a.page, cup.id, cup.matchId);
      await a.page.locator('[data-testid="match-start-button"]').click();
      await expectEngineMatchRunningUi(a.page);
      await abpfiffHalten(a.page);
      await warteAufEndeAmServer(cup.matchId);
      await beobachteKeinenWeiterenTon(b.page, 0, 6000);
      expect(await sinkAufrufe(b.page), 'kein stiller Wechsel auf „Standard“').not.toContain('');

      // Rückkehr ohne neue Wahl
      await steckeAusgangAn(b.page, 'dock-1', 'Hallenanlage (Dock)');
      await oeffneVerwaltung(a.page, cup.id);
      await expect(a.page.getByTestId('lautsprecher-feld-1-zustand')).toHaveText('bereit', { timeout: 40_000 });

      // @HT-055: nach dem Neuladen ist die Freigabe weg
      await neuLaden(b.page);
      await expect(b.page.getByTestId('ausgang-bestaetigen')).toBeVisible({ timeout: 20_000 });
      await expect(a.page.getByTestId('lautsprecher-feld-1-zustand')).toHaveText('nicht bereit – Ausgang bestätigen', { timeout: 40_000 });
      await b.page.getByTestId('ausgang-bestaetigen-taste').click();
      await expect(a.page.getByTestId('lautsprecher-feld-1-zustand')).toHaveText('bereit', { timeout: 40_000 });
    } finally {
      await a.context.close();
      await b.context.close();
      await safeCleanup('HT54 Kopie löschen', () => deleteCup(cup.id));
    }
  });

  test('@HT-053 Browser ohne setSinkId: nur „Standard“, keine Wahl', async ({ browser }) => {
    test.setTimeout(120_000);
    const cup = await cloneReleaseCup('ht53', { withCoAdmin: false });
    const b = await neuesGeraet(browser, 'owner');
    try {
      await installiereAusgangAttrappe(b.context, { setSinkId: false });
      await richteLautsprecherEin(b.page, cup.id, LAUTSPRECHER);
      await expect(b.page.getByTestId('ausgang-ohne-wahl')).toContainText('Dieser Browser kann den Ausgang nicht wählen');
      await expect(b.page.getByTestId('ausgang-zeile')).toContainText('Standard (Ausgang des Systems)');
      await expect(b.page.getByTestId('ausgang-aendern')).toHaveCount(0);
    } finally {
      await b.context.close();
      await safeCleanup('HT53 Kopie löschen', () => deleteCup(cup.id));
    }
  });

  test('@HT-056 Zweites Turnier am selben Gerät: Rückfrage; Abbrechen ändert nichts, Wechseln übernimmt', async ({ browser }) => {
    test.setTimeout(180_000);
    const eins = await cloneReleaseCup('ht56a', { withCoAdmin: false });
    const zwei = await cloneReleaseCup('ht56b', { withCoAdmin: false });
    const a = await neuesGeraet(browser, 'owner');
    const b = await neuesGeraet(browser, 'owner');
    try {
      await richteLautsprecherEin(b.page, eins.id, LAUTSPRECHER);
      await oeffneVerwaltung(a.page, eins.id);
      await expect(a.page.getByTestId('lautsprecher-feld-1-zustand')).toHaveText('bereit', { timeout: 30_000 });

      await oeffneVerwaltung(b.page, zwei.id);
      await b.page.getByTestId('geraet-schalter-zeile').click();
      await b.page.getByTestId('geraet-feld-1').click();
      const frage = b.page.getByRole('dialog');
      await expect(frage).toContainText('Dieses Gerät ist schon Hallen-Lautsprecher für', { timeout: 15_000 });
      await b.page.getByTestId('confirm-dialog-cancel').click();
      await expect(b.page.getByTestId('geraet-schalter-zeile')).toContainText('Aus');
      await expect(a.page.getByTestId('lautsprecher-feld-1-zustand'), 'Abbrechen ändert nichts').toHaveText('bereit');

      await b.page.getByTestId('geraet-schalter-zeile').click();
      await b.page.getByTestId('geraet-feld-1').click();
      await expect(b.page.getByRole('dialog')).toContainText('Wechseln?', { timeout: 15_000 });
      await b.page.getByTestId('confirm-dialog-confirm').click();
      await oeffneVerwaltung(a.page, eins.id);
      await expect(a.page.getByTestId('lautsprecher-feld-1-zustand')).toHaveText('kein Hallen-Lautsprecher', { timeout: 40_000 });
    } finally {
      await a.context.close();
      await b.context.close();
      await safeCleanup('HT56a Kopie löschen', () => deleteCup(eins.id));
      await safeCleanup('HT56b Kopie löschen', () => deleteCup(zwei.id));
    }
  });

  test('@HT-042 Uhr des Verwaltungsgeräts +20 s ändert die Bereitschaft nicht', async ({ browser }) => {
    test.setTimeout(120_000);
    const cup = await cloneReleaseCup('ht42', { withCoAdmin: false });
    const a = await neuesGeraet(browser, 'owner');
    const b = await neuesGeraet(browser, 'owner');
    try {
      await stelleUhrVor(a.context, 20_000);
      await richteLautsprecherEin(b.page, cup.id, LAUTSPRECHER);
      await oeffneVerwaltung(a.page, cup.id);
      await expect(a.page.getByTestId('lautsprecher-feld-1-zustand')).toHaveText('bereit', { timeout: 30_000 });
      await bleibtText(a.page, 'lautsprecher-feld-1-zustand', 'bereit', 15_000);
    } finally {
      await a.context.close();
      await b.context.close();
      await safeCleanup('HT42 Kopie löschen', () => deleteCup(cup.id));
    }
  });
});
