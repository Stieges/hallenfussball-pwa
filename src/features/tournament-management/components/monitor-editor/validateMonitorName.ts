/**
 * Namensprüfung eines Monitors (@ME-072, @ME-065): Pflicht, höchstens 50 Zeichen, nicht doppelt – ohne React.
 */

export const MONITOR_NAME_MAX_LENGTH = 50;

export type MonitorNameError = 'nameRequired' | 'nameTooLong' | 'duplicateName';

/**
 * @param name - eingegebener Name (wird getrimmt)
 * @param otherNames - Namen der ANDEREN Monitore (ohne den eigenen)
 */
export function validateMonitorName(name: string, otherNames: readonly string[]): MonitorNameError | null {
  const trimmed = name.trim();
  if (!trimmed) {
    return 'nameRequired';
  }
  if (trimmed.length > MONITOR_NAME_MAX_LENGTH) {
    return 'nameTooLong';
  }
  const lower = trimmed.toLowerCase();
  if (otherNames.some(other => other.trim().toLowerCase() === lower)) {
    return 'duplicateName';
  }
  return null;
}
