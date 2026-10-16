/**
 * Gemeinsame Bausteine der Durchstich-Schritte (A-23): Zugriff auf den Turniertag-Cup per
 * Service-Role (nur lokaler Stack) und der "Soll-Marker" für noch nicht gebaute Schritte.
 */
import { expect, type Locator, type Page } from '@playwright/test';
import { getLocalServiceRoleClient } from '../../helpers';
import { e2eUuid } from '../../e2eUuid';
import { E2E_TURNIERTAG_CUP_ID } from '../../testData';

/** Kurze Zeitgrenze: ein noch nicht gebauter Schritt soll schnell und am Soll-Marker scheitern. */
export const SOLL_TIMEOUT_MS = 3000;

export const TURNIERTAG_ID = E2E_TURNIERTAG_CUP_ID;

export interface TurniertagMatch {
  id: string;
  slot: number;
  field: number;
  phase: string;
  group_letter: string | null;
  team_a_id: string | null;
  team_b_id: string | null;
  slot_a_source: { kind: string; rank?: number; group?: string; role?: string; matchId?: string } | null;
  slot_b_source: { kind: string; rank?: number; group?: string; role?: string; matchId?: string } | null;
  match_status: string | null;
  decided_by: string | null;
  score_a: number | null;
  score_b: number | null;
  label: string | null;
}

export interface TurniertagTeam {
  id: string;
  name: string;
  group_letter: string | null;
}

