/**
 * Monitor-Konfiguration exportieren, prüfen und übernehmen (B-22, H1.4). Rein, kein React.
 * Die Datei enthält keine Teams, Spiele, Ergebnisse, IDs oder Monitor-Links; Sponsor-Folien
 * werden über den Namen zugeordnet. Import = nicht vertrauenswürdig (Größe, Art, Version, Schema).
 * @see docs/anforderungen/2026-10-03_monitor-einrichten.md (@ME-039 bis @ME-046, @ME-058)
 */

import { z } from 'zod';
import type { MonitorSlide, SlideConfig, TournamentMonitor } from '../../types/monitor';
import { DEFAULT_MONITOR } from '../../types/monitor';
import type { Sponsor } from '../../types/sponsor';

// --- KONSTANTEN ---

export const MONITOR_CONFIG_KIND = 'monitor-config' as const;
export const MONITOR_CONFIG_VERSION = 1 as const;
/** Größenlimit für Import-Dateien (256 KB) */
export const MONITOR_CONFIG_MAX_BYTES = 256 * 1024;

const MONITOR_NAME_MAX_LENGTH = 50;
const MAX_MONITORS = 20;
const MAX_SLIDES_PER_MONITOR = 50;

// --- SCHEMA (Datei-Format) ---

const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

const transferSlideConfigSchema = z.object({
  groupId: z.string().max(100).optional(),
  fieldId: z.string().max(100).optional(),
  whenIdle: z.object({ type: z.enum(['next-match', 'last-result', 'top-scorers', 'sponsor', 'skip']), timeoutSeconds: z.number().int().min(5).max(600).optional() }).optional(),
  pauseRotationDuringMatch: z.boolean().optional(),
  matchCount: z.number().int().min(1).max(10).optional(),
  numberOfPlayers: z.number().int().min(1).max(20).optional(),
  // Nur Name, keine Sponsor-ID: fremde IDs haben im Zielturnier keine Bedeutung
  sponsorName: z.string().trim().min(1).max(100).optional(),
  showQrCode: z.boolean().optional(),
  // 'custom' ist bewusst nicht erlaubt: fremde Ziel-URLs werden nicht übernommen
  qrTarget: z.enum(['tournament', 'sponsor-website']).optional(),
  headline: z.string().max(100).optional(),
  body: z.string().max(500).optional(),
  textAlign: z.enum(['left', 'center', 'right']).optional(),
  colorScheme: z.enum(['default', 'highlight', 'urgent', 'celebration']).optional(),
  liveColorScheme: z.object({
    preset: z.enum(['classic', 'nature', 'contrast', 'modern', 'alternative', 'custom']),
    homeColor: hexColorSchema, awayColor: hexColorSchema, useTeamColors: z.boolean(),
  }).optional(),
});

const transferSlideSchema = z.object({
  type: z.enum(['live', 'standings', 'all-standings', 'schedule-group', 'schedule-field',
    'next-matches', 'top-scorers', 'sponsor', 'custom-text', 'qr-code']),
  config: transferSlideConfigSchema,
  duration: z.number().int().min(1).max(300).nullable(),
}).superRefine((slide, ctx) => {
  if (slide.type === 'sponsor' && !slide.config.sponsorName) {
    ctx.addIssue({ code: 'custom', path: ['config', 'sponsorName'], message: 'Sponsor fehlt' });
  }
});

const transferMonitorSchema = z.object({
  name: z.string().trim().min(1).max(MONITOR_NAME_MAX_LENGTH),
  defaultSlideDuration: z.number().int().min(1).max(300),
  transition: z.enum(['fade', 'slide', 'none']),
  transitionDuration: z.number().int().min(0).max(5000),
  theme: z.enum(['light', 'dark', 'auto']),
  performanceMode: z.enum(['auto', 'high', 'low']),
  overscanPx: z.number().int().min(0).max(80).optional(),
  slides: z.array(transferSlideSchema).max(MAX_SLIDES_PER_MONITOR),
});

const monitorConfigSchema = z.object({
  kind: z.literal(MONITOR_CONFIG_KIND),
  version: z.literal(MONITOR_CONFIG_VERSION),
  monitors: z.array(transferMonitorSchema).min(1).max(MAX_MONITORS),
});

export type TransferSlideConfig = z.infer<typeof transferSlideConfigSchema>;
export type TransferSlide = z.infer<typeof transferSlideSchema>;
export type TransferMonitor = z.infer<typeof transferMonitorSchema>;
export type MonitorConfigPayload = z.infer<typeof monitorConfigSchema>;

