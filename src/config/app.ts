/**
 * App Configuration
 *
 * Zentrale Konfiguration für die Anwendung.
 * Hier können App-weite Einstellungen angepasst werden.
 */

export interface AppConfig {
  /** App-Titel für Dashboard-Header */
  title: string;
  /** Kurzer App-Name (z.B. für PWA) */
  shortName: string;
  /** App-Beschreibung */
  description: string;
  /** Version */
  version: string;
}

/**
 * Standard App-Konfiguration
 */
export const appConfig: AppConfig = {
  title: 'Turnierverwaltung',
  shortName: 'Turniere',
  description: 'Professionelle Turnierverwaltung für Hallenturniere',
  version: '1.0.0',
};

/**
 * Gibt den App-Titel zurück
 */
export function getAppTitle(): string {
  return appConfig.title;
}

/**
 * Gibt den kurzen App-Namen zurück
 */
export function getAppShortName(): string {
  return appConfig.shortName;
}
