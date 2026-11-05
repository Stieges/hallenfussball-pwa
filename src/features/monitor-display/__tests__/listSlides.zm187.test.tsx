/**
 * @ZM-187 Auf den Listen-Folien verschiebt keine Zeile die anderen · @ZM-188 Jede Zeile einer Listen-Folie liegt ganz im Bild
 * (docs/anforderungen/2026-10-02_zuschauer-und-monitor.md; Seitenteilung @ZM-185, @ZM-150). Erwartungen aus dem Gherkin, nicht am Code
 * abgelesen. jsdom hat kein Layout: „an derselben Stelle“ heißt hier gleicher Aufbau (Spalten, Breiten, Inhalt) und gleiche Seite; die
 * Lage im Bild messen `tests/e2e/listen-folien-monitor.spec.ts` und `npm run visual:metrics`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MonitorTimeCell } from '../components/MonitorTimeCell';
import { NextMatchesSlide } from '../slides/NextMatchesSlide';
import { ScheduleFieldSlide } from '../slides/ScheduleFieldSlide';
import { listFrame, monitorPageCount, nextMatchesLayout, scheduleFieldLayout, standingsSections, startPage } from '../slideContent';
import { listColumns, listPages, listPagesBalanced, nameLines, pageIndexOf, rowHeight } from '../listRows';
import { cssVars, displayList } from '../../../design-tokens';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { slide } from './monitorFixture';
import { withView } from './monitorViewHelper';
import { listenTurnier, type ListenTurnierOptions } from './listFolienKit';
import type { Match } from '../../../types/tournament';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();
afterEach(cleanup);

const SPIEL6 = 'liste-06';
const plan = slide('schedule-field', { fieldId: 'field-1' });
const naechste = slide('next-matches', { matchCount: 15 });

/** Seite der Folie, auf der Spiel 6 steht. */
function seiteVonSpiel6(t: ReturnType<typeof listenTurnier>, art: 'plan' | 'naechste'): number {
  const { view } = withView(t);
  const pages = art === 'plan' ? scheduleFieldLayout(view, 1).pages : nextMatchesLayout(view, 15).pages;
  return pageIndexOf(pages, SPIEL6);
}

function zeigen(t: ReturnType<typeof listenTurnier>, art: 'plan' | 'naechste', page: number) {
  const folie = art === 'plan'
    ? <ScheduleFieldSlide slide={plan} {...withView(t)} theme="dark" style={{}} page={page} />
    : <NextMatchesSlide slide={naechste} {...withView(t)} theme="dark" style={{}} page={page} />;
  const { unmount } = render(folie);
  const zeilen = screen.getAllByTestId('monitor-match-row').map(r => ({ id: r.getAttribute('data-match-id') ?? '', html: r.outerHTML, zeile: r }));
  unmount();
  return zeilen;
}

/** Aufbau einer Zeile: Spalten in Reihenfolge mit ihrer festen Breite – ohne den Inhalt. */
function aufbau(zeile: HTMLElement): string {
  return Array.from(zeile.children).filter(c => (c as HTMLElement).style.position !== 'absolute').map(c => `${(c as HTMLElement).dataset.testid ?? (c as HTMLElement).getAttribute('data-teamname') ?? '?'}:${(c as HTMLElement).style.flex}`).join('|');
}

function mitSpiel6(t: ReturnType<typeof listenTurnier>, patch: Partial<Match>) {
  return { ...t, matches: t.matches.map(m => (m.id === SPIEL6 ? { ...m, ...patch } : m)) };
}

