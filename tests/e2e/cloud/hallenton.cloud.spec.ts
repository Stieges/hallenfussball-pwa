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
import { expectEngineMatchRunningUi, fetchUserIdByEmail, newRoleContext, openCockpit } from './engineHelpers';
import { safeCleanup } from './helpers';
import { E2E_USERS } from './testData';
import { abpfiffHalten } from '../helpers/abpfiff';
import {
  beobachteKeinenWeiterenTon, installiereTonSpion, klingtUm, oeffneVerwaltung, richteLautsprecherEin, tonBeginne, warteAufEndeAmServer, warteAufToene,
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
    const a = await newRoleContext(browser, 'owner');
    const b = await newRoleContext(browser, 'owner');
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
    const a = await newRoleContext(browser, 'owner');
    const b = await newRoleContext(browser, 'owner');
    const zweites = await newRoleContext(browser, 'owner');
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
    const a = await newRoleContext(browser, 'owner');
    const b = await newRoleContext(browser, 'owner');
    const c = await newRoleContext(browser, 'owner');
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
    const a = await newRoleContext(browser, 'owner');
    const b = await newRoleContext(browser, 'owner');
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
    const olli = await newRoleContext(browser, 'owner');
    const heiko = await newRoleContext(browser, 'helper');
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
    const a = await newRoleContext(browser, 'owner');
    const b = await newRoleContext(browser, 'owner');
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
