/**
 * Zustände des Endstand-Blocks ohne Liste (R3-5; @ET-045, Review #397 m-1): „wird geladen“, „nicht lesbar“ (mit „Erneut laden“),
 * „nicht gespeichert“ (die Zeile fehlt, z. B. nach entzogenem Zugang) und „Noch keine Ergebnisse“. Nie ein errechneter Ersatz.
 */
import { useTranslation } from 'react-i18next';
import { Icons } from '../../../components/ui/Icons';
import { iconSizeValues } from '../../../design-tokens';
import { secondaryButton, small, tightStack } from './finishStyles';

export type FinalStandingsStatusKind = 'loading' | 'unavailable' | 'missing' | 'empty';

export function FinalStandingsStatus({ kind, onRetry }: { kind: FinalStandingsStatusKind; onRetry?: () => void }) {
  const { t } = useTranslation('tournament');
  return (
    <div style={tightStack}>
      <p style={small} role={kind === 'empty' ? undefined : 'status'} data-testid={`final-standings-${kind}`}>{t(`finalStandings.${kind}`)}</p>
      {kind === 'unavailable' && onRetry !== undefined && (
        <button type="button" style={secondaryButton} onClick={onRetry} data-testid="final-standings-retry">
          <span>{t('finalStandings.retry')}</span>
          <Icons.Refresh size={iconSizeValues.sm} />
        </button>
      )}
    </div>
  );
}