describe('@ZM-187 Auf den Listen-Folien verschiebt keine Zeile die anderen', () => {
  const GEWERTET: Partial<Match> = { matchStatus: 'finished', scoreA: 3, scoreB: 0, decidedBy: 'forfeit', forfeitAbsent: 'B' };
  it.each([
    ['Olli wertet Spiel 6 mit 3:0', GEWERTET],
    ['Tom pfeift Spiel 6 an', { matchStatus: 'running' as const, scoreA: 0, scoreB: 0 }],
    ['Tom pfeift Spiel 6 ab', { matchStatus: 'finished' as const, scoreA: 2, scoreB: 1, decidedBy: 'regular' as const }],
  ])('„Spielplan Feld 1“: %s → die übrigen Zeilen bleiben unverändert, in jeder Zeile dieselben Spalten, kein Spiel wechselt die Seite', (_titel, patch) => {
    const vorher = listenTurnier({ beendet: 5 });
    const nachher = mitSpiel6(vorher, patch);
    const seite = seiteVonSpiel6(vorher, 'plan');
    expect(seiteVonSpiel6(nachher, 'plan')).toBe(seite);
    const davor = zeigen(vorher, 'plan', seite);
    const danach = zeigen(nachher, 'plan', seite);
    expect(danach.map(z => z.id)).toEqual(davor.map(z => z.id));
    expect(davor.length).toBeGreaterThanOrEqual(3);
    danach.forEach((z, i) => { if (z.id !== SPIEL6) { expect(z.html, z.id).toBe(davor[i].html); } });
    expect(new Set(danach.map(z => aufbau(z.zeile))).size, 'gleiche Spalten in jeder Zeile').toBe(1);
    expect(aufbau(danach[0].zeile), 'feste Breiten, nichts richtet sich nach dem Inhalt der Zeile').not.toMatch(/auto/);
    // kein Spiel der Folie wechselt die Seite
    const { view: v1 } = withView(vorher);
    const { view: v2 } = withView(nachher);
    for (const m of vorher.matches) {
      expect(pageIndexOf(scheduleFieldLayout(v2, 1).pages, m.id), m.id).toBe(pageIndexOf(scheduleFieldLayout(v1, 1).pages, m.id));
    }
  });

  it('„Spielplan Feld 1“: „gewertet“ steht klein unter dem Stand (nicht in der Uhrzeit-Zelle), die Zeilenhöhe bleibt gleich', () => {
    const t = mitSpiel6(listenTurnier({ beendet: 5 }), GEWERTET);
    const zeilen = zeigen(t, 'plan', seiteVonSpiel6(t, 'plan'));
    const gewertet = zeilen.find(z => z.id === SPIEL6)!;
    expect(gewertet.zeile.textContent).toContain('gewertet');
    const note = gewertet.zeile.querySelector<HTMLElement>('[data-testid="monitor-match-note"]')!;
    expect(note.parentElement?.getAttribute('data-testid'), 'unter dem Stand').toBe('monitor-match-separator');
    expect(note.style.position, 'außerhalb des Flusses wie „(4:3 i. E.)“').toBe('absolute');
    expect(gewertet.zeile.querySelector('[data-testid="monitor-match-time"]')!.textContent, 'nicht in der Uhrzeit-Zelle').not.toContain('gewertet');
    expect(new Set(zeilen.map(z => z.zeile.style.minHeight)).size, 'Zeilenhöhe bleibt gleich').toBe(1);
  });

  it('die Spalten hängen an der ganzen Folie, nicht an der Seite: auch auf Seiten ohne Abzeichen steht die Spalte in jeder Zeile', () => {
    const t = listenTurnier({ beendet: 5 });
    const pages = scheduleFieldLayout(withView(t).view, 1).pages;
    expect(pages.length).toBeGreaterThanOrEqual(3);
    const spalten = pages.map((_, seite) => new Set(zeigen(t, 'plan', seite).map(z => aufbau(z.zeile))));
    expect(spalten.every(s => s.size === 1)).toBe(true);
    expect(new Set(spalten.flatMap(s => [...s])).size, 'auf allen Seiten dieselben Spalten').toBe(1);
  });

  it('@ZM-189 alles geplant, dann läuft Spiel 1: Spalten und Seitenaufteilung bleiben gleich, nichts springt', () => {
    const geplant = listenTurnier({ beendet: 0 });
    const laeuft = { ...geplant, matches: geplant.matches.map(m => (m.id === 'liste-01' ? { ...m, matchStatus: 'running' as const, scoreA: 0, scoreB: 0 } : m)) };
    const ids = (t: typeof geplant) => scheduleFieldLayout(withView(t).view, 1).pages.map(p => p.map(m => m.id));
    expect(ids(laeuft)).toEqual(ids(geplant));
    const davor = zeigen(geplant, 'plan', 0);
    const danach = zeigen(laeuft, 'plan', 0);
    expect(danach.map(z => aufbau(z.zeile))).toEqual(davor.map(z => aufbau(z.zeile)));
    expect(danach.slice(1).map(z => z.html)).toEqual(davor.slice(1).map(z => z.html));
    for (const z of davor) { expect(z.zeile.querySelector('[data-testid="monitor-match-status"]'), `${z.id}: Zeile für den Zustand ist reserviert`).not.toBeNull(); }
  });

  it('„Nächste Spiele“: Olli verschiebt alle Spiele ab Spiel 6 um 10 Minuten → Zeilen gleich aufgebaut, kein Spiel wechselt die Seite', () => {
    const vorher = listenTurnier({ beendet: 5 });
    const nachher = listenTurnier({ beendet: 5, verschoben: true });
    // Spiel 6 steht in der Liste in beiden Fällen auf derselben Seite
    expect(seiteVonSpiel6(nachher, 'naechste')).toBe(seiteVonSpiel6(vorher, 'naechste'));
    const davor = zeigen(vorher, 'naechste', 0);
    const danach = zeigen(nachher, 'naechste', 0);
    expect(danach.map(z => z.id)).toEqual(davor.map(z => z.id));
    expect(new Set(danach.map(z => aufbau(z.zeile))).size, 'gleiche Spalten in jeder Zeile').toBe(1);
    expect(new Set([...davor, ...danach].map(z => aufbau(z.zeile))).size, 'vor und nach dem Verschieben dieselben Spalten').toBe(1);
  });

  it('Gegenbeispiel: ändert sich nur der Stand eines Spiels auf einer anderen Seite, ändert sich die Seitenaufteilung nicht', () => {
    const vorher = listenTurnier({ beendet: 5 });
    const nachher = listenTurnier({ beendet: 5, gewertet: true });
    const seiten = (t: typeof vorher) => scheduleFieldLayout(withView(t).view, 1).pages.map(p => p.map(m => m.id));
    expect(seiten(nachher)).toEqual(seiten(vorher));
  });
});

