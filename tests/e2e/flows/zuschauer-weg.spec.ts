/**
 * Zuschauer-Seite „Schneller zum Spielplan“ (@ZM-196, @ZM-197, @ZM-175, @OB-022), 360×640, Schrift 100 %.
 *
 * Saaten: `hallencup-messlauf` (Code MESS26: 2 Gruppen + Finalrunde, 8 Teams, Heim des Finales ist „Sportgemeinschaft Fußballfreunde
 * Nordheim-Süd 1921“) und `nikolaus-gleichstand` (Code NIKO26: Jeder gegen jeden, 6 Teams, keine Gruppen, keine Finalrunde).
 * „Nach einmal Wischen“: die Seite um die sichtbare Höhe ohne die feste Reiterleiste (Bildschirmhöhe − Leiste) nach oben schieben;
 * danach liegt die erste Spielzeile ganz im Bild, nicht unter der Leiste.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
import { neuLaden } from '../helpers/neuLaden';
// @ts-expect-error – .mjs ohne Typen; derselbe Lader wie bei `npm run visual:metrics --saat`
import { installiereSaat, leseSaat } from '../../../scripts/visual-metrics/saat/lader.mjs';

const HANDY = { width: 360, height: 640 };
const LANGES_TEAM = '00000001-0000-4000-8000-000000000001';
const LANGER_NAME = 'Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921';

interface Optionen { saat?: string; code?: string; query?: string; team?: string }

async function oeffne(page: Page, o: Optionen = {}): Promise<void> {
  const code = o.code ?? 'MESS26';
  await page.setViewportSize(HANDY);
  await installiereSaat(page.context(), leseSaat(o.saat ?? 'hallencup-messlauf'));
  if (o.team !== undefined) {
    await page.context().addInitScript((w: { key: string; id: string }) => { localStorage.setItem(w.key, w.id); }, { key: `live:${code}:myTeam`, id: o.team });
  }
  await page.goto(`/#/live/${code}${o.query ?? ''}`);
  await expect(page.locator('[data-testid="public-weg"]')).toBeAttached({ timeout: 25000 });
}

/** Erste SICHTBARE Karte im Spielplan (die Desktop-Karten sind am Handy ausgeblendet und hätten die Höhe 0). */
const ersteKarte = (page: Page) => page.locator('.schedule-display [data-match-card]:visible').first();

const tid = (page: Page, id: string) => page.locator(`[data-testid="${id}"]`);

/**
 * Erste Spielzeile (Karte im Spielplan) nach einmal Wischen: Die Seite wird höchstens um die sichtbare Höhe (Bildschirmhöhe ohne die
 * feste Reiterleiste) nach oben geschoben, und zwar so weit, dass die Zeile mit etwas Luft oben im Bild steht. Liegt sie schon höher
 * (kurzer Kopf, Nikolaus), genügt ein kürzeres Wischen. `wisch` ist der geschobene Weg; `oben`/`unten` die Lage der Zeile danach.
 */
async function ersteZeileNachWischen(page: Page): Promise<{ oben: number; unten: number; leiste: number; hoehe: number; wisch: number; sichtbar: number }> {
  const vorher = await ersteKarte(page).boundingBox();
  if (vorher === null) { throw new Error('keine sichtbare Spielkarte im Spielplan'); }
  const mass = await page.evaluate((zeilenOben) => {
    const nav = document.querySelector('nav')!.getBoundingClientRect();
    const sichtbar = window.innerHeight - nav.height;
    const ziel = Math.max(0, Math.min(sichtbar, zeilenOben + window.scrollY - 8));
    window.scrollTo(0, ziel);
    return { sichtbar, leiste: nav.top, wisch: window.scrollY };
  }, vorher.y);
  const box = await ersteKarte(page).boundingBox();
  if (box === null) { throw new Error('keine sichtbare Spielkarte nach dem Wischen'); }
  return { oben: box.y, unten: box.y + box.height, leiste: mass.leiste, hoehe: box.height, wisch: mass.wisch, sichtbar: mass.sichtbar };
}

