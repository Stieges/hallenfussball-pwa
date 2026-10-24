/**
 * Zuschauer-Schalter (B-14, @ZM-001): EIN Satz für Zuschauer-Seite, Monitore und öffentliches PDF (Record Zuschauer und
 * Monitor, Tabelle „Zuschauer“). Gespeichert in `tournaments.config`; fehlt ein Schlüssel, gilt die Vorbelegung aus
 * `publicContentDefaults.json` -- dieselbe Datei prüft der Container-Beweis gegen `public_view.switches` am Server
 * (scripts/public-payload-check.sh). Nur ein echter Wahrheitswert zählt, alles andere ist die Vorbelegung. Rein, ohne React.
 *
 * Schlüssel in `config`: `hideScoresForPublic` (Kindermodus), `hideRankingsForPublic` (Gruppentabellen und Finalrunde mit
 * Herkunft aus), `publicLiveScore` (Live-Stand laufender Spiele), `publicEvents` (Ereignisse je Spiel), `publicScorers`
 * (Torschützen – Zwischenstand). Der Spielplan hat keinen Schalter.
 */
import defaults from './publicContentDefaults.json';

export interface PublicContentSwitches {
  /** Kindermodus: überstimmt alle Schalter, nichts Wertendes ist öffentlich */
  kidsMode: boolean;
  /** Gruppentabellen und Finalrunde mit Herkunft */
  tables: boolean;
  /** Live-Stand laufender Spiele */
  liveScore: boolean;
  /** Ereignisse je Spiel (Tore, Karten, Zeitstrafen) */
  events: boolean;
  /** Torschützen – Zwischenstand */
  scorers: boolean;
}

export const PUBLIC_CONTENT_DEFAULTS: Readonly<PublicContentSwitches> = Object.freeze({ ...defaults });

function flag(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** Schalter eines Turniers aus `tournaments.config` (beliebiges JSON). */
export function publicContentSwitchesOf(config: unknown): PublicContentSwitches {
  const raw = (typeof config === 'object' && config !== null ? config : {}) as Record<string, unknown>;
  return {
    kidsMode: flag(raw.hideScoresForPublic, PUBLIC_CONTENT_DEFAULTS.kidsMode),
    tables: !flag(raw.hideRankingsForPublic, !PUBLIC_CONTENT_DEFAULTS.tables),
    liveScore: flag(raw.publicLiveScore, PUBLIC_CONTENT_DEFAULTS.liveScore),
    events: flag(raw.publicEvents, PUBLIC_CONTENT_DEFAULTS.events),
    scorers: flag(raw.publicScorers, PUBLIC_CONTENT_DEFAULTS.scorers),
  };
}