describe('@ZM-189 Zustand und Feld stehen unter der Uhrzeit, es gibt keine eigenen Spalten', () => {
  it('ein Feld: Spiel 6 beendet „Ende“, Spiel 7 läuft „Live“, Spiel 8 nur die Uhrzeit; keine Feldangabe, keine Zustandsspalte', () => {
    const t0 = listenTurnier({ beendet: 6 });
    const t = { ...t0, matches: t0.matches.map(m => (m.id === 'liste-07' ? { ...m, matchStatus: 'running' as const, scoreA: 0, scoreB: 0 } : m)) };
    const zeilen = zeigen(t, 'plan', seiteVonSpiel6(t, 'plan'));
    const text = (id: string) => zeilen.find(z => z.id === id)!.zeile.querySelector('[data-testid="monitor-match-time"]')!.textContent ?? '';
    expect(text('liste-06')).toContain('Ende');
    expect(text('liste-07')).toContain('Live');
    expect(text('liste-08')).not.toMatch(/Ende|Live/);
    for (const z of zeilen) {
      expect(z.zeile.querySelector('[data-testid="monitor-match-field"]'), z.id).toBeNull();
      expect(Array.from(z.zeile.children).map(c => (c as HTMLElement).dataset.testid ?? 'name'), z.id).toEqual(['monitor-match-time', 'name', 'monitor-match-separator', 'name']);
    }
    for (const z of zeigen(t, 'naechste', 0)) { expect(z.zeile.querySelector('[data-testid="monitor-match-field"]'), z.id).toBeNull(); }
  });

  it('mehrere Felder: in jeder Zeile von „Nächste Spiele“ steht das Feld, so groß wie die übrigen Angaben; im Spielplan eines Felds nicht', () => {
    const t0 = listenTurnier({ beendet: 3 });
    const t = { ...t0, fields: [...(t0.fields ?? []), { id: 'field-2', defaultName: 'Feld 2' }], numberOfFields: 2,
      matches: t0.matches.map(m => ((m.matchNumber ?? 0) % 2 === 0 ? { ...m, field: 2 } : m)) };
    const zeilen = zeigen(t, 'naechste', 0);
    expect(zeilen.length).toBeGreaterThan(2);
    for (const z of zeilen) {
      const feld = z.zeile.querySelector<HTMLElement>('[data-testid="monitor-match-field"]');
      expect(feld, z.id).not.toBeNull();
      expect(feld!.textContent).toMatch(/^Feld [12]$/);
      expect(feld!.style.fontSize, 'eine Stufe mit den übrigen Zusatzzeilen').toBe(displayList.fontSizes.note);
    }
    for (const z of zeigen(t, 'plan', 0)) { expect(z.zeile.querySelector('[data-testid="monitor-match-field"]'), z.id).toBeNull(); }
  });
});

describe('@ZM-190 Startseite der Spielplan-Folie: laufendes, sonst nächstes Spiel', () => {
  const start = (t: ReturnType<typeof listenTurnier>) => { const p = scheduleFieldLayout(withView(t).view, 1).pages; return p[startPage(p)].map(m => m.id); };
  const mitLaufend = (nr: number) => {
    const t0 = listenTurnier({ beendet: nr - 1 });
    return { ...t0, matches: t0.matches.map(m => (m.matchNumber === nr ? { ...m, matchStatus: 'running' as const, scoreA: 0, scoreB: 0 } : m)) };
  };

  it('Spiele 1–5 beendet, Spiel 6 läuft: die Startseite zeigt Spiel 6', () => {
    expect(start(mitLaufend(6))).toContain('liste-06');
  });

  it('die Seiten selbst bleiben in Anpfiff-Reihenfolge (keine Drehung in der Aufteilung)', () => {
    const pages = scheduleFieldLayout(withView(mitLaufend(6)).view, 1).pages;
    expect(pages.flat().map(m => m.id)).toEqual(listenTurnier().matches.map(m => m.id));
  });

  it('Gegenbeispiel: läuft kein Spiel, ist es die Seite des nächsten geplanten Spiels', () => {
    const t = listenTurnier({ beendet: 9 });
    expect(start(t)).toContain('liste-10');
    expect(monitorPageCount(plan, t, withView(t).view)).toBe(scheduleFieldLayout(withView(t).view, 1).pages.length);
  });

  it('Gegenbeispiel: alle beendet oder alles geplant: erste Seite', () => {
    expect(start(listenTurnier({ beendet: 15 }))).toContain('liste-01');
    expect(start(listenTurnier({ beendet: 0 }))).toContain('liste-01');
  });

  it('laufend geht vor einem früheren geplanten Spiel', () => {
    const t0 = listenTurnier({ beendet: 0 });
    const t = { ...t0, matches: t0.matches.map(m => (m.matchNumber === 12 ? { ...m, matchStatus: 'running' as const, scoreA: 0, scoreB: 0 } : m)) };
    expect(start(t)).toContain('liste-12');
  });
});

