/**
 * Bildrand am Monitor in Prozent, Adressparameter und Markierungen (Paket MS2).
 * Szenarien: @ME-067 (Rand 5 % vorbelegt, jeder Folientyp, Rand 0 % schneidet nichts ab), @ME-020 (breiterer Rand wirkt
 * am Monitor nach dem nächsten Abruf), Adressparameter `?rand=` (R-MS-3), Markierungen `data-monitor` (VISUAL-DESIGN § 4).
 * Die Testwerte stehen im Gherkin: Auflösungen 1920×1080 und 1280×720, Rand 5 % = 96/54 und 64/36 Bildpunkte.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';
import type { SlideType } from '../../../types/monitor';
import { PERFORMANCE_PROFILES } from '../../../types/monitor';
import { attachMonitor, buildTournament, FIXTURE_SPONSOR, slide, withMonitor } from './monitorFixture';
import { SlideRenderer } from '../slides/SlideRenderer';
import { maxPixelVerschiebung, randAusAdresse, wirksamerRand } from '../overscan';

const { supabaseGet, localGet } = vi.hoisted(() => ({ supabaseGet: vi.fn(), localGet: vi.fn() }));

vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { from: vi.fn(() => ({ upsert: vi.fn().mockResolvedValue({}) })), rpc: vi.fn().mockResolvedValue({ error: null }) },
}));
vi.mock('../../../core/repositories/SupabaseRepository', () => ({
  SupabaseRepository: vi.fn(function SupabaseRepository() { return { get: supabaseGet }; }),
}));
vi.mock('../../../core/repositories/LocalStorageRepository', () => ({
  LocalStorageRepository: vi.fn(function LocalStorageRepository() { return { get: localGet }; }),
}));
vi.mock('qrcode.react', async () => {
  const React = await import('react');
  return { QRCodeSVG: ({ value }: { value: string }) => React.createElement('svg', { 'data-testid': 'qr-code', 'data-value': value }) };
});
vi.mock('../../../hooks/useLiveMatches', () => ({
  useLiveMatches: () => ({
    liveMatches: new Map(), runningMatches: [], pausedMatches: [], runningMatchIds: new Set<string>(),
    getMatchById: () => undefined, lastGoalEvent: null, clearLastGoalEvent: vi.fn(),
    lastCardEvent: null, clearLastCardEvent: vi.fn(), calculateElapsedSeconds: () => 0,
  }),
}));

import { MonitorDisplayPage } from '../MonitorDisplayPage';

const FOLIEN: ReadonlyArray<{ typ: SlideType; config: Parameters<typeof slide>[1] }> = [
  { typ: 'live', config: { fieldId: 'field-1' } },
  { typ: 'live', config: { fieldId: 'field-2' } },
  { typ: 'standings', config: { groupId: 'A' } },
  { typ: 'schedule-field', config: { fieldId: 'field-1' } },
  { typ: 'next-matches', config: { matchCount: 3 } },
  { typ: 'all-standings', config: {} },
  { typ: 'sponsor', config: { sponsorId: 'sp-1', showQrCode: true } },
  { typ: 'custom-text', config: { headline: 'Rand' } },
  { typ: 'qr-code', config: {} },
];

const turnier = (): Tournament => buildTournament({ sponsors: [FIXTURE_SPONSOR] });

function rendereFolie(typ: SlideType, config: Parameters<typeof slide>[1], overscanPercent?: number) {
  const { container } = render(
    <SlideRenderer
      slide={slide(typ, config)}
      tournament={turnier()}
      performanceSettings={PERFORMANCE_PROFILES.high}
      theme="dark"
      overscanPercent={overscanPercent}
    />,
  );
  return container;
}

/** Rand in Bildpunkten, so wie der Browser ihn auflöst: Prozent der Folienbreite bzw. -höhe. */
function randInBildpunkten(el: HTMLElement, breite: number, hoehe: number) {
  const prozent = (wert: string, bezug: number) => (parseFloat(wert) / 100) * bezug;
  return {
    links: prozent(el.style.paddingLeft, breite),
    rechts: prozent(el.style.paddingRight, breite),
    oben: prozent(el.style.paddingTop, hoehe),
    unten: prozent(el.style.paddingBottom, hoehe),
  };
}

