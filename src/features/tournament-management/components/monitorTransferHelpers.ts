/**
 * Hilfsfunktionen des Übernehmen-Dialogs (B-22, B-22b): Meldetexte zur Dateiprüfung, Ids für neue Monitore.
 */

import type { TFunction } from 'i18next';
import { MONITOR_CONFIG_MAX_BYTES } from '../../../core/services/monitorConfigTransfer';
import type { MonitorConfigImportError } from '../../../core/services/monitorConfigTransfer';

/** Größenlimit als Anzeigetext, aus der Konstante erzeugt (z. B. „256 KB“) */
export const SIZE_LIMIT_LABEL = `${MONITOR_CONFIG_MAX_BYTES / 1024} KB`;

export function importErrorMessage(t: TFunction<'tournament'>, error: MonitorConfigImportError): string {
  switch (error) {
    case 'too-large':
      return t('monitors.transfer.errors.tooLarge', { limit: SIZE_LIMIT_LABEL });
    case 'not-monitor-config':
      return t('monitors.transfer.errors.notMonitorConfig');
    case 'unsupported-version':
      return t('monitors.transfer.errors.unsupportedVersion');
    case 'invalid':
      return t('monitors.transfer.errors.invalid');
  }
}

export function newId(prefix: 'mon' | 'slide'): string {
  try {
    return `${prefix}-${crypto.randomUUID()}`;
  } catch {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
}

