/**
 * Monitor-Einstellungen als Datei herunterladen (B-22, @ME-040)
 */

import type { Tournament } from '../../types/tournament';
import { exportMonitorConfig } from '../../core/services/monitorConfigTransfer';

export function downloadMonitorConfig(tournament: Tournament): void {
  const payload = exportMonitorConfig(tournament.monitors ?? [], tournament.sponsors ?? []);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'monitor-einstellungen.json';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