test.describe('@ZM-196 Hallencup Nord (2 Gruppen + Finalrunde): kein Team gewählt', () => {
  test('@ZM-196 Reihenfolge: Kopf, Mein Team (eine Zeile), Filterzeile, Teilnehmer (8), dann der Spielplan; kein zweiter Kopf, kein Code im Seitenkopf', async ({ page }) => {
    await oeffne(page);
    const lage = await page.evaluate(() => {
      const q = (s: string) => document.querySelector(s)!;
      const folge = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
      const kopf = q('[data-testid="public-current"]'), mein = q('[data-testid="my-team-bar"]'), filter = q('[data-testid="public-filter-bar"]');
      const teil = q('[data-testid="public-participants"]'), karte = q('.schedule-display .group-stage-schedule');
      return {
        reihenfolge: folge(kopf, mein) && folge(mein, filter) && folge(filter, teil) && folge(teil, karte),
        meinTeamText: mein.textContent,
        meinTeamHoehe: mein.getBoundingClientRect().height,
        h1: document.querySelectorAll('h1').length,
        turnierkopf: document.querySelectorAll('.tournament-header, .participants-and-groups').length,
        seitentext: document.body.innerText,
      };
    });
    expect(lage.reihenfolge).toBe(true);
    expect(lage.meinTeamText).toContain('Mein Team');
    expect(lage.meinTeamText).toContain('Team wählen');
    expect(lage.h1).toBe(1);
    expect(lage.turnierkopf).toBe(0);
    expect(lage.seitentext).not.toMatch(/LIVE: MESS26/);
    await expect(tid(page, 'public-participants-toggle')).toContainText('Teilnehmer (8)');
    await expect(tid(page, 'public-group-chips')).toContainText('Alle');
    await expect(tid(page, 'public-filter-button')).toHaveText('Filter');
  });

  test('@ZM-196 nach einmal Wischen um die sichtbare Höhe liegt die erste Spielzeile ganz im Bild, nicht unter der Reiterleiste', async ({ page }) => {
    await oeffne(page);
    const m = await ersteZeileNachWischen(page);
    expect(m.hoehe, 'Messmittel: sichtbare Karte gefunden').toBeGreaterThan(0);
    expect(m.wisch, 'ein Wischen: höchstens die sichtbare Höhe').toBeLessThanOrEqual(m.sichtbar);
    expect(m.oben).toBeGreaterThanOrEqual(0);
    expect(m.unten).toBeLessThanOrEqual(m.leiste);
  });

  test('@OB-022 @ZM-196 Tippziele: „Team wählen“, „Filter“, Gruppen-Chips und die Teilnehmer-Zeile mindestens 44 Bildpunkte', async ({ page }) => {
    await oeffne(page);
    const masse = await page.evaluate(() => ['my-team-choose', 'public-filter-button', 'public-group-chip-all', 'public-group-chip-A', 'public-group-chip-B', 'public-participants-toggle'].map((id) => {
      const r = document.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect();
      return { id, h: r.height, w: r.width };
    }));
    for (const m of masse) {
      expect(m.h, m.id).toBeGreaterThanOrEqual(44);
      expect(m.w, m.id).toBeGreaterThanOrEqual(44);
    }
  });

  test('@ZM-196 ohne waagrechtes Scrollen: nichts ragt über den Rand (die Teilnehmer-Kästen von heute taten es)', async ({ page }) => {
    await oeffne(page);
    await tid(page, 'public-participants-toggle').click();
    const breite = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(breite).toBeLessThanOrEqual(HANDY.width);
  });
});

test.describe('@ZM-196 Hallencup Nord: Mama Petra hat das Team mit dem langen Namen gewählt', () => {
  test('@ZM-175 @ZM-196 Block: Name bricht an Leerzeichen um, ohne „…“, „ändern“ bleibt sichtbar (≥ 44 px), nächstes Spiel und Tabelle stehen da', async ({ page }) => {
    await oeffne(page, { team: LANGES_TEAM });
    const name = tid(page, 'my-team-name');
    await expect(name).toHaveText(LANGER_NAME);
    const m = await page.evaluate(() => {
      const n = document.querySelector<HTMLElement>('[data-testid="my-team-name"]')!;
      const a = document.querySelector('[data-testid="my-team-change"]')!.getBoundingClientRect();
      return { ellipsis: getComputedStyle(n).textOverflow === 'ellipsis', ueberlaeuft: n.scrollWidth > n.clientWidth + 1, zeilen: (() => { const r = document.createRange(); r.selectNodeContents(n); return new Set(Array.from(r.getClientRects()).map((x) => Math.round(x.top))).size; })(), aendernRechts: a.right, aendernHoehe: a.height, aendernLinks: a.left };
    });
    expect(m.ellipsis).toBe(false);
    expect(m.ueberlaeuft).toBe(false);
    expect(m.zeilen).toBeGreaterThanOrEqual(2);
    expect(m.aendernRechts).toBeLessThanOrEqual(HANDY.width);
    expect(m.aendernLinks).toBeGreaterThanOrEqual(0);
    expect(m.aendernHoehe).toBeGreaterThanOrEqual(44);
    await expect(tid(page, 'my-team-next')).toContainText(/Spiel \d+ · \d\d:\d\d Uhr · Feld \d gegen|Kein weiteres Spiel/);
    await expect(tid(page, 'my-team-table')).toContainText(/Platz \d in Gruppe [A-Z]+ · \d+ Punkte/);
  });

  test('@ZM-196 mit Block: nach einmal Wischen liegt die erste Spielzeile ganz im Bild', async ({ page }) => {
    await oeffne(page, { team: LANGES_TEAM });
    const m = await ersteZeileNachWischen(page);
    expect(m.hoehe, 'Messmittel: sichtbare Karte gefunden').toBeGreaterThan(0);
    expect(m.wisch, 'ein Wischen: höchstens die sichtbare Höhe').toBeLessThanOrEqual(m.sichtbar);
    expect(m.oben).toBeGreaterThanOrEqual(0);
    expect(m.unten).toBeLessThanOrEqual(m.leiste);
  });
});

