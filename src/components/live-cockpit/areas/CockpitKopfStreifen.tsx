/**
 * CockpitKopfStreifen: die Zeilen unter der Anzeigetafel im normalen Fluss – Statuszeile (@FU-109), Hinweise zum Hallen-Lautsprecher (H4-12), Berechtigungs-Banner, Ausgangs-Hinweis (W1)
 * und die Übergabe-Zeile (B-50). Aus `LiveCockpit.tsx` gelöst (H4-12), Verhalten gleich; Hinweise sperren und verdecken nichts.
 */
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { AwaitingServerCopyLine } from '../../../features/collaboration';
import { OutboxNotice } from '../../../features/collaboration/outbox/OutboxNotice';
import type { OutboxStatus } from '../../../core/match/client/outboxTypes';
import { CockpitHallHinweis } from '../../../features/hallenton/ui/CockpitHallHinweis';
import shell from '../LiveCockpitShell.module.css';

export interface CockpitKopfStreifenProps {
  tournamentId: string;
  matchId: string;
  /** Feld des Spiels (`field-N`) und ob es noch nicht angepfiffen ist: Hinweise zum Hallen-Lautsprecher (H4-12). */
  feldId: string | undefined;
  vorAnpfiff: boolean;
  /** Kein Steuerrecht: das Banner steht, außer die Zeile der Leiste sagt es schon (B-49, `steuerung`). */
  readOnly: boolean;
  fremdGesteuert: boolean;
  outboxStatus: OutboxStatus;
  onOutboxReload: () => void;
  /** Anzahl übergebener Einträge, wenn das Gerät nur noch zusieht (B-50), sonst `null`. */
  nurZusehen: number | null;
}

export function CockpitKopfStreifen({ tournamentId, matchId, feldId, vorAnpfiff, readOnly, fremdGesteuert, outboxStatus, onOutboxReload, nurZusehen }: CockpitKopfStreifenProps): ReactElement {
  const { t } = useTranslation('cockpit');
  return (
    <>
      {/* @FU-109: Statuszeile im normalen Fluss unter der Anzeigetafel (Review Version-Fix R1) */}
      <AwaitingServerCopyLine tournamentId={tournamentId} />
      {/* H4-12: ruhige Hinweise zum Hallen-Lautsprecher (@HT-034, @HT-036, @HT-040, @HT-050); erscheinen nur mit eingerichtetem Lautsprecher am Feld */}
      <CockpitHallHinweis tournamentId={tournamentId} feldId={feldId} vorAnpfiff={vorAnpfiff} />
      {/* Task R2: Read-Only-Banner — nur bei fehlender Berechtigung, nicht bei beendetem Spiel und nicht bei fremd gesteuertem Feld (B-49: Zeile in der Leiste). */}
      {readOnly && !fremdGesteuert && (
        <div className={shell.readOnlyBanner} data-testid="cockpit-readonly-banner" role="status">
          {t('readOnly.banner')}
        </div>
      )}
      {/* W1 (Nachtrag C3a-2a): rendert selbst nichts, solange kein Ausgangs-Zustand vorliegt. */}
      <OutboxNotice status={outboxStatus} matchId={matchId} onReload={onOutboxReload} />
      {nurZusehen !== null && <p className={shell.readOnlyBanner} data-testid="cockpit-uebergeben-zusehen" role="status">{t('leiste.nurZusehen', { count: nurZusehen })}</p>}
    </>
  );
}