// --- VORLAGE ---

/**
 * Vorlage „Hallen-Standard“ (@ME-058): Live-Spiel auf Feld 1, Nächste Spiele, Tabellen aller Gruppen, Zuschauer-QR.
 * Der Monitorname ist ein i18n-Schlüssel; die UI setzt den sichtbaren Namen (monitors.transfer.templateMonitorName).
 */
export const HALLEN_STANDARD: MonitorConfigPayload = {
  kind: MONITOR_CONFIG_KIND,
  version: MONITOR_CONFIG_VERSION,
  monitors: [
    {
      name: 'hallen-standard',
      defaultSlideDuration: 15,
      transition: 'fade',
      transitionDuration: 500,
      theme: 'dark',
      performanceMode: 'auto',
      overscanPx: 48,
      slides: [
        { type: 'live', config: { fieldId: 'field-1' }, duration: null },
        { type: 'next-matches', config: { matchCount: 3 }, duration: null },
        { type: 'all-standings', config: {}, duration: null },
        { type: 'qr-code', config: {}, duration: null },
      ],
    },
  ],
};

// --- EXPORT ---

/** Kopie eines flachen Objekts, damit Datei und Ziel keine Referenzen auf das Quellturnier teilen (@ME-044) */
function copyOf<T extends object>(value: T | undefined): T | undefined {
  return value === undefined ? undefined : { ...value };
}

function exportSlideConfig(config: SlideConfig, sponsorName: string | undefined): TransferSlideConfig {
  return {
    groupId: config.groupId, fieldId: config.fieldId, whenIdle: copyOf(config.whenIdle),
    pauseRotationDuringMatch: config.pauseRotationDuringMatch, matchCount: config.matchCount,
    numberOfPlayers: config.numberOfPlayers, sponsorName, showQrCode: config.showQrCode,
    qrTarget: config.qrTarget === 'custom' ? undefined : config.qrTarget,
    headline: config.headline, body: config.body, textAlign: config.textAlign,
    colorScheme: config.colorScheme, liveColorScheme: copyOf(config.liveColorScheme),
  };
}

/**
 * Exportiert die Monitore eines Turniers als Datei-Payload.
 * Sponsor-Folien, deren Sponsor im Turnier nicht (mehr) existiert, werden nicht exportiert.
 */
export function exportMonitorConfig(
  monitors: readonly TournamentMonitor[],
  sponsors: readonly Sponsor[],
): MonitorConfigPayload {
  const sponsorNameById = new Map(sponsors.map(s => [s.id, s.name]));

  const exportSlide = (slide: MonitorSlide): TransferSlide | null => {
    const sponsorName = slide.config.sponsorId ? sponsorNameById.get(slide.config.sponsorId) : undefined;
    if (slide.type === 'sponsor' && !sponsorName) {return null;}
    return { type: slide.type, config: exportSlideConfig(slide.config, sponsorName), duration: slide.duration };
  };

  return {
    kind: MONITOR_CONFIG_KIND,
    version: MONITOR_CONFIG_VERSION,
    monitors: monitors.map(monitor => ({
      name: monitor.name.slice(0, MONITOR_NAME_MAX_LENGTH),
      defaultSlideDuration: monitor.defaultSlideDuration,
      transition: monitor.transition,
      transitionDuration: monitor.transitionDuration,
      theme: monitor.theme,
      performanceMode: monitor.performanceMode,
      overscanPx: monitor.overscanPx,
      slides: [...monitor.slides]
        .sort((a, b) => a.order - b.order)
        .map(exportSlide)
        .filter((slide): slide is TransferSlide => slide !== null),
    })),
  };
}

// --- IMPORT (Datei = nicht vertrauenswürdig) ---

export type MonitorConfigImportError =
  | 'too-large'
  | 'not-monitor-config'
  | 'unsupported-version'
  | 'invalid';

export type MonitorConfigImportResult =
  | { ok: true; payload: MonitorConfigPayload }
  | { ok: false; error: MonitorConfigImportError };

/**
 * Prüft den Text einer Monitor-Datei. Verändert nichts; das Ergebnis entscheidet der Aufrufer.
 *
 * Reihenfolge: Größe → JSON → Art (`kind`) → Version → Schema.
 */