describe('Bildrand je Folie (@ME-067)', () => {
  it.each(FOLIEN)('@ME-067 Folie $typ ist ohne Einstellung mit 5 % je Seite eingerückt', ({ typ, config }) => {
    const wurzel = rendereFolie(typ, config).firstElementChild as HTMLElement;
    expect(wurzel.style.paddingTop).toBe('5cqh');
    expect(wurzel.style.paddingBottom).toBe('5cqh');
    expect(wurzel.style.paddingLeft).toBe('5cqw');
    expect(wurzel.style.paddingRight).toBe('5cqw');
  });

  it.each([
    { aufloesung: '1920×1080', breite: 1920, hoehe: 1080, seitlich: 96, oben: 54 },
    { aufloesung: '1280×720', breite: 1280, hoehe: 720, seitlich: 64, oben: 36 },
  ])('@ME-067 bei $aufloesung liegt der Inhalt $seitlich Bildpunkte von links/rechts und $oben von oben/unten entfernt', ({ breite, hoehe, seitlich, oben }) => {
    for (const { typ, config } of FOLIEN) {
      const wurzel = rendereFolie(typ, config).lastElementChild as HTMLElement;
      const rand = randInBildpunkten(wurzel, breite, hoehe);
      expect(rand).toEqual({ links: seitlich, rechts: seitlich, oben, unten: oben });
    }
  });

  it('@ME-067 Gegenbeispiel: Rand 0 % lässt keinen Rand stehen, die Folie bleibt die volle Fläche', () => {
    const wurzel = rendereFolie('custom-text', { headline: 'Rand' }, 0).firstElementChild as HTMLElement;
    expect(randInBildpunkten(wurzel, 1920, 1080)).toEqual({ links: 0, rechts: 0, oben: 0, unten: 0 });
    expect(wurzel.style.width).toBe('100%');
    expect(wurzel.style.height).toBe('100%');
  });

  it('@ME-067 Gegenbeispiel: ein Wert außerhalb 0–10 % (z. B. alter Wert 48) fällt auf die Vorbelegung 5 % zurück', () => {
    const wurzel = rendereFolie('custom-text', { headline: 'Rand' }, 48).firstElementChild as HTMLElement;
    expect(wurzel.style.paddingTop).toBe('5cqh');
  });

  it('@ME-067 die Seite ist der Größen-Container, auf den sich der Rand in cqh/cqw bezieht', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    window.history.replaceState(null, '', '/#/display/tour-1/mon-1');
    localGet.mockResolvedValue(attachMonitor(turnier(), withMonitor({ slides: [slide('custom-text', { headline: 'Rand' })] })));
    const { container } = render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    const behaelter = container.querySelector<HTMLElement>('[lang="de"] > div > div')!;
    expect(behaelter.style.containerType).toBe('size');
    vi.useRealTimers();
  });
});

describe('Bildrand wirkt nach dem Abruf (@ME-020)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseGet.mockResolvedValue(null);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    window.history.replaceState(null, '', '/#/display/tour-1/mon-1');
    // Das Gerät sagt das Anlassen des Bildschirms zu: kein Wachhalten-Hinweis, der die Folie nach unten rückt (@ME-006)
    const sentinel = { release: vi.fn().mockResolvedValue(undefined), addEventListener: vi.fn(), removeEventListener: vi.fn() };
    Object.defineProperty(navigator, 'wakeLock', { value: { request: vi.fn().mockResolvedValue(sentinel) }, configurable: true });
  });
  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(navigator, 'wakeLock');
    window.history.replaceState(null, '', '/');
  });

  const monitorMit = (overscanPercent?: number) => attachMonitor(turnier(), withMonitor({
    slides: [slide('custom-text', { headline: 'Rand' })],
    ...(overscanPercent === undefined ? {} : { overscanPercent }),
  }));
  const folie = (c: HTMLElement) => c.querySelector<HTMLElement>('[lang="de"] > div > div > div > div')!;
  const vorspulen = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

  it('@ME-020 Rand im Editor auf 8 % gestellt: der Monitor zeigt nach höchstens 10 Sekunden 8 % statt 5 %', async () => {
    localGet.mockResolvedValue(monitorMit());
    const { container } = render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" />);
    await vorspulen(0);
    expect(folie(container).style.paddingTop).toBe('5cqh');

    localGet.mockResolvedValue(monitorMit(8));
    await vorspulen(10_000);
    expect(folie(container).style.paddingTop).toBe('8cqh');
    expect(folie(container).style.paddingLeft).toBe('8cqw');
  });

  it('@ME-020 Gegenbeispiel: ohne Änderung im Editor bleibt der Rand auch nach dem Abruf bei 5 %', async () => {
    localGet.mockResolvedValue(monitorMit());
    const { container } = render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" />);
    await vorspulen(0);
    await vorspulen(10_000);
    expect(folie(container).style.paddingTop).toBe('5cqh');
  });

  it('?rand=0 überschreibt den gespeicherten Rand von 8 % nur für diese Sitzung', async () => {
    window.history.replaceState(null, '', '/#/display/tour-1/mon-1?rand=0');
    localGet.mockResolvedValue(monitorMit(8));
    const { container } = render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" />);
    await vorspulen(0);
    expect(parseFloat(folie(container).style.paddingTop)).toBe(0);
    expect(parseFloat(folie(container).style.paddingLeft)).toBe(0);
  });

  it('Gegenbeispiel: ?rand=50 liegt außerhalb 0–10 und wird ignoriert, der gespeicherte Wert 8 % gilt', async () => {
    window.history.replaceState(null, '', '/#/display/tour-1/mon-1?rand=50');
    localGet.mockResolvedValue(monitorMit(8));
    const { container } = render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" />);
    await vorspulen(0);
    expect(folie(container).style.paddingTop).toBe('8cqh');
  });
});

