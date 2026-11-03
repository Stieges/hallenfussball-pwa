import type { LiveMatch } from '../live-cockpit/types';

/** Keine Live-Daten (Vorschau, Zuschauer ohne Abonnement): gemeinsame leere Liste, damit sich die Kennung nie ändert. */
export const NO_LIVE_MATCHES: ReadonlyMap<string, LiveMatch> = new Map();
