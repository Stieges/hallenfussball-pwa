/**
 * Zuschauer-Seite „Schneller zum Spielplan“ (@ZM-196, @ZM-197, @ZM-175, @OB-022), 360×640, Schrift 100 %.
 *
 * Saaten: `hallencup-messlauf` (Code MESS26: 2 Gruppen + Finalrunde, 8 Teams, Heim des Finales ist „Sportgemeinschaft Fußballfreunde
 * Nordheim-Süd 1921“) und `nikolaus-gleichstand` (Code NIKO26: Jeder gegen jeden, 6 Teams, keine Gruppen, keine Finalrunde).
 * @ZM-196 gilt mit „Gegeben …, Spiel 7 und Spiel 8 laufen“: die Abnahmefälle bauen die Saat im Speicher so um (`mitZweiLaufenden`, bei
 * Nikolaus mit zweitem Feld). „Nach einmal Wischen“ wird wörtlich gemessen: `scrollTo(0, Bildschirmhöhe − Reiterleiste)`, danach liegt
 * die erste Spielzeile ganz im Bild (oben ≥ 0, unten ≤ Oberkante der Reiterleiste).
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
import { neuLaden } from '../helpers/neuLaden';
import { mitZweiLaufenden } from '../helpers/zweiLaufende';
// @ts-expect-error – .mjs ohne Typen; derselbe Lader wie bei `npm run visual:metrics --saat`
import { installiereSaat, leseSaat } from '../../../scripts/visual-metrics/saat/lader.mjs';

const HANDY = { width: 360, height: 640 };
const LANGES_TEAM = '00000001-0000-4000-8000-000000000001';
const LANGER_NAME = 'Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921';

interface Optionen { saat?: string; saatDaten?: unknown; code?: string; query?: string; team?: string }

async function oeffne(page: Page, o: Optionen = {}): Promise<void> {
  const code = o.code ?? 'MESS26';
  await page.setViewportSize(HANDY);
  await installiereSaat(page.context(), o.saatDaten ?? leseSaat(o.saat ?? 'hallencup-messlauf'));
  if (o.team !== undefined) {
    await page.context().addInitScript((w: { key: string; id: string }) => { localStorage.setItem(w.key, w.id); }, { key: `live:${code}:myTeam`, id: o.team });
  }
  await page.goto(`/#/live/${code}${o.query ?? ''}`);
  await expect(page.locator('[data-testid="public-weg"]')).toBeAttached({ timeout: 25000 });
}

/** Erste SICHTBARE Karte im Spielplan (die Desktop-Karten sind am Handy ausgeblendet und hätten die Höhe 0). */
const ersteKarte = (page: Page) => page.locator('.schedule-display [data-match-card]:visible').first();

const tid = (page: Page, id: string) => page.locator(`[data-testid="${id}"]`);

/** Abnahme-Saaten: „Spiel 7 und Spiel 8 laufen“ (Hallencup Nord; Nikolaus mit zweitem Feld). */
const HALLENCUP_LAUFEN = { saatDaten: mitZweiLaufenden('hallencup-messlauf', 'hallencup-messlauf') };
const NIKOLAUS_LAUFEN = { saatDaten: mitZweiLaufenden('nikolaus-gleichstand', 'nikolaus-gleichstand'), code: 'NIKO26' };

interface Wischmass { oben: number; unten: number; leiste: number; hoehe: number; wisch: number; sichtbar: number }

/** @ZM-196 wörtlich: einmal um die sichtbare Höhe (Bildschirmhöhe ohne die feste Reiterleiste) wischen, dann die erste sichtbare Spielzeile messen. */
async function ersteZeileNachWischen(page: Page): Promise<Wischmass> {
  const mass = await page.evaluate(() => {
    const nav = document.querySelector('nav')!.getBoundingClientRect();
    const sichtbar = window.innerHeight - nav.height;
    window.scrollTo(0, sichtbar);
    return { sichtbar, leiste: nav.top, wisch: window.scrollY };
  });
  const box = await ersteKarte(page).boundingBox();
  if (box === null) { throw new Error('keine sichtbare Spielkarte nach dem Wischen'); }
  return { oben: box.y, unten: box.y + box.height, leiste: mass.leiste, hoehe: box.height, wisch: mass.wisch, sichtbar: mass.sichtbar };
}

function erwarteGanzImBild(m: Wischmass): void {
  expect(m.hoehe, 'Messmittel: sichtbare Karte gefunden').toBeGreaterThan(0);
  expect(m.wisch, 'genau um die sichtbare Höhe gewischt').toBe(m.sichtbar);
  expect(m.oben).toBeGreaterThanOrEqual(0);
  expect(m.unten).toBeLessThanOrEqual(m.leiste);
}

