/**
 * D1 Turnier anlegen (8 Teams, 2 Gruppen + Top 4). Besitzer: B-04 (Wizard) / A-12 (HF-Nummerierung).
 *
 * Heute geht: das Turnier steht (vom Seed über dieselben Generatoren wie der Wizard angelegt) mit
 * 8 Teams in 2 Gruppen, 12 Gruppenspielen und der Finalrunde Halbfinale über Kreuz / Platz 3 /
 * Finale; der Veranstalter sieht es im Dashboard und im Spielplan.
 * Besitzer: A-12 -- "@TM-015 Ein unbesetzter Platz zeigt seine Herkunft": Halbfinale 1 heißt
 * "Erster Gruppe A gegen Zweiter Gruppe B" (heute: "Zweiter Gruppe A gegen Erster Gruppe B").
 */
import { expect } from '@playwright/test';
import { fetchEngineRows } from '../../engineHelpers';
import { E2E_TURNIERTAG_MONITOR_ID, E2E_TURNIERTAG_SHARE_CODE } from '../../testData';
import { appendOwner, finishingEvents, regularResultEvents } from './playViaRpc';
import { expectPageAnchor, fetchTurniertagBracket, fetchTurniertagMatches, fetchTurniertagTeams, finalMatchLabel, finalrundeLabelOf, findFinalByLabel, finalrundeLabels, openSpielplanFinalrunde, openTurniertagPath, TURNIERTAG_ID, vorbedingung } from './shared';
import type { StepContext, TurniertagStep } from './types';

async function anlegen({ asRole }: StepContext): Promise<void> {
  const teams = await fetchTurniertagTeams();
  expect(teams).toHaveLength(8);
  expect(teams.filter((team) => team.group_letter === 'A')).toHaveLength(4);
  expect(teams.filter((team) => team.group_letter === 'B')).toHaveLength(4);
  const { groupMatches, finals } = await fetchTurniertagBracket();
  expect(groupMatches).toHaveLength(12);
  expect(finals).toHaveLength(4);

  const ownerPage = await asRole('owner');
  await ownerPage.goto('/#/');
  await expect(ownerPage.locator(`[data-testid="tournament-card-${TURNIERTAG_ID}"]`)).toBeVisible({ timeout: 15000 });
  await openTurniertagPath(ownerPage, '/schedule');
  // Der Spielplan der Turnierleitung zeigt Halbfinale über Kreuz, Platz 3 und Finale.
  await openSpielplanFinalrunde(ownerPage);
  expect([...(await finalrundeLabels(ownerPage))].sort()).toEqual(finals.map((match) => finalMatchLabel(match, finals)).sort());
}

/** Ansichten, in denen Halbfinale 1 seine Herkunft zeigt (Beispielzeilen von @TM-015). */
const TM015_VIEWS = ['Spielplan der Turnierleitung', 'Toms Cockpit', 'Hallen-Monitor', 'Zuschaueransicht'] as const;
/** Halbfinale 1 in der Spielplan-/Zuschauer-Tabelle: "Halbfinale 1  Erster Gruppe A  …  Zweiter Gruppe B" (Record-Wortlaut, A-36b W7). */
const HF1_ROW = /Halbfinale 1\s+Erster Gruppe A[\s\S]{0,20}Zweiter Gruppe B/;