export function importMonitorConfig(text: string): MonitorConfigImportResult {
  if (new TextEncoder().encode(text).byteLength > MONITOR_CONFIG_MAX_BYTES) {
    return { ok: false, error: 'too-large' };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'not-monitor-config' };
  }

  if (typeof raw !== 'object' || raw === null || !('kind' in raw) || raw.kind !== MONITOR_CONFIG_KIND) {
    return { ok: false, error: 'not-monitor-config' };
  }

  if (!('version' in raw) || raw.version !== MONITOR_CONFIG_VERSION) {
    return { ok: false, error: 'unsupported-version' };
  }

  const parsed = monitorConfigSchema.safeParse(raw);
  return parsed.success ? { ok: true, payload: parsed.data } : { ok: false, error: 'invalid' };
}

// --- ÜBERNEHMEN (Payload -> neue Monitore des Zielturniers) ---

export interface InstantiateMonitorConfigOptions {
  /** Sponsoren des Zielturniers (Zuordnung über den Namen) */
  sponsors: readonly Sponsor[];
  /** Namen der bereits vorhandenen Monitore im Zielturnier */
  existingNames: readonly string[];
  generateId: (prefix: 'mon' | 'slide') => string;
  now: string;
}

export interface InstantiateMonitorConfigResult {
  /** Neue Monitore mit neuen IDs; noch keinem Bildschirm zugeordnet */
  monitors: TournamentMonitor[];
  /** Namen der Sponsoren, die im Zielturnier fehlen (Folien übersprungen, @ME-041) */
  skippedSponsors: string[];
}

function uniqueName(base: string, taken: Set<string>): string {
  let candidate = base;
  let counter = 2;
  while (taken.has(candidate.toLowerCase())) {
    const suffix = ` (${counter})`;
    candidate = `${base.slice(0, MONITOR_NAME_MAX_LENGTH - suffix.length)}${suffix}`;
    counter += 1;
  }
  taken.add(candidate.toLowerCase());
  return candidate;
}

function toSlideConfig(config: TransferSlideConfig, sponsorId: string | undefined): SlideConfig {
  return {
    groupId: config.groupId, fieldId: config.fieldId, whenIdle: copyOf(config.whenIdle),
    pauseRotationDuringMatch: config.pauseRotationDuringMatch, matchCount: config.matchCount,
    numberOfPlayers: config.numberOfPlayers, sponsorId, showQrCode: config.showQrCode,
    qrTarget: config.qrTarget, headline: config.headline, body: config.body,
    textAlign: config.textAlign, colorScheme: config.colorScheme, liveColorScheme: copyOf(config.liveColorScheme),
  };
}

/**
 * Baut aus einem geprüften Payload neue Monitore für das Zielturnier.
 * Teams, Spiele und Tabellen kommen aus dem Zielturnier (sie stehen nicht im Payload).
 */
export function instantiateMonitorConfig(
  payload: MonitorConfigPayload,
  options: InstantiateMonitorConfigOptions,
): InstantiateMonitorConfigResult {
  const taken = new Set(options.existingNames.map(name => name.toLowerCase()));
  const skippedSponsors: string[] = [];

  const monitors = payload.monitors.map((entry): TournamentMonitor => {
    const id = options.generateId('mon');
    const slides: MonitorSlide[] = [];

    for (const slide of entry.slides) {
      let sponsorId: string | undefined;
      if (slide.type === 'sponsor') {
        const wanted = (slide.config.sponsorName ?? '').trim().toLowerCase();
        const sponsor = options.sponsors.find(s => s.name.trim().toLowerCase() === wanted);
        if (!sponsor) {
          skippedSponsors.push(slide.config.sponsorName ?? '');
          continue;
        }
        sponsorId = sponsor.id;
      }
      slides.push({
        id: options.generateId('slide'),
        type: slide.type,
        config: toSlideConfig(slide.config, sponsorId),
        duration: slide.duration,
        order: slides.length,
      });
    }

    return {
      ...DEFAULT_MONITOR,
      id,
      name: uniqueName(entry.name, taken),
      defaultSlideDuration: entry.defaultSlideDuration,
      transition: entry.transition,
      transitionDuration: entry.transitionDuration,
      theme: entry.theme,
      performanceMode: entry.performanceMode,
      overscanPx: entry.overscanPx ?? DEFAULT_MONITOR.overscanPx,
      slides,
      createdAt: options.now,
      updatedAt: options.now,
    };
  });

  return { monitors, skippedSponsors };
}
