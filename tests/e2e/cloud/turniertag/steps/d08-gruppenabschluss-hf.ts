/**
 * D8 Gruppenabschluss -> Halbfinale über Kreuz. Besitzer: A-13 (Auflösung der Finalrunde) mit der Oberfläche des Abschlusses.
 *
 * Gherkin @TM-044: nach dem letzten Abpfiff einer Gruppe SCHLÄGT DIE APP den Abschluss nur vor; die Plätze mit Herkunft aus
 * dieser Gruppe sind noch nicht besetzt. @TM-046/@TM-016: erst wenn Olli "Gruppe abschließen" wählt, ist die Gruppe
 * "abgeschlossen" und alle Plätze mit Herkunft aus ihr sind besetzt (Halbfinale über Kreuz); @TM-047: jede Gruppe rückt für sich ein.
 * Die Besetzung geschieht also NICHT von selbst am Server, sondern durch die Handlung der Turnierleitung.
 *
 * Die Vorbereitung (alle Gruppenspiele zeitrichtig beenden, offene Spiele OHNE Gleichstand, `gruppenabschlussPlan.ts`) ist eine Vorbedingung:
 * scheitert sie, wird der Schritt unerwartet rot und nicht als "erwartet rot" gewertet. Bedienung (GA4 A-13c): Vorschlag
 * `group-close-suggestion`, Taste `group-close-button-<Gruppe>`, Dialog `group-close-dialog` mit Bestätigung `group-close-confirm`.
 * @TM-047 und @TM-016: nach dem Abschluss von Gruppe A sind nur die Plätze aus Gruppe A besetzt (Halbfinale 1 Heim = Erster A,
 * Halbfinale 2 Gast = Zweiter A), die Plätze aus Gruppe B bleiben offen, bis Olli auch Gruppe B abschließt.
 */
import { expect, type Page } from '@playwright/test';
import { fetchEngineRows } from '../../engineHelpers';
import { expectPageAnchor, fetchTurniertagBracket, fetchTurniertagMatches, fetchTurniertagTeams, openTurniertagPath, SOLL_TIMEOUT_MS, vorbedingung, type TurniertagMatch } from './shared';
import { appendOwner, finishingEvents, regularResultEvents } from './playViaRpc';
import { planeGruppenErgebnisse, type FesterStand, type GruppenPlan, type PlanSpiel } from './gruppenabschlussPlan';
import type { StepContext, TurniertagStep } from './types';

/** D12 korrigiert später Gruppenspiel 1 auf 4:0: die Besetzung darf davon nicht abhängen. */
const D12_KORREKTUR = { goalsA: 4, goalsB: 0 };

const planSpiel = (m: TurniertagMatch): PlanSpiel => ({ id: m.id, group: m.group_letter ?? '', teamA: m.team_a_id ?? '', teamB: m.team_b_id ?? '' });

/** Beendet angefangene Gruppenspiele mit ihrem Stand und spielt die übrigen nach Plan (ohne Gleichstand, Tore mit Rückennummer für D10b). */
async function alleGruppenspieleBeenden(): Promise<GruppenPlan> {
  const { groupMatches } = await fetchTurniertagBracket();
  const offen: TurniertagMatch[] = [];
  for (const [index, match] of groupMatches.entries()) {
    const rows = await fetchEngineRows(match.id);
    if (!rows.some((row) => row.type === 'MATCH_START')) {
      offen.push(match);
      continue;
    }
    if (rows.some((row) => row.type === 'MATCH_END')) {
      continue;
    }
    const remaining = finishingEvents(rows, regularResultEvents(match, 1, 0));
    const result = await appendOwner(match.id, remaining);
    expect(result.results.map((r) => r.status), `Gruppenspiel ${index + 1} beenden`).toEqual(remaining.map(() => 'accepted'));
  }
  const offenIds = new Set(offen.map((m) => m.id));
  const fest: FesterStand[] = (await fetchTurniertagMatches())
    .filter((m) => m.phase === 'groupStage' && !offenIds.has(m.id))
    .map((m) => ({ ...planSpiel(m), goalsA: m.score_a ?? 0, goalsB: m.score_b ?? 0 }));
  const plan = planeGruppenErgebnisse(fest, offen.map(planSpiel), { id: groupMatches[0].id, ...D12_KORREKTUR });
  expect(plan, `Ergebnisse ohne Gleichstand wählbar (fest: ${JSON.stringify(fest.map((f) => `${f.group} ${f.goalsA}:${f.goalsB}`))}, offen: ${offen.length})`).not.toBeNull();
  for (const e of plan!.ergebnisse) {
    const match = offen.find((m) => m.id === e.id)!;
    const nummern = e.nummer === undefined ? {} : e.goalsA > e.goalsB ? { a: e.nummer } : { b: e.nummer };
    const events = regularResultEvents(match, e.goalsA, e.goalsB, undefined, nummern);
    const result = await appendOwner(match.id, events);
    expect(result.results.map((r) => r.status), `Gruppenspiel ${match.id} ${e.goalsA}:${e.goalsB}`).toEqual(events.map(() => 'accepted'));
  }
  return plan!;
}

/** Besetzte Seiten der Finalrunde, deren Herkunft ein Gruppenplatz ist: „A1“ → Team-ID oder `null`. */
async function gruppenSeiten(): Promise<Map<string, string | null>> {
  const seiten = new Map<string, string | null>();
  for (const m of (await fetchTurniertagMatches()).filter((x) => x.phase !== 'groupStage')) {
    for (const [quelle, team] of [[m.slot_a_source, m.team_a_id], [m.slot_b_source, m.team_b_id]] as const) {
      if (quelle?.kind === 'groupRank') {
        seiten.set(`${quelle.group ?? ''}${quelle.rank ?? ''}`, team);
      }
    }
  }
  return seiten;
}