describe('@ZM-189 Eine Stufe für die Zusatzzeilen unter der Uhrzeit, Bezeichnung als Überschrift der Zeile', () => {
  it('Feld und Zustand: alle in der Stufe note (direkt an der Zeitzelle)', () => {
    const base = withView(listenTurnier({ beendet: 5 })).view.byId.get('liste-06')!;
    const match = { ...base, badge: { kind: 'badge' as const, state: 'live' as const } };
    render(<MonitorTimeCell match={match} fieldName="Feld 2" reserveState color="#fff" style={{}} />);
    for (const id of ['monitor-match-field', 'monitor-match-status']) {
      expect(screen.getByTestId(id).style.fontSize, id).toBe(displayList.fontSizes.note);
    }
  });

  it('die Bezeichnung steht nicht mehr in der Uhrzeit-Zelle, sondern als fette Überschrift oben mittig in der Zeile (außerhalb des Flusses)', async () => {
    const { AllStandingsSlide } = await import('../slides/AllStandingsSlide');
    const t = listenTurnier({ beendet: 3, finale: 3 });
    render(<AllStandingsSlide tournament={t} view={withView(t).view} theme="dark" style={{}} page={1} />);
    for (const zeile of screen.getAllByTestId('monitor-match-row')) {
      const label = zeile.querySelector<HTMLElement>('[data-testid="monitor-match-label"]')!;
      expect(label.parentElement, 'Überschrift der Zeile').toBe(zeile);
      expect(label.style.position).toBe('absolute');
      expect(label.style.textAlign).toBe('center');
      expect(label.style.fontWeight).toBe(cssVars.fontWeights.bold);
      expect(label.style.fontSize).toBe(displayList.fontSizes.timeNote);
      expect(zeile.querySelector('[data-testid="monitor-match-time"]')!.textContent).not.toContain('Halbfinale');
    }
  });
});

describe('@ZM-105 K.-o.-Uhrzeiten stehen mit Bezeichnung und ohne „voraussichtlich“ (Spielplan, Nächste Spiele, Alle Tabellen)', () => {
  const finale = () => { const t = listenTurnier({ beendet: 3, finale: 3 }); return { t, view: withView(t).view }; };

  it('Spielplan: die Finalspiele tragen ihre Bezeichnung, nirgends „voraussichtlich“', () => {
    const { t } = finale();
    const seite = pageIndexOf(scheduleFieldLayout(withView(t).view, 1).pages, 'liste-05');
    const zeilen = zeigen(t, 'plan', seite);
    expect(zeilen.find(z => z.id === 'liste-05')!.zeile.querySelector('[data-testid="monitor-match-label"]')).toHaveTextContent('Halbfinale');
    for (const z of zeilen) { expect(z.html, z.id).not.toContain('voraussichtlich'); }
  });

  it('Nächste Spiele: mit Bezeichnung, ohne „voraussichtlich“', () => {
    const { t } = finale();
    const zeilen = zeigen(t, 'naechste', 0);
    expect(zeilen.some(z => z.zeile.querySelector('[data-testid="monitor-match-label"]') !== null)).toBe(true);
    for (const z of zeilen) { expect(z.html, z.id).not.toContain('voraussichtlich'); }
  });

  it('„Alle Tabellen“, Finalrunde: drei Finalspiele mit Bezeichnung, ohne „voraussichtlich“', async () => {
    const { AllStandingsSlide } = await import('../slides/AllStandingsSlide');
    const { t, view } = finale();
    const { container } = render(<AllStandingsSlide tournament={t} view={view} theme="dark" style={{}} page={1} />);
    const zeilen = screen.getAllByTestId('monitor-match-row');
    expect(zeilen).toHaveLength(3);
    for (const z of zeilen) { expect(z.querySelectorAll('[data-testid="monitor-match-label"]')).toHaveLength(1); }
    expect(container.textContent).not.toContain('voraussichtlich');
  });
});

describe('@ME-006 @ME-067 Takt und Folie rechnen mit demselben Rahmen', () => {
  it('auf der Ersatzfolie (Hinweis möglich) ist der Platz immer reserviert: Seitenzahl des Takts = der Folie, mit und ohne Hinweis, Rand 10 %, lange Namen', async () => {
    const { SPIELPLAN_FALLBACK_SLIDE } = await import('../slideProgramme');
    const t = listenTurnier({ namen: 'lang', verschoben: true });
    const { view } = withView(t);
    expect(listFrame(SPIELPLAN_FALLBACK_SLIDE, 10).notice).toBe(true);
    expect(listFrame(plan, 10).notice).toBe(false);
    const takt = monitorPageCount(SPIELPLAN_FALLBACK_SLIDE, t, view, undefined, listFrame(SPIELPLAN_FALLBACK_SLIDE, 10));
    const seiten = (n: boolean) => scheduleFieldLayout(view, 1, { overscan: 10, notice: n }).pages.length;
    expect(takt).toBe(seiten(true));
    // die Folie rechnet mit demselben Rahmen, unabhängig davon, ob der Hinweis gerade steht
    render(<ScheduleFieldSlide slide={SPIELPLAN_FALLBACK_SLIDE} {...withView(t)} theme="dark" style={{}} overscanPercent={10} page={0} />);
    expect(screen.getByText(`Seite 1 / ${String(takt)}`)).toBeInTheDocument();
  });
});

describe('@ME-067 @ZM-188 Die Seitenteilung richtet sich nach dem wirksamen Bildrand', () => {
  it('bei 10 % Rand passen weniger Zeilen auf eine Seite als bei 0 %, die Seitenzahl des Takts stimmt mit der Folie überein', () => {
    const t = listenTurnier({ namen: 'lang', verschoben: true });
    const { view } = withView(t);
    const seiten = (overscan: number) => nextMatchesLayout(view, 15, { overscan, notice: false }).pages;
    expect(seiten(10).length).toBeGreaterThan(seiten(0).length);
    expect(monitorPageCount(naechste, t, view, undefined, { overscan: 10, notice: false })).toBe(seiten(10).length);
    render(<NextMatchesSlide slide={naechste} {...withView(t)} theme="dark" style={{}} overscanPercent={10} page={seiten(10).length - 1} />);
    expect(screen.getByText(`Seite ${String(seiten(10).length)} / ${String(seiten(10).length)}`)).toBeInTheDocument();
  });

  it('der Hinweis oben nimmt Platz: mit Hinweis nie mehr Zeilen je Seite als ohne', () => {
    const { view } = withView(listenTurnier({ namen: 'lang' }));
    const maxZeilen = (notice: boolean) => Math.max(...scheduleFieldLayout(view, 1, { overscan: 5, notice }).pages.map(p => p.length));
    expect(maxZeilen(true)).toBeLessThanOrEqual(maxZeilen(false));
  });
});