test.describe('@ZM-196 Nikolaus-Turnier (Jeder gegen jeden, 6 Teams)', () => {
  const NIKO = { saat: 'nikolaus-gleichstand', code: 'NIKO26' };

  test('@ZM-196 nur die Taste „Filter“ (Status): keine Gruppen-Auswahl, kein Phasen-Filter; „Teilnehmer (6)“; eine Zeile „Mein Team“', async ({ page }) => {
    await oeffne(page, NIKO);
    await expect(tid(page, 'public-group-chips')).toHaveCount(0);
    await expect(tid(page, 'public-filter-button')).toBeVisible();
    await expect(tid(page, 'public-participants-toggle')).toContainText('Teilnehmer (6)');
    await expect(tid(page, 'my-team-bar')).toContainText('Team wählen');
    await tid(page, 'public-filter-button').click();
    await expect(tid(page, 'public-filter-group-status')).toBeVisible();
    await expect(tid(page, 'public-filter-group-phase')).toHaveCount(0);
  });

  test('@ZM-196 nach einmal Wischen um die sichtbare Höhe (ohne Reiterleiste) liegt die erste Spielzeile ganz im Bild', async ({ page }) => {
    await oeffne(page, NIKO);
    const m = await ersteZeileNachWischen(page);
    expect(m.hoehe, 'Messmittel: sichtbare Karte gefunden').toBeGreaterThan(0);
    expect(m.wisch, 'ein Wischen: höchstens die sichtbare Höhe').toBeLessThanOrEqual(m.sichtbar);
    expect(m.oben).toBeGreaterThanOrEqual(0);
    expect(m.unten).toBeLessThanOrEqual(m.leiste);
  });
});

test.describe('@ZM-196 Teilnehmer eingeklappt', () => {
  test('@ZM-196 Antippen klappt auf (Teams einmal, nach Gruppen), Vorlese-Wort „eingeklappt“/„aufgeklappt“, nach dem Neuladen wieder zu', async ({ page }) => {
    await oeffne(page);
    const knopf = tid(page, 'public-participants-toggle');
    await expect(knopf).toHaveAttribute('aria-expanded', 'false');
    await expect(knopf).toContainText('Teilnehmer (8), eingeklappt');
    await knopf.click();
    await expect(knopf).toHaveAttribute('aria-expanded', 'true');
    await expect(knopf).toContainText('Teilnehmer (8), aufgeklappt');
    await expect(page.locator('[data-testid^="public-participant-"]')).toHaveCount(8);
    await expect(tid(page, 'public-participants-list').getByRole('heading', { name: /Gruppe/ })).toHaveCount(2);
    await neuLaden(page);
    await expect(tid(page, 'public-participants-toggle')).toHaveAttribute('aria-expanded', 'false');
  });
});