/**
 * Olli schließt eine Gruppe über den Vorschlag im Spielplan ab: Taste, Dialog mit Rangfolge (kein Gleichstand-Dialog), Bestätigen.
 * Gibt Platz 1 und 2 der Tabelle zurück, die der Dialog zeigt (die „gegebene Tabelle“ von @TM-016), als Team-IDs.
 */
async function gruppeAbschliessen(seite: Page, gruppe: string): Promise<[string, string]> {
  await seite.locator(`[data-testid="group-close-button-${gruppe}"]`).click({ timeout: SOLL_TIMEOUT_MS });
  const dialog = seite.getByTestId('group-close-dialog');
  await expect(dialog, `Dialog „Gruppe ${gruppe} abschließen“ (kein Gleichstand)`).toBeVisible({ timeout: SOLL_TIMEOUT_MS });
  const namen = await dialog.getByTestId('group-close-ranking').locator('li').evaluateAll((els) =>
    els.map((li) => (li.children[1]?.firstChild?.textContent ?? '').trim()));
  const ids = new Map((await fetchTurniertagTeams()).map((t) => [t.name, t.id]));
  const oben: [string, string] = [ids.get(namen[0]) ?? `? ${namen[0]}`, ids.get(namen[1]) ?? `? ${namen[1]}`];
  await dialog.getByTestId('group-close-confirm').click();
  const fehler = seite.getByTestId('group-close-error');
  await expect.poll(async () => ((await fehler.count()) > 0 ? `Ablehnung: ${await fehler.innerText()}` : (await dialog.count()) === 0 ? 'abgeschlossen' : 'speichert'),
    { message: `Gruppe ${gruppe} abgeschlossen, Dialog geschlossen`, timeout: SOLL_TIMEOUT_MS * 3 }).toBe('abgeschlossen');
  return oben;
}

async function gruppenabschluss({ asRole }: StepContext): Promise<void> {
  const plan = await vorbedingung('alle Gruppenspiele beenden (ohne Gleichstand)', alleGruppenspieleBeenden);
  const ownerPage = await asRole('owner');
  await openTurniertagPath(ownerPage, '/schedule');
  await expectPageAnchor(ownerPage.locator('[data-testid="filter-phase"]'), 'Spielplan der Turnierleitung');
  // @TM-044: die App schlägt den Abschluss vor ...
  await expect(ownerPage.getByTestId('group-close-suggestion'), 'Vorschlag „Gruppe abschließen“').toBeVisible({ timeout: SOLL_TIMEOUT_MS });
  // ... und besetzt die Plätze noch nicht.
  const vorher = await gruppenSeiten();
  expect([...vorher.values()].filter((team) => team !== null), 'vor "Gruppe abschließen" sind die Plätze mit Herkunft aus den Gruppen noch nicht besetzt').toEqual([]);
  // @TM-046/@TM-047/@TM-016: Olli schließt Gruppe A ab -> nur die Plätze aus Gruppe A sind besetzt, nach der Tabelle. Stehen Platz 1 und 2
  // allein nach Punkten fest (Plan), ist das die Erwartung; sonst die Tabelle, die der Dialog zeigt (dieselbe Tabelle, nach der Olli abschließt).
  const tabelleA = await gruppeAbschliessen(ownerPage, 'A');
  const a = plan.oben?.A ?? tabelleA;
  if (plan.oben) {
    expect(tabelleA, 'der Dialog zeigt Platz 1 und 2 nach Punkten').toEqual(plan.oben.A);
  }
  await expect.poll(async () => Object.fromEntries(await gruppenSeiten()), { message: 'nach Gruppe A: A1/A2 besetzt, B1/B2 offen', timeout: SOLL_TIMEOUT_MS * 3 })
    .toEqual({ A1: a[0], A2: a[1], B1: null, B2: null });
  // Gruppe B rückt erst mit ihrem eigenen Abschluss ein.
  const tabelleB = await gruppeAbschliessen(ownerPage, 'B');
  const b = plan.oben?.B ?? tabelleB;
  if (plan.oben) {
    expect(tabelleB, 'der Dialog zeigt Platz 1 und 2 nach Punkten').toEqual(plan.oben.B);
  }
  await expect.poll(async () => Object.fromEntries(await gruppenSeiten()), { message: 'nach Gruppe B: alle Halbfinal-Plätze besetzt (über Kreuz)', timeout: SOLL_TIMEOUT_MS * 3 })
    .toEqual({ A1: a[1], A2: a[0], B1: b[0], B2: b[1] }); // MUTATIONSPROBE
  await expect(ownerPage.getByTestId('group-close-suggestion'), 'beide Gruppen abgeschlossen: kein Vorschlag mehr').toHaveCount(0, { timeout: SOLL_TIMEOUT_MS });
}

export const steps: readonly TurniertagStep[] = [
  { id: 'D8', title: 'Gruppenabschluss: App schlägt vor, Olli schließt ab, Halbfinale über Kreuz besetzt', scenarios: ['@TM-044', '@TM-046', '@TM-047', '@TM-016'], owner: 'A-13 / GA4 A-13c (gebaut)', expectedFail: false, run: gruppenabschluss },
];