test.describe('@ZM-196 Hallencup Nord (2 Gruppen + Finalrunde): kein Team gewählt', () => {
  test('@ZM-196 Reihenfolge: Kopf, Mein Team (eine Zeile), Filterzeile, Teilnehmer (8), dann der Spielplan; kein zweiter Kopf, kein Code im Seitenkopf', async ({ page }) => {
    await oeffne(page, HALLENCUP_LAUFEN);
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

  test('@ZM-196 Spiel 7 und 8 laufen: nach einmal Wischen um die sichtbare Höhe liegt die erste Spielzeile ganz im Bild, nicht unter der Reiterleiste', async ({ page }) => {
    await oeffne(page, HALLENCUP_LAUFEN);
    await expect(tid(page, 'public-current').locator('[data-testid^="public-current-card-"]')).toHaveCount(2);
    erwarteGanzImBild(await ersteZeileNachWischen(page));
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

test.describe('@ZM-196 Aber-Zeile: passen nicht alle Gruppen in die Zeile, wischt die Gruppen-Auswahl, die Taste „Filter“ bleibt sichtbar', () => {
  /** Hallencup mit vier Gruppen (A bis D, je zwei Teams): die Chips „Alle · A · B · C · D“ sind breiter als die Zeile. */
  function vierGruppen(): unknown {
    const saat = JSON.parse(JSON.stringify(leseSaat('hallencup-messlauf'))) as { datenbanken: Array<{ eintraege: { tournaments?: Array<{ teams: Array<{ group?: string }> }> } }> };
    const teams = saat.datenbanken[0].eintraege.tournaments?.[0]?.teams ?? [];
    teams.forEach((t, i) => { t.group = ['A', 'B', 'C', 'D'][Math.floor(i / 2)]; });
    return saat;
  }

  test('@ZM-196 vier Gruppen bei 360 px: die Chip-Reihe ist breiter als ihr Ausschnitt und wischt, „Filter“ liegt ganz im Bild, der letzte Chip ist erreichbar', async ({ page }) => {
    await oeffne(page, { saatDaten: vierGruppen() });
    const m = await page.evaluate(() => {
      const reihe = document.querySelector<HTMLElement>('[data-testid="public-group-chips"]')!;
      const taste = document.querySelector('[data-testid="public-filter-button"]')!.getBoundingClientRect();
      const davor = { breit: reihe.scrollWidth, sichtbar: reihe.clientWidth };
      reihe.scrollLeft = reihe.scrollWidth;
      const letzter = document.querySelector('[data-testid="public-group-chip-D"]')!.getBoundingClientRect();
      const ausschnitt = reihe.getBoundingClientRect();
      return { davor, tasteLinks: taste.left, tasteRechts: taste.right, tasteHoehe: taste.height, letzterRechts: letzter.right, ausschnittRechts: ausschnitt.right, seite: document.documentElement.scrollWidth };
    });
    expect(m.davor.breit).toBeGreaterThan(m.davor.sichtbar);
    expect(m.tasteLinks).toBeGreaterThanOrEqual(0);
    expect(m.tasteRechts).toBeLessThanOrEqual(HANDY.width);
    expect(m.tasteHoehe).toBeGreaterThanOrEqual(44);
    expect(m.letzterRechts, 'letzter Chip nach dem Wischen im Ausschnitt').toBeLessThanOrEqual(m.ausschnittRechts + 1);
    expect(m.seite, 'kein waagrechtes Scrollen der Seite').toBeLessThanOrEqual(HANDY.width);
    await expect(tid(page, 'public-filter-button')).toBeVisible();
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

  test('@ZM-196 Spiel 7 und 8 laufen, mit Block: nach einmal Wischen liegt die erste Spielzeile ganz im Bild', async ({ page }) => {
    await oeffne(page, { ...HALLENCUP_LAUFEN, team: LANGES_TEAM });
    await expect(tid(page, 'my-team-name')).toHaveText(LANGER_NAME);
    erwarteGanzImBild(await ersteZeileNachWischen(page));
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

  test('@ZM-196 Spiel 7 und 8 laufen (zweites Feld): nach einmal Wischen um die sichtbare Höhe liegt die erste Spielzeile ganz im Bild', async ({ page }) => {
    await oeffne(page, NIKOLAUS_LAUFEN);
    await expect(tid(page, 'public-current').locator('[data-testid^="public-current-card-"]')).toHaveCount(2);
    erwarteGanzImBild(await ersteZeileNachWischen(page));
  });

  // Zusatzfall, KEIN Abnahmefall von @ZM-196: Nikolaus am Ende (nichts läuft, Kopf „Zuletzt beendet“) – der Kopf ist kürzer, die erste Zeile
  // liegt höher. Wörtlich gewischt verschwindet sie ein Stück über dem oberen Rand; geprüft wird nur, dass sie mit höchstens einem Wischen
  // um die sichtbare Höhe ganz im Bild stehen kann.
  test('Zusatzfall Nikolaus ohne laufendes Spiel (Kopf „Zuletzt beendet“): die erste Spielzeile ist mit einem Wischen höchstens um die sichtbare Höhe ganz im Bild erreichbar', async ({ page }) => {
    await oeffne(page, NIKO);
    const vorher = await ersteKarte(page).boundingBox();
    if (vorher === null) { throw new Error('keine sichtbare Spielkarte'); }
    const m = await page.evaluate((zeilenOben) => {
      const nav = document.querySelector('nav')!.getBoundingClientRect();
      const sichtbar = window.innerHeight - nav.height;
      window.scrollTo(0, Math.max(0, Math.min(sichtbar, zeilenOben + window.scrollY - 8)));
      return { sichtbar, leiste: nav.top, wisch: window.scrollY };
    }, vorher.y);
    const box = await ersteKarte(page).boundingBox();
    expect(box).not.toBeNull();
    expect(m.wisch).toBeLessThanOrEqual(m.sichtbar);
    expect(box?.y ?? -1).toBeGreaterThanOrEqual(0);
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(m.leiste);
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
