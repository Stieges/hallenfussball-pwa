/**
 * monitorConfigTransfer – Export, Import-Prüfung und Übernahme (B-22)
 * @see docs/anforderungen/2026-10-03_monitor-einrichten.md (@ME-039 bis @ME-042, @ME-058)
 */

import { describe, it, expect } from 'vitest';
import type { TournamentMonitor, MonitorSlide, SlideConfig } from '../../../types/monitor';
import type { Sponsor } from '../../../types/sponsor';
import {
  exportMonitorConfig,
  importMonitorConfig,
  instantiateMonitorConfig,
  HALLEN_STANDARD,
  MONITOR_CONFIG_MAX_BYTES,
} from '../monitorConfigTransfer';

const NOW = '2026-10-15T10:00:00.000Z';

function slide(overrides: Partial<MonitorSlide>): MonitorSlide {
  return {
    id: 'slide-src',
    type: 'live',
    config: {},
    duration: null,
    order: 0,
    ...overrides,
  };
}

function monitor(overrides: Partial<TournamentMonitor> = {}): TournamentMonitor {
  return {
    id: 'mon-src',
    name: 'Hallenmonitor Halle',
    defaultSlideDuration: 15,
    transition: 'fade',
    transitionDuration: 500,
    theme: 'dark',
    performanceMode: 'auto',
    overscanPercent: 7.5,
    slides: [
      slide({ id: 's-live', type: 'live', config: { fieldId: 'field-1' }, order: 0 }),
      slide({ id: 's-table', type: 'standings', config: { groupId: 'A' }, duration: 20, order: 1 }),
      slide({ id: 's-sponsor', type: 'sponsor', config: { sponsorId: 'sp-nord' }, order: 2 }),
    ],
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

const sponsorNord: Sponsor = { id: 'sp-nord', name: 'Bäckerei Krume' } as Sponsor;
const sponsorSued: Sponsor = { id: 'sp-sued', name: 'bäckerei krume ' } as Sponsor;

function idGenerator() {
  let n = 0;
  return (prefix: 'mon' | 'slide') => `${prefix}-new-${++n}`;
}

describe('exportMonitorConfig', () => {
  it('enthält keine Monitor-, Slide- oder Turnier-IDs, Teams oder Links (@ME-040)', () => {
    const payload = exportMonitorConfig([monitor({ name: 'Eingang' })], [sponsorNord]);
    const json = JSON.stringify(payload);

    expect(json).not.toContain('mon-src');
    expect(json).not.toContain('s-live');
    expect(json).not.toContain('sp-nord');
    expect(json).not.toMatch(/teams|matches|monitorUrl|http/i);
    expect(payload.kind).toBe('monitor-config');
    expect(payload.version).toBe(1);
  });

  it('übernimmt Dauer, Übergang, Bildrand und Reihenfolge, ersetzt die Sponsor-ID durch den Namen', () => {
    const payload = exportMonitorConfig([monitor()], [sponsorNord]);
    const [exported] = payload.monitors;

    expect(exported.defaultSlideDuration).toBe(15);
    expect(exported.transition).toBe('fade');
    expect(exported.overscanPercent).toBe(7.5);
    expect(exported.slides.map(s => s.type)).toEqual(['live', 'standings', 'sponsor']);
    expect(exported.slides[1].duration).toBe(20);
    expect(exported.slides[2].config).toEqual({ sponsorName: 'Bäckerei Krume' });
  });

  it('lässt Sponsor-Folien weg, deren Sponsor im Turnier fehlt', () => {
    const payload = exportMonitorConfig([monitor()], []);
    expect(payload.monitors[0].slides.map(s => s.type)).toEqual(['live', 'standings']);
  });

  it('exportiert den eigenen QR-Link (qrTarget custom + customQrUrl, @ME-063)', () => {
    const payload = exportMonitorConfig(
      [monitor({ slides: [slide({ type: 'qr-code', config: { qrTarget: 'custom', customQrUrl: 'https://sv-nord.de' } })] })],
      []
    );
    const config = payload.monitors[0].slides[0].config;
    expect(config.qrTarget).toBe('custom');
    expect(config.customQrUrl).toBe('https://sv-nord.de');
  });
});

describe('importMonitorConfig', () => {
  it('nimmt einen Export unverändert an (Rundweg)', () => {
    const json = JSON.stringify(exportMonitorConfig([monitor()], [sponsorNord]));
    const result = importMonitorConfig(json);
    expect(result.ok).toBe(true);
  });

  it('nimmt die Vorlage „Hallen-Standard“ an', () => {
    const result = importMonitorConfig(JSON.stringify(HALLEN_STANDARD));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.monitors[0].slides.map(s => s.type))
        .toEqual(['live', 'next-matches', 'all-standings', 'qr-code']);
    }
  });

  it('lehnt eine Datei über dem Größenlimit ab (ohne sie zu lesen)', () => {
    const big = JSON.stringify({ kind: 'monitor-config', version: 1, pad: 'x'.repeat(MONITOR_CONFIG_MAX_BYTES) });
    expect(importMonitorConfig(big)).toEqual({ ok: false, error: 'too-large' });
  });

  it.each([
    ['kein JSON', 'das ist kein JSON'],
    ['JSON-Zahl', '5'],
    ['JSON null', 'null'],
    ['fremdes JSON ohne Art', JSON.stringify({ version: 1, monitors: [] })],
    ['andere Art', JSON.stringify({ kind: 'team-list', version: 1, monitors: [] })],
  ])('lehnt %s als „keine Monitor-Einstellungen“ ab, ohne etwas zu ändern', (_label, text) => {
    expect(importMonitorConfig(text)).toEqual({ ok: false, error: 'not-monitor-config' });
  });

  it('lehnt eine unbekannte Version mit eigener Meldung ab', () => {
    const v2 = JSON.stringify({ kind: 'monitor-config', version: 2, monitors: [] });
    expect(importMonitorConfig(v2)).toEqual({ ok: false, error: 'unsupported-version' });
    const noVersion = JSON.stringify({ kind: 'monitor-config', monitors: [] });
    expect(importMonitorConfig(noVersion)).toEqual({ ok: false, error: 'unsupported-version' });
  });

  it.each([
    ['keine Monitore', { monitors: [] }],
    ['Dauer außerhalb der Grenze', { monitors: [{ ...monitorJson(), defaultSlideDuration: 0 }] }],
    ['Sponsor-Folie ohne Sponsornamen', { monitors: [monitorJsonWith([{ type: 'sponsor', config: {}, duration: null }])] }],
    ['unbekannter Folientyp', { monitors: [monitorJsonWith([{ type: 'evil', config: {}, duration: null }])] }],
  ])('lehnt kaputte Inhalte ab (%s)', (_label, body) => {
    const text = JSON.stringify({ kind: 'monitor-config', version: 1, ...body });
    expect(importMonitorConfig(text)).toEqual({ ok: false, error: 'invalid' });
  });

  it('nimmt einen eigenen QR-Link aus der Datei an (wird beim Übernehmen verworfen, @ME-063)', () => {
    const body = { monitors: [monitorJsonWith([{ type: 'qr-code', config: { qrTarget: 'custom', customQrUrl: 'https://sv-nord.de' }, duration: null }])] };
    const result = importMonitorConfig(JSON.stringify({ kind: 'monitor-config', version: 1, ...body }));
    expect(result.ok).toBe(true);
  });

  it('verwirft fremde Felder wie Teams oder Monitor-Links', () => {
    const text = JSON.stringify({
      kind: 'monitor-config',
      version: 1,
      teams: [{ name: 'Fremd' }],
      monitors: [{ ...monitorJson(), id: 'mon-fremd', monitorUrl: 'https://fremd.example/x' }],
    });
    const result = importMonitorConfig(text);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(JSON.stringify(result.payload)).not.toMatch(/Fremd|mon-fremd|fremd\.example/);
    }
  });
});