/** Liest Zeilen per Service-Role-REST (nur lokaler Stack); die Soll-Wirkungen der `test.fail`-Schritte nutzen es. */
export async function getRows<T>(query: string, label: string): Promise<T[]> {
  const { url, headers } = getLocalServiceRoleClient();
  const res = await fetch(`${url}/rest/v1/${query}`, { headers });
  if (!res.ok) {
    throw new Error(`${label} fehlgeschlagen: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as T[];
}

/** Alle Spiele des Turniertag-Cups in Spielplan-Reihenfolge (`slot`). */
export function fetchTurniertagMatches(): Promise<TurniertagMatch[]> {
  return getRows<TurniertagMatch>(
    `matches?tournament_id=eq.${TURNIERTAG_ID}&order=slot.asc,field.asc,id.asc&select=id,slot,field,phase,group_letter,team_a_id,team_b_id,slot_a_source,slot_b_source,match_status,decided_by,score_a,score_b,label`,
    'fetchTurniertagMatches'
  );
}

export function fetchTurniertagTeams(): Promise<TurniertagTeam[]> {
  return getRows<TurniertagTeam>(`teams?tournament_id=eq.${TURNIERTAG_ID}&select=id,name,group_letter&order=name.asc`, 'fetchTurniertagTeams');
}

/** Gruppenspiele in Spielplan-Reihenfolge (die ersten 12) und Finalrunde (HF1, HF2, Platz 3, Finale). */
export async function fetchTurniertagBracket(): Promise<{ groupMatches: TurniertagMatch[]; finals: TurniertagMatch[] }> {
  const matches = await fetchTurniertagMatches();
  return { groupMatches: matches.filter((m) => m.phase === 'groupStage'), finals: matches.filter((m) => m.phase !== 'groupStage') };
}

export function turniertagEventId(key: string): string {
  return e2eUuid(`event:turniertag-cup:${key}`);
}

/**
 * Soll-Marker eines noch nicht gebauten Schritts: das Bedienelement, das der Besitzer baut.
 * Der Marker allein genügt NICHT (Fixrunde 1, 6.1): jeder `test.fail`-Schritt prüft danach mindestens
 * EINE fachliche Wirkung (DB oder sichtbarer Zustand). Ein fremdes `data-testid` macht ihn so nicht grün.
 * Der Besitzer stellt den Schritt erst auf `expectedFail: false`, wenn alle Soll-Zeilen grün sind.
 * Der Besitzer präzisiert den Marker beim Bauen -- bis dahin scheitert der Schritt hier und ist
 * als `test.fail` markiert. Wird er unerwartet grün, meldet Playwright "Expected to fail".
 */
export async function expectSollMarker(page: Page, testId: string): Promise<void> {
  await expect(page.locator(`[data-testid="${testId}"]`)).toBeVisible({ timeout: SOLL_TIMEOUT_MS });
}

/** Zeitgrenze für den Seitenanker: die Seite darf laden, der Anker soll nicht flackern. */
export const ANCHOR_TIMEOUT_MS = 15000;

/**
 * Seitenanker eines `test.fail`-Schritts: ein Element, das auf der geöffneten Seite HEUTE existiert.
 * Steht immer VOR dem Soll-Marker, damit der Schritt an einer falschen Seite nicht am Soll-Marker
 * scheitert (sondern sichtbar am Anker) und das Signal "Besitzer fertig" am richtigen Grund hängt.
 */
export async function expectPageAnchor(locator: Locator, label: string): Promise<void> {
  await expect(locator, `Seitenanker: ${label}`).toBeVisible({ timeout: ANCHOR_TIMEOUT_MS });
}

export async function openTurniertagPath(page: Page, pathSuffix: string, tournamentId: string = TURNIERTAG_ID): Promise<void> {
  await page.goto(`/#/tournament/${tournamentId}${pathSuffix}`);
  await page.waitForLoadState('networkidle');
}

/**
 * Öffnet den Spielplan der Turnierleitung gefiltert auf die Finalrunde. Die Liste rendert nur einen
 * Ausschnitt aller Spiele; mit dem Phasenfilter stehen genau die vier Finalrunden-Spiele im Dokument.
 */
export async function openSpielplanFinalrunde(page: Page): Promise<void> {
  await openTurniertagPath(page, '/schedule');
  await page.locator('[data-testid="filter-phase"]').selectOption({ label: 'Finalrunde' });
}

/**
 * Beschriftungen der vier Finalrunden-Spiele im Spielplan der Turnierleitung ("<Heim> gegen <Gast>"),
 * in Anzeigereihenfolge (Halbfinale 1 zuerst). Der Spielplan zeigt sie je nach Renderzustand als
 * Karten (`role="row"`, `aria-label="Spiel <n>: <Heim> gegen <Gast>"`) oder als Tabelle der
 * Finalrunde (`tr` mit Nr., Zeit, Runde, Heim, Ergebnis, Gast, Feld); beide Quellen werden gelesen.
 * Die Liste rendert nur Zeilen im Umfeld des sichtbaren Bereichs: beim Warten über die Seite scrollen.
 */
export async function finalrundeLabels(page: Page): Promise<string[]> {
  const orderByLabel = new Map<string, number>();
  const remember = (label: string, order: number): void => {
    orderByLabel.set(label, Math.min(order, orderByLabel.get(label) ?? order));
  };
  const collect = async (): Promise<void> => {
    const cards = await page.getByRole('row').evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') ?? ''));
    for (const label of cards) {
      const match = /^Spiel (\d+): (.+)$/.exec(label);
      if (match) {
        remember(match[2], Number(match[1]));
      }
    }
    const table = await page.locator('tr').evaluateAll((els) =>
      els.map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => (td as HTMLElement).innerText.replace(/\s+/g, ' ').trim()))
    );
    for (const cells of table) {
      if (cells.length >= 6 && /Halbfinale|^Finale$|Platz 3/.test(cells[2])) {
        remember(`${cells[3]} gegen ${cells[5]}`, Number(cells[0]));
      }
    }
  };
  await expect(async () => {
    for (const fraction of [0, 0.4, 0.7, 1]) {
      await page.evaluate((f) => window.scrollTo(0, document.body.scrollHeight * f), fraction);
      await page.waitForTimeout(250);
      await collect();
    }
    expect(orderByLabel.size).toBe(4);
  }).toPass({ timeout: 20000 });
  return [...orderByLabel.entries()].sort(([, a], [, b]) => a - b).map(([label]) => label);
}

