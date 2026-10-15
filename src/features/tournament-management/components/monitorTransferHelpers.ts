/**
 * Hilfsfunktionen des Übernehmen-Dialogs (B-22, B-22b): Meldetexte zur Dateiprüfung, Ids für neue Monitore.
 */

import type { TFunction } from 'i18next';
import { importMonitorConfig, MONITOR_CONFIG_MAX_BYTES } from '../../../core/services/monitorConfigTransfer';
import type { MonitorConfigImportError, MonitorConfigPayload } from '../../../core/services/monitorConfigTransfer';

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

export type TransferFileResult = { ok: true; payload: MonitorConfigPayload } | { ok: false; message: string };

/** Liest eine Monitor-Datei: Größe, Text, Prüfung. Fehler als fertiger Meldetext */
export async function readTransferFile(file: File, t: TFunction<'tournament'>): Promise<TransferFileResult> {
  // Größe vor dem Lesen prüfen; der Service prüft zusätzlich den Text
  if (file.size > MONITOR_CONFIG_MAX_BYTES) {return { ok: false, message: importErrorMessage(t, 'too-large') };}
  let text: string;
  try {
    text = await file.text();
  } catch {
    return { ok: false, message: t('monitors.transfer.errors.readFailed') };
  }
  const parsed = importMonitorConfig(text);
  return parsed.ok ? { ok: true, payload: parsed.payload } : { ok: false, message: importErrorMessage(t, parsed.error) };
}

export function newId(prefix: 'mon' | 'slide'): string {
  try {
    return `${prefix}-${crypto.randomUUID()}`;
  } catch {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
}