describe('instantiateMonitorConfig', () => {
  it('legt neue Monitore mit neuen IDs an und ordnet Sponsoren über den Namen zu (@ME-039)', () => {
    const payload = exportMonitorConfig([monitor()], [sponsorNord]);
    const { monitors, skippedSponsors } = instantiateMonitorConfig(payload, {
      sponsors: [sponsorSued],
      existingNames: [],
      generateId: idGenerator(),
      now: NOW,
    });

    expect(skippedSponsors).toEqual([]);
    expect(monitors).toHaveLength(1);
    const [target] = monitors;
    expect(target.id).toBe('mon-new-1');
    expect(target.id).not.toBe('mon-src');
    expect(target.name).toBe('Hallenmonitor Halle');
    expect(target.overscanPercent).toBe(7.5);
    expect(target.slides.map(s => s.id)).toEqual(['slide-new-2', 'slide-new-3', 'slide-new-4']);
    expect(target.slides.map(s => s.order)).toEqual([0, 1, 2]);
    expect(target.slides[2].config.sponsorId).toBe('sp-sued');
    expect(target.slides[2].config).not.toHaveProperty('sponsorName');
    expect(target.createdAt).toBe(NOW);
  });

  it('überspringt Sponsor-Folien, deren Sponsor fehlt, und meldet den Namen (@ME-041)', () => {
    const payload = exportMonitorConfig([monitor()], [sponsorNord]);
    const { monitors, skippedSponsors } = instantiateMonitorConfig(payload, {
      sponsors: [],
      existingNames: [],
      generateId: idGenerator(),
      now: NOW,
    });

    expect(skippedSponsors).toEqual(['Bäckerei Krume']);
    expect(monitors[0].slides.map(s => s.type)).toEqual(['live', 'standings']);
  });

  it('vergibt bei Namenskonflikt einen Zusatz, auch wenn der Name lang ist', () => {
    const longName = 'N'.repeat(50);
    const payload = exportMonitorConfig([monitor({ name: longName })], []);
    const { monitors } = instantiateMonitorConfig(payload, {
      sponsors: [],
      existingNames: ['Hallenmonitor Halle', longName],
      generateId: idGenerator(),
      now: NOW,
    });
    expect(monitors[0].name).toBe(`${'N'.repeat(46)} (2)`);
    expect(monitors[0].name.length).toBe(50);
  });

  it('nummeriert bei Konflikten weiter und gleicht Groß-/Kleinschreibung ab', () => {
    const payload = exportMonitorConfig([monitor({ name: 'Halle' })], []);
    const { monitors } = instantiateMonitorConfig(payload, {
      sponsors: [],
      existingNames: ['halle', 'HALLE (2)'],
      generateId: idGenerator(),
      now: NOW,
    });
    expect(monitors[0].name).toBe('Halle (3)');
  });

  it('übernimmt die Vorlage „Hallen-Standard“ ohne Sponsor und ohne Turnierdaten (@ME-058)', () => {
    const { monitors, skippedSponsors } = instantiateMonitorConfig(HALLEN_STANDARD, {
      sponsors: [],
      existingNames: [],
      generateId: idGenerator(),
      now: NOW,
    });
    expect(skippedSponsors).toEqual([]);
    expect(monitors[0].slides.map(s => s.type)).toEqual(['live', 'next-matches', 'all-standings', 'qr-code']);
    expect(monitors[0].slides[1].config.matchCount).toBe(3);
  });

  it('nutzt den Standard-Bildrand, wenn die Datei keinen angibt', () => {
    const payload = exportMonitorConfig([monitor({ overscanPercent: undefined })], []);
    const { monitors } = instantiateMonitorConfig(payload, {
      sponsors: [],
      existingNames: [],
      generateId: idGenerator(),
      now: NOW,
    });
    expect(monitors[0].overscanPercent).toBe(5);
  });
});

