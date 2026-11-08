/**
 * Turnierkopie für den Hallenton nur lokal lesen (H3b-3 Fixrunde 1, W2): Abpfiff-Hupe (`matchCockpitSettings.soundId`),
 * Spielplan für „angepfiffen“ und Turnierende (`lifecycleStatus`). `tournamentRepository.get` (OfflineRepository) stößt bei
 * jedem Aufruf einen Abgleich mit der Cloud an – im 5-s-Takt des Lautsprechers und auf jedem leitenden Gerät wäre das ein
 * ganzer Turnier-Lesevorgang je Runde. Die lokale Kopie hält der übliche Abgleich der App aktuell.
 *
 * Weg: die rohe lokale Kopie wie `monitor-display/monitorDataSource.ts` (`new LocalStorageRepository().get`), ohne
 * Änderung an `OfflineRepository`. Nichts wirft; ohne Kopie `null`.
 */
import { LocalStorageRepository } from '../../core/repositories/LocalStorageRepository';
import type { Tournament } from '../../types/tournament';

export function ladeTurnierLokal(turnierId: string): Promise<Tournament | null> {
  return new LocalStorageRepository().get(turnierId).catch(() => null);
}