describe('@ZM-188 Jede Zeile einer Listen-Folie liegt ganz im Bild', () => {
  const verschoben = (namen: ListenTurnierOptions['namen']) => listenTurnier({ namen, verschoben: true, gewertet: true });

  it('verschobenes Spiel: groß die neue Uhrzeit, klein „(war hh:mm)“ – in einer Zeile, ohne Umbruch (Nächste Spiele und Spielplan)', () => {
    const t = verschoben('kurz');
    for (const art of ['naechste', 'plan'] as const) {
      const seite = pageIndexOf((art === 'plan' ? scheduleFieldLayout(withView(t).view, 1) : nextMatchesLayout(withView(t).view, 15)).pages, 'liste-07');
      const zeile = zeigen(t, art, seite).find(z => z.id === 'liste-07')!.zeile;
      const uhr = zeile.querySelector<HTMLElement>('[data-testid="monitor-match-clock"]')!;
      const war = zeile.querySelector<HTMLElement>('[data-testid="monitor-match-original"]')!;
      expect(uhr).toHaveTextContent('10:22');
      expect(war).toHaveTextContent('(war 10:12)');
      expect(uhr.parentElement, 'eine Zeile: Uhrzeit und Zusatz teilen sich eine Reihe').toBe(war.parentElement);
      expect(uhr.parentElement!.style.display).toBe('flex');
      expect(uhr.parentElement!.style.whiteSpace).toBe('nowrap');
      expect(parseFloat(uhr.style.fontSize)).toBeGreaterThan(parseFloat(war.style.fontSize));
    }
  });

  it('Gegenbeispiel: ohne Verschiebung steht kein „(war …)“ in der Zeile', () => {
    const t = listenTurnier({});
    render(<NextMatchesSlide slide={naechste} {...withView(t)} theme="dark" style={{}} />);
    expect(screen.queryByTestId('monitor-match-original')).toBeNull();
  });

  it.each(['kurz', 'lang'] as const)('15 Spiele, Namen %s: jedes Spiel steht auf genau einer Seite, „Seite x / y“ zeigt die Seiten, nie mehr als 4 Spiele je Seite', (namen) => {
    const t = verschoben(namen);
    const { view } = withView(t);
    const pages = scheduleFieldLayout(view, 1).pages;
    expect(pages.flat().map(m => m.id).sort()).toEqual(t.matches.map(m => m.id).sort());
    expect(Math.max(...pages.map(p => p.length))).toBeLessThanOrEqual(4);
    expect(monitorPageCount(plan, t, view)).toBe(pages.length);
    expect(pages.length).toBeGreaterThanOrEqual(4);
    render(<ScheduleFieldSlide slide={plan} {...withView(t)} theme="dark" style={{}} page={1} />);
    expect(screen.getByText(`Seite 2 / ${String(pages.length)}`)).toBeInTheDocument();
  });

  it('lange Namen (45–50 Zeichen): nie mehr Spiele je Seite als bei kurzen Namen, die Schrift bleibt gleich', () => {
    const kurz = scheduleFieldLayout(withView(listenTurnier({ namen: 'kurz' })).view, 1).pages;
    const lang = scheduleFieldLayout(withView(listenTurnier({ namen: 'lang' })).view, 1).pages;
    expect(lang.length).toBeGreaterThanOrEqual(kurz.length);
    expect(Math.max(...lang.map(p => p.length))).toBeLessThanOrEqual(Math.max(...kurz.map(p => p.length)));
    const sizes = new Set<string>();
    for (const namen of ['kurz', 'lang'] as const) {
      render(<NextMatchesSlide slide={naechste} {...withView(listenTurnier({ namen }))} theme="dark" style={{}} />);
      screen.getAllByTestId('monitor-match-row').forEach(r => { sizes.add(r.querySelector<HTMLElement>('[data-teamname]')!.style.fontSize); });
      cleanup();
    }
    expect(sizes.size).toBe(1);
  });

  it('„Nächste Spiele“ blättert wie der Spielplan: acht Spiele mit langen Namen ergeben mehrere Seiten, jede Paarung auf genau einer', () => {
    const t = listenTurnier({ namen: 'lang', beendet: 2 });
    const { view } = withView(t);
    const pages = nextMatchesLayout(view, 8).pages;
    expect(pages.length).toBeGreaterThanOrEqual(2);
    expect(pages.flat()).toHaveLength(8);
    expect(new Set(pages.flat().map(m => m.id)).size).toBe(8);
    expect(monitorPageCount(slide('next-matches', { matchCount: 8 }), t, view)).toBe(pages.length);
  });
});