describe('Adressparameter ?rand= (R-MS-3)', () => {
  it.each([
    { hash: '#/display/t/m?rand=0', erwartet: 0 },
    { hash: '#/display/t/m?rand=10', erwartet: 10 },
    { hash: '#/display/t/m?rand=3.5', erwartet: 3.5 },
    { hash: '#/display/t/m?x=1&rand=7', erwartet: 7 },
    { hash: '#/display/t/m?rand=50', erwartet: null },
    { hash: '#/display/t/m?rand=10.5', erwartet: null },
    { hash: '#/display/t/m?rand=-1', erwartet: null },
    { hash: '#/display/t/m?rand=abc', erwartet: null },
    { hash: '#/display/t/m?rand=', erwartet: null },
    { hash: '#/display/t/m?rand=Infinity', erwartet: null },
    { hash: '#/display/t/m', erwartet: null },
  ])('im Hash $hash gilt $erwartet', ({ hash, erwartet }) => {
    expect(randAusAdresse(hash, '')).toBe(erwartet);
  });

  it('Rückfall: ?rand= vor dem Hash gilt, der Hash-Wert hat Vorrang', () => {
    expect(randAusAdresse('#/display/t/m', '?rand=4')).toBe(4);
    expect(randAusAdresse('#/display/t/m?rand=6', '?rand=4')).toBe(6);
    expect(randAusAdresse('#/display/t/m', '?rand=99')).toBeNull();
  });

  it('wirksamer Rand: Adresse vor gespeichert vor Vorbelegung', () => {
    expect(wirksamerRand(8, 0)).toBe(0);
    expect(wirksamerRand(8, null)).toBe(8);
    expect(wirksamerRand(undefined, null)).toBe(5);
    expect(wirksamerRand(0, null)).toBe(0);
    expect(wirksamerRand(80, null)).toBe(5);
  });

  it('@ME-019 Einbrennschutz: ohne Rand keine Verschiebung, mit 5 % höchstens 2 Bildpunkte', () => {
    expect(maxPixelVerschiebung(0, 1080)).toBe(0);
    expect(maxPixelVerschiebung(5, 1080)).toBe(2);
  });
});

describe('Markierungen der Schrift-Rollen (data-monitor)', () => {
  const rollen = (container: HTMLElement, rolle: string) => container.querySelectorAll(`[data-monitor="${rolle}"]`);

  it('Live-Folie: Spielstand-Ziffern „stand“, Uhr „uhr“, Teamnamen ohne Markierung', () => {
    const c = rendereFolie('live', { fieldId: 'field-1' });
    expect(rollen(c, 'stand')).toHaveLength(2);
    expect(rollen(c, 'uhr')).toHaveLength(1);
    expect(c.querySelectorAll('[data-teamname]').length).toBeGreaterThan(0);
    c.querySelectorAll('[data-teamname]').forEach(el => expect(el.hasAttribute('data-monitor')).toBe(false));
  });

  it('Sponsor-Folie: „Mehr per QR“-Beschriftung ist „nah“, der Sponsorname ohne Markierung', () => {
    const c = rendereFolie('sponsor', { sponsorId: 'sp-1', showQrCode: true });
    expect(rollen(c, 'nah')).toHaveLength(1);
    expect(rollen(c, 'stand')).toHaveLength(0);
    expect(c.textContent).toContain('Bäckerei Maier');
    expect(c.querySelector('[data-monitor]')?.textContent).not.toContain('Bäckerei Maier');
  });

  it('QR-Folie: Beschriftung und Adresse sind „nah“, der Turniertitel ohne Markierung', () => {
    const c = rendereFolie('qr-code', {});
    expect(rollen(c, 'nah')).toHaveLength(2);
    const titel = Array.from(c.querySelectorAll('div')).find(d => d.textContent === 'Hallencup Nord');
    expect(titel?.hasAttribute('data-monitor')).toBe(false);
  });

  it('Gegenbeispiel: Lesetext-Folien (Nächste Spiele, Tabelle, Freitext) tragen keine Markierung', () => {
    for (const { typ, config } of FOLIEN.filter(f => ['next-matches', 'standings', 'custom-text', 'all-standings', 'schedule-field'].includes(f.typ))) {
      expect(rendereFolie(typ, config).querySelectorAll('[data-monitor]'), typ).toHaveLength(0);
    }
  });
});