/** Gültiges Monitor-Objekt für Datei-Tests */
function monitorJson() {
  return {
    name: 'Eingang',
    defaultSlideDuration: 15,
    transition: 'fade',
    transitionDuration: 500,
    theme: 'dark',
    performanceMode: 'auto',
    slides: [{ type: 'live', config: {}, duration: null }],
  };
}

function monitorJsonWith(slides: unknown[]) {
  return { ...monitorJson(), slides };
}

// --- Fixrunde 1 (Opus-Review F4/F6): Treue des Exports, Rundweg, keine geteilten Objekte ---

describe('Treue von Export und Übernahme (Fixrunde F4, F6)', () => {
  it('sortiert die Folien nach order, auch wenn das Array anders liegt', () => {
    const shuffled = monitor({
      slides: [
        slide({ id: 'c', type: 'qr-code', config: {}, order: 2 }),
        slide({ id: 'a', type: 'live', config: { fieldId: 'field-2' }, order: 0 }),
        slide({ id: 'b', type: 'standings', config: { groupId: 'B' }, order: 1 }),
      ],
    });
    const payload = exportMonitorConfig([shuffled], []);
    expect(payload.monitors[0].slides.map(s => s.type)).toEqual(['live', 'standings', 'qr-code']);
  });

  it('exportiert groupId und fieldId', () => {
    const source = monitor({
      slides: [
        slide({ id: 'l', type: 'live', config: { fieldId: 'field-2' }, order: 0 }),
        slide({ id: 't', type: 'standings', config: { groupId: 'B' }, order: 1 }),
      ],
    });
    const [exported] = exportMonitorConfig([source], []).monitors;
    expect(exported.slides[0].config).toMatchObject({ fieldId: 'field-2' });
    expect(exported.slides[1].config).toMatchObject({ groupId: 'B' });
  });

  it('Rundweg Export → Datei → Import → Übernehmen erhält Folien, Felder und Gruppen bis auf IDs', () => {
    const source = monitor({
      overscanPercent: 8,
      slides: [
        slide({ id: 'l', type: 'live', config: { fieldId: 'field-2', whenIdle: { type: 'next-match', timeoutSeconds: 30 } }, order: 0 }),
        slide({ id: 'n', type: 'next-matches', config: { matchCount: 4 }, duration: 25, order: 1 }),
        slide({ id: 't', type: 'standings', config: { groupId: 'B' }, order: 2 }),
      ],
    });
    const text = JSON.stringify(exportMonitorConfig([source], [sponsorNord]));
    const parsed = importMonitorConfig(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {return;}

    const { monitors } = instantiateMonitorConfig(parsed.payload, {
      sponsors: [],
      existingNames: [],
      generateId: idGenerator(),
      now: NOW,
    });
    const [target] = monitors;
    expect(target.overscanPercent).toBe(8);
    expect(target.slides.map(({ type, duration, order, config }) => ({ type, duration, order, config }))).toEqual([
      { type: 'live', duration: null, order: 0, config: { fieldId: 'field-2', whenIdle: { type: 'next-match', timeoutSeconds: 30 } } },
      { type: 'next-matches', duration: 25, order: 1, config: { matchCount: 4 } },
      { type: 'standings', duration: null, order: 2, config: { groupId: 'B' } },
    ]);
  });

  it('teilt keine Objekte mit dem Quellturnier (@ME-044): Änderungen am Ziel verändern die Quelle nicht', () => {
    const source = monitor({
      slides: [
        slide({ id: 'l', type: 'live', config: { whenIdle: { type: 'next-match' } }, order: 0 }),
      ],
    });
    const before = structuredClone(source);
    const { monitors } = instantiateMonitorConfig(exportMonitorConfig([source], []), {
      sponsors: [],
      existingNames: [],
      generateId: idGenerator(),
      now: NOW,
    });

    const config = monitors[0].slides[0].config;
    if (config.whenIdle) {config.whenIdle.type = 'skip';}
    expect(source).toEqual(before);
  });

  // @ZM-152: Ablösung der Farbe je Monitor-Folie. Kein SQL (Produktion leer, keine Rückwärtskompatibilität): der Lesepfad verwirft
  // den Altschlüssel, der Schreibpfad schreibt ihn nie.
  describe('@ZM-152 Altschlüssel liveColorScheme', () => {
    const ALT = { preset: 'modern', homeColor: '#111111', awayColor: '#222222', useTeamColors: true };

    it('@ZM-152 eine Datei mit liveColorScheme lädt ohne ihn und übernimmt ihn nicht ins Turnier', () => {
      const datei = JSON.stringify({
        kind: 'monitor-config', version: 1,
        monitors: [{
          name: 'M', defaultSlideDuration: 10, transition: 'none', transitionDuration: 0, theme: 'dark', performanceMode: 'auto',
          slides: [{ type: 'live', config: { fieldId: 'field-2', liveColorScheme: ALT }, duration: null }],
        }],
      });
      const geladen = importMonitorConfig(datei);
      expect(geladen.ok).toBe(true);
      if (!geladen.ok) {return;}
      expect(geladen.payload.monitors[0].slides[0].config).toEqual({ fieldId: 'field-2' });
      const { monitors } = instantiateMonitorConfig(geladen.payload, { sponsors: [], existingNames: [], generateId: idGenerator(), now: NOW });
      expect(monitors[0].slides[0].config).toEqual({ fieldId: 'field-2' });
      expect(JSON.stringify(monitors)).not.toContain('liveColorScheme');
    });

    it('@ZM-152 ein gespeicherter Monitor mit Altschlüssel wird ohne ihn exportiert', () => {
      const alt = slide({ id: 'l', type: 'live', config: { fieldId: 'field-2', liveColorScheme: ALT } as unknown as SlideConfig, order: 0 });
      const text = JSON.stringify(exportMonitorConfig([monitor({ slides: [alt] })], []));
      expect(text).not.toContain('liveColorScheme');
      expect(text).toContain('field-2');
    });

    it('Gegenbeispiel: die übrigen Schlüssel der Live-Folie bleiben erhalten (Rotation pausieren)', () => {
      const geladen = importMonitorConfig(JSON.stringify({
        kind: 'monitor-config', version: 1,
        monitors: [{
          name: 'M', defaultSlideDuration: 10, transition: 'none', transitionDuration: 0, theme: 'dark', performanceMode: 'auto',
          slides: [{ type: 'live', config: { pauseRotationDuringMatch: false, liveColorScheme: ALT }, duration: null }],
        }],
      }));
      expect(geladen.ok && geladen.payload.monitors[0].slides[0].config).toEqual({ pauseRotationDuringMatch: false });
    });
  });
});

describe('Bildrand in Prozent (@ME-067, R-MS-2)', () => {
  const datei = (feld: Record<string, unknown>) => JSON.stringify({
    kind: 'monitor-config', version: 1,
    monitors: [{
      name: 'M', defaultSlideDuration: 10, transition: 'none', transitionDuration: 0,
      theme: 'dark', performanceMode: 'auto', slides: [{ type: 'qr-code', config: {}, duration: null }], ...feld,
    }],
  });
  const uebernehme = (text: string) => {
    const r = importMonitorConfig(text);
    if (!r.ok) { return r; }
    return instantiateMonitorConfig(r.payload, { sponsors: [], existingNames: [], generateId: () => 'x', now: NOW }).monitors[0];
  };

  it.each([0, 0.5, 5, 7.5, 10])('@ME-067 Rand %s % wird übernommen', (prozent) => {
    expect(uebernehme(datei({ overscanPercent: prozent }))).toMatchObject({ overscanPercent: prozent });
  });

  it.each([-0.5, 10.5, 50, 5.3])('@ME-067 Gegenbeispiel: Rand %s % liegt außerhalb 0–10 oder nicht im Schritt 0,5 und wird abgelehnt', (prozent) => {
    expect(importMonitorConfig(datei({ overscanPercent: prozent }))).toEqual({ ok: false, error: 'invalid' });
  });

  it('@ME-067 Gegenbeispiel: das alte Feld overscanPx wird nicht übernommen, es gilt die Vorgabe 5 %', () => {
    const monitor = uebernehme(datei({ overscanPx: 48 }));
    expect(monitor).toMatchObject({ overscanPercent: 5 });
    expect(monitor).not.toHaveProperty('overscanPx');
  });

  it('@ME-067 die Vorlage „Hallen-Standard“ hat 5 %', () => {
    expect(HALLEN_STANDARD.monitors[0].overscanPercent).toBe(5);
  });
});