describe('@ZM-188 Namen mit Bindestrich brechen vor dem Bindestrich-Wort, solange es in eine Zeile passt', () => {
  const zeigeName = (name: string) => {
    const t0 = listenTurnier({ beendet: 5 });
    const t = { ...t0, teams: t0.teams.map((tm, i) => (i === 0 ? { ...tm, name } : tm)) };
    render(<NextMatchesSlide slide={naechste} {...withView(t)} theme="dark" style={{}} />);
    return Array.from(document.querySelectorAll<HTMLElement>('[data-teamname]')).find(el => el.textContent?.includes(name.split(' ').at(-1) ?? ''))!;
  };

  it('„Nordheim-Süd“ bleibt zusammen (nowrap), der Text bleibt unverändert mit echtem Bindestrich', () => {
    const el = zeigeName('Hallenfreunde Nordheim-Süd');
    expect(el.textContent).toBe('Hallenfreunde Nordheim-Süd');
    const zusammen = Array.from(el.querySelectorAll<HTMLElement>('span')).filter(sp => sp.style.whiteSpace === 'nowrap');
    expect(zusammen.map(sp => sp.textContent)).toEqual(['Nordheim-Süd']);
  });

  it('Gegenbeispiel: ein zu langes Wort („Oberweiler-Niederstetten“ mit 24 Zeichen bei Rand 10 %) darf am Bindestrich brechen, kein nowrap', () => {
    const el = zeigeName('Eintracht Oberweiler-Niederstetten');
    expect(Array.from(el.querySelectorAll<HTMLElement>('span')).some(sp => sp.style.whiteSpace === 'nowrap' && sp.textContent?.includes('Niederstetten'))).toBe(false);
  });

  it('die Zeilenschätzung kennt das: „Hallenfreunde Nordheim-Süd“ braucht bei knapper Breite zwei Zeilen, nie drei', () => {
    expect(nameLines('Hallenfreunde Nordheim-Süd', 16)).toBe(2);
    expect(nameLines('Oberweiler-Niederstetten', 16)).toBe(2);
  });
});

describe('@ZM-151 @ZM-187 VISUAL-DESIGN § 8: der Stand ist mindestens 1,5 × Namensschrift und so groß und fett wie die Uhrzeit', () => {
  const vh = (wert: string): number => parseFloat(wert);

  it('Spielplan: Stand (auch „-:-“) ≥ 1,5 × Teamname, ≥ Uhrzeit, mindestens so fett; Breite in jeder Zeile fest', () => {
    const t = listenTurnier({ beendet: 5, gewertet: true });
    const zeilen = zeigen(t, 'plan', seiteVonSpiel6(t, 'plan'));
    expect(zeilen.length).toBeGreaterThan(2);
    for (const z of zeilen) {
      const spalte = z.zeile.querySelector<HTMLElement>('[data-testid="monitor-match-separator"]')!;
      const stand = z.zeile.querySelector<HTMLElement>('[data-testid="monitor-match-score"]')!;
      const name = z.zeile.querySelector<HTMLElement>('[data-teamname]')!;
      const uhr = z.zeile.querySelector<HTMLElement>('[data-testid="monitor-match-clock"]')!;
      expect(vh(stand.style.fontSize), `${z.id}: Stand ≥ 1,5 × Namensschrift`).toBeGreaterThanOrEqual(1.5 * vh(name.style.fontSize));
      expect(vh(stand.style.fontSize), `${z.id}: Stand ≥ Uhrzeit`).toBeGreaterThanOrEqual(vh(uhr.style.fontSize));
      expect(spalte.style.flex, `${z.id}: feste Breite`).toBe(`0 0 ${displayList.separatorWidth}`);
      expect(spalte.style.fontSize, `${z.id}: die Breite in em gilt für die Namensschrift, nicht für die Standschrift`).toBe(name.style.fontSize);
    }
    // geplante Spiele („-:-“) und beendete tragen dieselbe Größe und Breite
    expect(new Set(zeilen.map(z => z.zeile.querySelector<HTMLElement>('[data-testid="monitor-match-score"]')!.style.fontSize)).size).toBe(1);
  });

  it('fett wie die Uhrzeit: Stand mit Ergebnis ist bold, die Uhrzeit semibold – der Stand nie dünner', () => {
    const t = listenTurnier({ beendet: 5 });
    const zeile = zeigen(t, 'plan', 0)[0].zeile;
    expect(zeile.querySelector<HTMLElement>('[data-testid="monitor-match-score"]')!.style.fontWeight).toBe(cssVars.fontWeights.bold);
  });

  it('Zeilenhöhe fest: eine Zeile mit „(4:3 i. E.)“ hat dieselbe Mindesthöhe wie jede andere (kurze Namen), der Strafstoß hängt außerhalb des Flusses', () => {
    const t = listenTurnier({ beendet: 5, strafstoss: true });
    const zeilen = zeigen(t, 'plan', 0);
    expect(zeilen.some(z => z.zeile.querySelector('[data-testid="monitor-match-extra"]') !== null)).toBe(true);
    expect(new Set(zeilen.map(z => z.zeile.style.minHeight)).size).toBe(1);
    const extra = zeilen.map(z => z.zeile.querySelector<HTMLElement>('[data-testid="monitor-match-extra"]')).find(e => e !== null)!;
    expect(extra.style.position).toBe('absolute');
  });

  it('Mittelachse: Uhrzeit-Zeile, Namen und Stand sind Teil einer mittig ausgerichteten Zeile; Zusätze hängen absolut darunter', () => {
    const t = listenTurnier({ beendet: 5, gewertet: true });
    const zeile = zeigen(t, 'plan', 0)[0].zeile;
    expect(zeile.style.alignItems).toBe('center');
    expect(zeile.querySelector<HTMLElement>('[data-testid="monitor-match-zusatz"]')!.style.position).toBe('absolute');
  });
});