test.describe('@ZM-197 Filter hinter der Taste bleibt sichtbar', () => {
  test('@ZM-197 QR-Einstieg: alles „Alle“, die Taste heißt „Filter“ ohne Zahl, keine Hinweiszeile', async ({ page }) => {
    await oeffne(page);
    await expect(tid(page, 'public-filter-button')).toHaveText('Filter');
    await expect(tid(page, 'public-filter-note')).toHaveCount(0);
  });

  test('@ZM-197 Link mit Status „Beendet“: „Filter (1)“, Vorlese-Text „Filter, 1 gewählt“, Hinweiszeile „Beendet“ mit „Alle zeigen“', async ({ page }) => {
    await oeffne(page, { query: '?s=finished' });
    const knopf = tid(page, 'public-filter-button');
    await expect(knopf).toHaveText('Filter (1)');
    await expect(knopf).toHaveAttribute('aria-label', 'Filter, 1 gewählt');
    await expect(tid(page, 'public-filter-note')).toContainText('Beendet');
    await expect(tid(page, 'public-filter-show-all')).toBeVisible();
    const h = await tid(page, 'public-filter-show-all').evaluate((el) => el.getBoundingClientRect().height);
    expect(h).toBeGreaterThanOrEqual(44);
  });

  test('@ZM-197 „Alle zeigen“: alle Spiele erscheinen, die Taste heißt wieder „Filter“, die Adresse enthält keinen Filter mehr', async ({ page }) => {
    await oeffne(page, { query: '?s=finished' });
    await tid(page, 'public-filter-show-all').click();
    await expect(tid(page, 'public-filter-button')).toHaveText('Filter');
    await expect(tid(page, 'public-filter-note')).toHaveCount(0);
    expect(page.url()).not.toMatch(/[?&]s=/);
  });
});

test.describe('@ZM-196 Filter als Blatt von unten', () => {
  test('@ZM-196 die Taste öffnet Phase und Status als Blatt, ohne den Spielplan zu verschieben; Felder ≥ 44 px, „Fertig“ ≥ 56 px zuletzt', async ({ page }) => {
    await oeffne(page);
    const obenImDokument = async (): Promise<number> => ((await ersteKarte(page).boundingBox())?.y ?? Number.NaN) + (await page.evaluate(() => window.scrollY));
    const vorher = await obenImDokument();
    await tid(page, 'public-filter-button').click();
    await expect(tid(page, 'public-filter-sheet')).toBeVisible();
    await expect(tid(page, 'public-filter-group-phase')).toBeVisible();
    await expect(tid(page, 'public-filter-group-status')).toBeVisible();
    const nachher = await obenImDokument();
    expect(Math.abs(nachher - vorher)).toBeLessThanOrEqual(1);
    const masse = await page.evaluate(() => {
      const hoehe = (sel: string) => Array.from(document.querySelectorAll(sel)).map((e) => e.getBoundingClientRect().height);
      const fertig = document.querySelector('[data-testid="public-filter-done"]')!.getBoundingClientRect();
      const reset = document.querySelector('[data-testid="public-filter-reset"]')!.getBoundingClientRect();
      return { felder: hoehe('[data-testid^="public-filter-opt-"]'), fertigH: fertig.height, resetH: reset.height, fertigRechts: fertig.left >= reset.left, fertigUnten: fertig.bottom >= reset.bottom - 1 };
    });
    for (const h of masse.felder) { expect(h).toBeGreaterThanOrEqual(44); }
    expect(masse.fertigH).toBeGreaterThanOrEqual(56);
    expect(masse.resetH).toBeGreaterThanOrEqual(44);
    expect(masse.fertigRechts || masse.fertigUnten).toBe(true);
  });

  test('@ZM-196 @ZM-197 Status „Beendet“ im Blatt: gilt sofort (Adresse s=finished), „Filter (1)“, Hinweiszeile; „Zurücksetzen“ nimmt ihn zurück', async ({ page }) => {
    await oeffne(page);
    await tid(page, 'public-filter-button').click();
    await tid(page, 'public-filter-opt-status-finished').click();
    expect(page.url()).toMatch(/[?&]s=finished/);
    await tid(page, 'public-filter-done').click();
    await expect(tid(page, 'public-filter-sheet')).toHaveCount(0);
    await expect(tid(page, 'public-filter-button')).toHaveText('Filter (1)');
    await expect(tid(page, 'public-filter-note')).toContainText('Beendet');
    await tid(page, 'public-filter-button').click();
    await tid(page, 'public-filter-reset').click();
    await expect(tid(page, 'public-filter-button')).toHaveText('Filter');
    expect(page.url()).not.toMatch(/[?&]s=/);
  });

  test('@ZM-196 Gruppen-Auswahl: „B“ wählt Gruppe B (Adresse g=B), „Alle“ nimmt sie zurück; sie zählt nicht zu „Filter (n)“', async ({ page }) => {
    await oeffne(page);
    await tid(page, 'public-group-chip-B').click();
    expect(page.url()).toMatch(/[?&]g=B/);
    await expect(tid(page, 'public-group-chip-B')).toHaveAttribute('aria-pressed', 'true');
    await expect(tid(page, 'public-filter-button')).toHaveText('Filter');
    await tid(page, 'public-group-chip-all').click();
    expect(page.url()).not.toMatch(/[?&]g=/);
  });
});