/** Anzeigetext einer offenen Spielseite aus ihrer Cloud-Herkunft (`slot_*_source`). */
export function sourceLabel(source: TurniertagMatch['slot_a_source'], finals: readonly TurniertagMatch[]): string {
  if (source?.kind === 'groupRank') {
    return `${source.rank === 1 ? 'Erster' : 'Zweiter'} Gruppe ${source.group}`;
  }
  if (source?.kind === 'matchResult') {
    const semifinal = finals.findIndex((match) => match.id === source.matchId) + 1;
    // Record-Wortlaut „Sieger Halbfinale 1“ (@TM-015, @BM-032; A-36b W7).
    return `${source.role === 'winner' ? 'Sieger' : 'Verlierer'} Halbfinale ${semifinal}`;
  }
  return '';
}

/** "<Heim> gegen <Gast>" eines Finalrunden-Spiels, wie der Spielplan es aus der Herkunft beschriftet. */
export function finalMatchLabel(match: TurniertagMatch, finals: readonly TurniertagMatch[]): string {
  return `${sourceLabel(match.slot_a_source, finals)} gegen ${sourceLabel(match.slot_b_source, finals)}`;
}

/**
 * Finalrunden-Spiel über seine Bezeichnung (Spalte `matches.label`, z. B. "1. Halbfinale") -- die
 * Match-ID des Spiels, nie seine Position: die Reihenfolge der beiden Halbfinale kippt je Seed
 * (eigener Befund für A-12), deshalb taugt weder die DB-Reihenfolge noch die Anzeige-Position
 * als Fundstelle.
 */
export function findFinalByLabel(finals: readonly TurniertagMatch[], bezeichnung: string): TurniertagMatch {
  const match = finals.find((m) => m.label === bezeichnung);
  if (!match) {
    throw new Error(
      `Finalrunden-Spiel "${bezeichnung}" nicht gefunden (Bezeichnungen: ${finals.map((m) => `${m.id}=${m.label ?? '-'}`).join(', ')}).`
    );
  }
  return match;
}

/**
 * Karte/Zeile EINES Finalrunden-Spiels in der Anzeige ("<Heim> gegen <Gast>"), gezielt über seine
 * Bezeichnung (Runde-Spalte der Tabelle) bzw. in der Karten-Form über die Herkunft aus seiner
 * Cloud-Zeile -- nie über die Position in der Anzeige (Reihenfolge der Halbfinale je Seed
 * zufällig, eigener Befund für A-12). Virtualisierung wie `finalrundeLabels`: über die Seite
 * scrollen, bis die Fundstelle steht.
 */
export async function finalrundeLabelOf(
  page: Page,
  match: TurniertagMatch,
  finals: readonly TurniertagMatch[]
): Promise<string | undefined> {
  const expected = finalMatchLabel(match, finals);
  // Die Anzeige zeigt die Bezeichnung im Record-Wortlaut („Halbfinale 1“, A-36b W7); in der Cloud-Zeile steht
  // weiter die Generator-Bezeichnung („1. Halbfinale“).
  const bezeichnung = match.label?.replace(/^(\d+)\. Halbfinale$/, 'Halbfinale $1');
  let zeile: string | undefined;
  let karte: string | undefined;
  const collect = async (): Promise<void> => {
    const cards = await page.getByRole('row').evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') ?? ''));
    for (const label of cards) {
      const m = /^Spiel \d+: (.+)$/.exec(label);
      if (m?.[1] === expected) {
        karte = m[1];
      }
    }
    const table = await page.locator('tr').evaluateAll((els) =>
      els.map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => (td as HTMLElement).innerText.replace(/\s+/g, ' ').trim()))
    );
    for (const cells of table) {
      if (cells.length >= 6 && cells[2] === bezeichnung) {
        zeile = `${cells[3]} gegen ${cells[5]}`;
      }
    }
  };
  await expect(async () => {
    for (const fraction of [0, 0.4, 0.7, 1]) {
      await page.evaluate((f) => window.scrollTo(0, document.body.scrollHeight * f), fraction);
      await page.waitForTimeout(250);
      await collect();
    }
    expect(zeile ?? karte, `Karte/Zeile von "${bezeichnung ?? match.id}"`).toBeDefined();
  }).toPass({ timeout: 20000 });
  return zeile ?? karte;
}