describe('@ZM-187 Die Zeile für den Strafstoß ist je Folie reserviert, nicht je Spiel', () => {
  it('Finalrunde in „Alle Tabellen“: offene und beendete Finalspiele tragen dieselbe reservierte Zeile (die Zeile wird nicht höher, wenn ein Finalspiel endet)', async () => {
    const { AllStandingsSlide } = await import('../slides/AllStandingsSlide');
    const t0 = listenTurnier({ beendet: 3 });
    const t = { ...t0, matches: t0.matches.map(m => (m.matchNumber !== undefined && m.matchNumber >= 4 && m.matchNumber <= 6
      ? { ...m, phase: 'final' as const, isFinal: true, label: 'Halbfinale', ...(m.matchNumber === 4 ? { matchStatus: 'finished' as const, scoreA: 1, scoreB: 0, decidedBy: 'regular' as const } : {}) }
      : m)) };
    const { view } = withView(t);
    render(<AllStandingsSlide tournament={t} view={view} theme="dark" style={{}} page={1} />);
    const zeilen = screen.getAllByTestId('monitor-match-row');
    expect(zeilen.length).toBe(3);
    // offene und beendete Finalspiele: dieselbe Mindesthöhe, die Zeile wird nicht höher, wenn ein Finalspiel endet
    expect(new Set(zeilen.map(z => z.style.minHeight)).size).toBe(1);
  });
});

