/**
 * Hinweis „Das Turnier ist abgeschlossen“ (R3-3, @LZ-036, @LZ-037): steht dort, wo sonst etwas zu ändern wäre. Nur
 * Darstellung -- ob das Turnier abgeschlossen ist, entscheidet der Aufrufer (`useTournamentClosed`, `useCan`).
 */
import { useTranslation } from 'react-i18next';
import { InlineNotice } from './InlineNotice';

export interface TournamentClosedHintProps {
  /** Wird beim Erscheinen vorgelesen (nur der eine Kasten oben auf der Seite; Vorgabe aus). */
  live?: boolean;
  /** Test-ID; Vorgabe `tournament-closed-hint`. */
  'data-testid'?: string;
}

export const TournamentClosedHint = ({ live = false, 'data-testid': testId = 'tournament-closed-hint' }: TournamentClosedHintProps) => {
  const { t } = useTranslation('tournament');
  return (
    <InlineNotice tone="info" live={live} data-testid={testId}>
      {t('rights.closedHint')}
    </InlineNotice>
  );
};