async function halbfinaleHerkunft(view: (typeof TM015_VIEWS)[number], { asRole, anonPage }: StepContext): Promise<void> {
  const { finals } = await fetchTurniertagBracket();
  if (view === 'Spielplan der Turnierleitung') {
    const ownerPage = await asRole('owner');
    await openSpielplanFinalrunde(ownerPage);
    await expectPageAnchor(ownerPage.locator('[data-testid="filter-phase"]'), 'Spielplan der Turnierleitung');
    // Halbfinale 1: Match-ID über seine Bezeichnung ("1. Halbfinale"), dann gezielt seine
    // Karte/Zeile -- nicht die Position in der Anzeige (Reihenfolge der Halbfinale kippt je
    // Seed, eigener Befund für A-12). Die Aussage bleibt: HF1 zeigt "Erster Gruppe A gegen
    // Zweiter Gruppe B".
    const hf = findFinalByLabel(finals, '1. Halbfinale');
    expect(
      await finalrundeLabelOf(ownerPage, hf, finals),
      `Halbfinale 1 (${hf.id}) zeigt "Erster Gruppe A gegen Zweiter Gruppe B"`
    ).toBe('Erster Gruppe A gegen Zweiter Gruppe B');
  } else if (view === 'Toms Cockpit') {
    // Toms Gerät ist erst nach D3 (Helfer per QR) Mitglied; bis dahin öffnet die Turnierleitung das Cockpit.
    // Die Spielauswahl trägt für jedes Spiel "#<Nr> - <Heim> vs <Gast> (<Zeit>)" und als Wert die Spiel-ID, in Spielplan-Reihenfolge
    // des Felds (C-SPIELNUMMER-FEHLT, C-FINALRUNDE-REIHENFOLGE, @SL-049, @TM-142): nach den 12 Gruppenspielen ist Halbfinale 1 das Spiel 13.
    // Seitenanker: der Live-Reiter der Turnierleitung (Haupt-testid der Seite). Der Cockpit-Körper
    // rendert beim unbesetzten HF1 bislang keinen TeamBlock (`team-name-home`), siehe N3.
    const { groupMatches } = await fetchTurniertagBracket();
    const hf1 = finals.find((match) => match.match_number === groupMatches.length + 1);
    if (!hf1) {
      throw new Error(`Kein Spiel mit der Nummer ${groupMatches.length + 1} in der Finalrunde (Spielnummern: ${finals.map((m) => m.match_number).join(', ')})`);
    }
    expect(hf1.label, `Spiel ${groupMatches.length + 1} der Datenbank ist das 1. Halbfinale`).toBe('1. Halbfinale');
    const nummernDesFelds = (await fetchTurniertagMatches()).filter((match) => match.field === hf1.field).map((match) => match.match_number);
    const cockpitPage = await asRole('owner');
    await cockpitPage.goto(`/#/tournament/${TURNIERTAG_ID}/live?matchId=${hf1.id}`);
    await cockpitPage.waitForLoadState('networkidle');
    await expectPageAnchor(cockpitPage.locator('[data-testid="desktop-tab-live"]'), 'Live-Reiter der Turnierleitung');
    await expect(cockpitPage.locator(`option[value="${hf1.id}"]`)).toHaveText(new RegExp(`^#${groupMatches.length + 1} - Erster Gruppe A vs Zweiter Gruppe B`), { timeout: 5000 });
    await expect(cockpitPage.locator(`select:has(option[value="${hf1.id}"])`)).toHaveValue(hf1.id);
    // Spielreihenfolge des Felds: aufsteigende Spielnummern, kein „#13, #14, …, #1, #2“.
    const optionen = cockpitPage.locator(`select:has(option[value="${hf1.id}"]) option:not([value=""])`);
    await expect(optionen, 'Spielauswahl: alle Spiele des Felds').toHaveCount(nummernDesFelds.length);
    const nummern = (await optionen.allTextContents()).map((text) => Number(/^#(\d+) - /.exec(text)?.[1]));
    expect(nummern, 'Spielauswahl im Cockpit: Spiele des Felds in Spielplan-Reihenfolge, Spielnummern aufsteigend').toEqual([...nummern].sort((x, y) => x - y));
    expect(nummern, 'Spielauswahl im Cockpit: Spielnummern wie in der Datenbank').toEqual([...nummernDesFelds].sort((x, y) => (x ?? 0) - (y ?? 0)));
  } else if (view === 'Hallen-Monitor') {
    // Vorbereitung (E1): nur die Gruppenspiele auf Feld 1 beenden, Feld 2 bleibt offen.
    await vorbedingung('Gruppenspiele auf Feld 1 beenden', async () => {
      const { groupMatches } = await fetchTurniertagBracket();
      for (const match of groupMatches.filter((m) => m.field === 1)) {
        const batch = finishingEvents(await fetchEngineRows(match.id), regularResultEvents(match, 1, 0));
        expect((await appendOwner(match.id, batch)).results.map((r) => r.status), `Feld-1-Vorbereitung ${match.id}`).toEqual(batch.map(() => 'accepted'));
      }
    });
    await anonPage.goto(`/#/display/${TURNIERTAG_ID}/${E2E_TURNIERTAG_MONITOR_ID}`);
    await anonPage.waitForLoadState('networkidle');
    await expectPageAnchor(anonPage.getByText('Nächstes Spiel', { exact: true }), 'Hallen-Monitor (LiveSlide)');
    await expect(anonPage.locator('body')).toHaveText(/Erster Gruppe A\s+vs\s+Zweiter Gruppe B/i, { timeout: 5000 });
  } else {
    await anonPage.goto(`/#/live/${E2E_TURNIERTAG_SHARE_CODE}`);
    await anonPage.waitForLoadState('networkidle');
    await expectPageAnchor(anonPage.getByRole('heading', { level: 1 }).first(), 'Zuschaueransicht');
    await expect(anonPage.locator('body')).toHaveText(HF1_ROW, { timeout: 5000 });
  }
}

function tm015Step(view: (typeof TM015_VIEWS)[number]): TurniertagStep {
  return {
    id: `D1 @TM-015 ${view}`,
    title: `Halbfinale 1 zeigt "Erster Gruppe A gegen Zweiter Gruppe B" (${view})`,
    scenarios: view === 'Toms Cockpit' ? ['@TM-015', '@SL-049', '@TM-142'] : ['@TM-015'],
    owner: view === 'Hallen-Monitor' || view === 'Zuschaueransicht' ? 'A-12 (+ B-35 Adapter)' : 'A-12',
    // Spielplan der Turnierleitung ist seit dem Generator-Fix (Top 4 über Kreuz) grün; die anderen Ansichten bleiben offen.
    expectedFail: view !== 'Spielplan der Turnierleitung' && view !== 'Toms Cockpit',
    run: (ctx) => halbfinaleHerkunft(view, ctx),
  };
}

export const steps: readonly TurniertagStep[] = [
  { id: 'D1', title: 'Turnier steht: 8 Teams, 2 Gruppen, Top 4', scenarios: ['@OB-029'], owner: 'B-04/A-12 (Anlegen im Wizard)', expectedFail: false, run: anlegen },
  ...TM015_VIEWS.filter((view) => view !== 'Hallen-Monitor').map(tm015Step),
];

/**
 * @TM-015 "Hallen-Monitor" läuft vor D8: die Vorbereitung beendet nur die Gruppenspiele auf
 * Feld 1, auf Feld 2 laufen Gruppe A und B noch (Szenario-Vorbedingung). HF1 ist dann das
 * nächste Spiel auf Feld 1 und die LiveSlide zeigt "Erster Gruppe A vs Zweiter Gruppe B".
 */
export const stepsNachGruppenabschluss: readonly TurniertagStep[] = [tm015Step('Hallen-Monitor')];