describe('C-MONITOR-FINALRUNDE-OHNE-SEITEN @ZM-185 Die Finalrunde blättert nach gemessener Höhe, Tabellen zuerst', () => {
  it('6 Finalspiele mit langen Namen: mehrere Finalseiten hinter der Tabelle, jedes Spiel auf genau einer, der Takt kennt dieselbe Seitenzahl', () => {
    const t = listenTurnier({ namen: 'lang', beendet: 3, finale: 6 });
    const { view } = withView(t);
    const abschnitte = standingsSections(t, view);
    expect(abschnitte[0].kind, 'Tabellen zuerst').not.toBe('finals');
    const finalSeiten = abschnitte.filter((a): a is Extract<typeof a, { kind: 'finals' }> => a.kind === 'finals');
    expect(finalSeiten.length).toBeGreaterThanOrEqual(2);
    expect(finalSeiten.flatMap(a => a.matches.map(m => m.id))).toHaveLength(6);
    expect(new Set(finalSeiten.flatMap(a => a.matches.map(m => m.id))).size).toBe(6);
    expect(abschnitte.slice(0, abschnitte.length - finalSeiten.length).every(a => a.kind !== 'finals')).toBe(true);
    expect(monitorPageCount(slide('all-standings'), t, view)).toBe(abschnitte.length);
  });

  it('Gegenbeispiel: 2 Finalspiele mit kurzen Namen bleiben auf einer Seite, ohne Finalspiele gibt es keine Finalseite', () => {
    const kurz = listenTurnier({ namen: 'kurz', beendet: 3, finale: 2 });
    expect(standingsSections(kurz, withView(kurz).view).filter(a => a.kind === 'finals')).toHaveLength(1);
    const keine = listenTurnier({ namen: 'kurz', beendet: 3 });
    expect(standingsSections(keine, withView(keine).view).filter(a => a.kind === 'finals')).toHaveLength(0);
  });

  const proSeiteListe = (t: ReturnType<typeof listenTurnier>, overscan: number) =>
    standingsSections(t, withView(t).view, { overscan, notice: false }).filter(a => a.kind === 'finals').map(a => (a.kind === 'finals' ? a.matches.length : 0));

  it('der Bildrand zählt: 4 Finalspiele mit kurzen Namen: bei 0 und 5 % eine Seite mit 4 (die Überschrift braucht weniger Höhe), bei 10 % gleichmäßig 2 + 2', () => {
    const t = listenTurnier({ namen: 'kurz', beendet: 3, finale: 4 });
    expect(proSeiteListe(t, 0)).toEqual([4]);
    expect(proSeiteListe(t, 5)).toEqual([4]);
    expect(proSeiteListe(t, 10)).toEqual([2, 2]);
  });

  it('Rückfall auf die Seitenteilung nach Höhe: passt eine gleichmäßig verteilte Seite nicht in die Bildhöhe (sehr ungleich hohe Zeilen), bleibt es bei der gemessenen Teilung', () => {
    const alle = [...withView(listenTurnier({ namen: 'kurz', beendet: 0, finale: 8 })).view.matches, ...withView(listenTurnier({ namen: 'lang', beendet: 0, finale: 8 })).view.matches];
    const cols = listColumns(true, false, alle);
    const rahmen = { overscan: 10, notice: false };
    const mitHoehe = (vh: number, nr: number) => ({ ...(alle.find(m => Math.abs(rowHeight(m, cols, rahmen) - vh) < 0.05)!), id: `ungleich-${String(nr)}` });
    // Zeilenhöhen 18,4 / 22,7 / 27,0 / 18,4 / 18,4 vh bei 10 % Rand: die Höhen kommen aus dem Modell, nicht aus festen Pixeln
    const spiele = [mitHoehe(18.4, 1), mitHoehe(22.7, 2), mitHoehe(27, 3), mitHoehe(18.4, 4), mitHoehe(18.4, 5)];
    const greedy = listPages(spiele, cols, Number.POSITIVE_INFINITY, rahmen);
    expect(greedy.map(p => p.length), 'Vorbedingung: nach Höhe 2 + 3').toEqual([2, 3]);
    // Die Seitenteilung nach Höhe hat das dritte Spiel nicht mehr auf die erste Seite gelegt: die gleichmäßige erste Seite (3 Spiele) passt also nicht.
    expect(listPagesBalanced(spiele, cols, Number.POSITIVE_INFINITY, rahmen).map(p => p.map(m => m.id))).toEqual(greedy.map(p => p.map(m => m.id)));
  });

  it('gleichmäßig verteilt: die Seiten einer Finalrunde unterscheiden sich um höchstens ein Spiel („2 + 2“ statt „3 + 1“), für 3 bis 8 Spiele, kurze und lange Namen, 0/5/10 % Rand', () => {
    for (const namen of ['kurz', 'lang'] as const) {
      for (let n = 3; n <= 8; n += 1) {
        const t = listenTurnier({ namen, beendet: 3, finale: n });
        for (const rand of [0, 5, 10]) {
          const seiten = proSeiteListe(t, rand);
          expect(Math.max(...seiten) - Math.min(...seiten), `${namen} ${String(n)} Spiele, Rand ${String(rand)}: ${JSON.stringify(seiten)}`).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('6 Finalspiele mit langen Namen: 3 + 3 bei 0 und 5 %, 2 + 2 + 2 bei 10 % Rand', () => {
    const t = listenTurnier({ namen: 'lang', beendet: 3, finale: 6 });
    expect(proSeiteListe(t, 0)).toEqual([3, 3]);
    expect(proSeiteListe(t, 5)).toEqual([3, 3]);
    expect(proSeiteListe(t, 10)).toEqual([2, 2, 2]);
  });

  it('Render: AllStandingsSlide reicht den Bildrand durch – 4 Finalspiele zeigen bei 0 % vier Zeilen, bei 10 % zwei je Seite', async () => {
    const { AllStandingsSlide } = await import('../slides/AllStandingsSlide');
    const t = listenTurnier({ namen: 'kurz', beendet: 3, finale: 4 });
    const { view } = withView(t);
    const zeilenBei = (overscanPercent: number): number => {
      const { unmount } = render(<AllStandingsSlide tournament={t} view={view} theme="dark" style={{}} page={1} overscanPercent={overscanPercent} />);
      const n = screen.getAllByTestId('monitor-match-row').length;
      unmount();
      return n;
    };
    expect(zeilenBei(0)).toBe(4);
    expect(zeilenBei(10)).toBe(2);
  });

  it('Spielplan: die Seitenaufteilung bleibt höhenmodellgleich greedy (4 + 4 + 4 + 3 bei 15 Spielen), das Ausgleichen gilt nur für die Finalrunde', () => {
    const pages = scheduleFieldLayout(withView(listenTurnier({ namen: 'kurz', beendet: 3 })).view, 1).pages;
    expect(pages.map(p => p.length)).toEqual([4, 4, 4, 3]);
  });
});

describe('@ZM-104 @ZM-189 Kontrast der Zusätze unter dem Stand: „gewertet“ und „(4:3 i. E.)“ in der Textfarbe des Monitors', () => {
  it('dieselbe Farbe wie die Uhrzeit-Zelle (mit „(war …)“), mindestens 7:1 gegen die Zeilenfläche in Dark und Light', async () => {
    const { contrastRatio } = await import('../../../test/contrast');
    const { monitorThemes } = await import('../../../design-tokens');
    for (const theme of ['dark', 'light'] as const) {
      const strafstoss = listenTurnier({ beendet: 5, strafstoss: true });
      const { unmount } = render(<ScheduleFieldSlide slide={plan} {...withView(strafstoss)} theme={theme} style={{}} page={0} />);
      const extra = document.querySelector<HTMLElement>('[data-testid="monitor-match-extra"]')!;
      const zeit = extra.closest('[data-testid="monitor-match-row"]')!.querySelector<HTMLElement>('[data-testid="monitor-match-time"]')!;
      expect(extra.style.color, `${theme}: Strafstoß-Zeile`).toBe(zeit.style.color);
      unmount();
      const gewertet = mitSpiel6(listenTurnier({ beendet: 5 }), { matchStatus: 'finished', scoreA: 3, scoreB: 0, decidedBy: 'forfeit', forfeitAbsent: 'B' });
      const r = render(<ScheduleFieldSlide slide={plan} {...withView(gewertet)} theme={theme} style={{}} page={seiteVonSpiel6(gewertet, 'plan')} />);
      const note = document.querySelector<HTMLElement>('[data-testid="monitor-match-note"]')!;
      expect(note.style.color, `${theme}: „gewertet“`).toBe(zeit.style.color);
      r.unmount();
      expect(contrastRatio(monitorThemes[theme].text, monitorThemes[theme].surface), `${theme}: Text gegen Zeilenfläche`).toBeGreaterThanOrEqual(7);
    }
  });
});
