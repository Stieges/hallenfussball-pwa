/**
 * Wächter um das Turnier-Fenster eines Helfer-Geräts (A-17c; @HE-055, @HE-070, @OB-053, @HE-098).
 *
 * Wirkt nur, wenn der Zugangs-Index dieses Geräts einen Eintrag für das Turnier hat (ein Gerät mit eigenem Turnier,
 * ein Konto oder die Leitung werden nie gesperrt, fragen nie ab). Dann:
 * - Anfrage offen / abgelehnt (@OB-053): „Wartet auf Freigabe …“ / „Anfrage abgelehnt“ – ohne Inhalte des Turniers und nicht
 *   die Seite für fehlendes Recht (der Inhalt wird gar nicht erst geladen).
 * - Entzogen (@HE-055 Zeile 1, @HE-098 Zeile 1): „Du hast keinen Zugriff mehr“, spätestens beim nächsten 2-s-Takt; nichts
 *   kann eingetragen werden.
 * - Nur zusehen (@HE-055 Zeile 2) und abgeschlossen (@HE-070): im Reiter „Live“ (Eintragen) die Endkarte, in den anderen
 *   Reitern bleibt der Inhalt lesbar, mit Hinweis oben (Endstand und Torschützen weiter lesen).
 * Der Start-Stand kommt sofort aus dem Index (auch ohne Netz), die Abfrage korrigiert ihn. Netzfehler ändern nichts.
 */
import { useContext, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/Button';
import { Icons } from '../../../components/ui/Icons';
import { EndStateCard } from '../../../components/ui/molecules/EndStateCard';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import type { HelperAccessView } from '../../../core/repositories/helperAccessRpc';
import { AuthContext } from '../../auth/context/authContextInstance';
import { findHelperAccessEntry } from '../helperAccessStore';
import { outcomeFromEntry, type HelperAccessOutcome } from '../helperAccessOutcome';
import { useHelperAccessStatus, type HelperStatusDeps } from '../useHelperAccessStatus';
import { JoinEndState } from './JoinEndState';
import { JoinNotice } from './JoinNotice';
import { JoinShell } from './JoinShell';

export interface HelperAccessGuardProps {
  tournamentId: string;
  /** Reiter des Turnier-Fensters; im Reiter `management` („Live“) wird eingetragen. */
  activeTab: string;
  children: ReactNode;
  /** Nur für Tests. */
  statusDeps?: HelperStatusDeps;
}

function endViewFor(outcome: HelperAccessOutcome, tournamentId: string): HelperAccessView | null {
  switch (outcome.kind) {
    case 'noAccess': return { view: 'noAccess' };
    case 'declined': return { view: 'declined', codeOpen: false };
    case 'expired': return { view: 'requestExpired' };
    case 'watchOnly': return { view: 'watchOnly', tournamentId };
    case 'closed': return { view: 'finalStandings', tournamentId };
    default: return null;
  }
}

export const HelperAccessGuard = ({ tournamentId, activeTab, children, statusDeps }: HelperAccessGuardProps) => {
  const { t } = useTranslation('helpers');
  const navigate = useNavigate();
  // Ohne Anmelde-Kontext (Tests, Einbettung) gibt es keinen Helfer-Zugang: durchlassen statt zu werfen
  const user = useContext(AuthContext)?.user ?? null;
  const deviceUserId = user?.isAnonymous === true ? user.id : null;
  const entry = deviceUserId ? findHelperAccessEntry(deviceUserId, tournamentId) : null;
  const polled = useHelperAccessStatus(tournamentId, {
    enabled: entry !== null,
    deviceUserId,
    initial: entry ? outcomeFromEntry(entry) : null,
    deps: statusDeps,
  });
  const outcome = entry ? polled.outcome ?? outcomeFromEntry(entry) : null;
  if (!outcome || outcome.kind === 'allowed' || outcome.kind === 'none') {
    return <>{children}</>;
  }

  const go = (path: string) => void navigate(path);
  const readOnlyNotice = outcome.kind === 'watchOnly' || outcome.kind === 'closed';
  if (readOnlyNotice && activeTab !== 'management') {
    return (
      <>
        <div style={{ padding: cssVars.spacing.md }}>
          <JoinNotice
            tone="info"
            icon={outcome.kind === 'watchOnly' ? <Icons.Eye size={iconSizeValues.sm} /> : <Icons.Info size={iconSizeValues.sm} />}
            title={t(outcome.kind === 'watchOnly' ? 'join.end.watchOnly.title' : 'join.end.finalStandings.title')}
            text={t(outcome.kind === 'watchOnly' ? 'join.end.watchOnly.text' : 'join.end.finalStandings.text')}
            data-testid="helper-guard-notice"
          />
        </div>
        {children}
      </>
    );
  }

  const view = endViewFor(outcome, tournamentId);
  return (
    <JoinShell>
      {outcome.kind === 'pending' ? (
        <EndStateCard
          tone="info"
          icon={<Icons.Info size={iconSizeValues.md} />}
          title={t('join.guard.pending.title')}
          text={t('join.guard.pending.text')}
          action={(
            <Button variant="primary" fullWidth onClick={() => go('/')} style={{ minHeight: cssVars.touchTargets.primary, fontSize: cssVars.fontSizes.lg }} data-primary data-testid="join-home">
              {t('join.home')}
            </Button>
          )}
          data-testid="helper-guard-pending"
        />
      ) : view ? (
        <JoinEndState
          view={view}
          onNavigate={go}
          onHome={() => go('/')}
          onRecheck={() => undefined}
        />
      ) : null}
    </JoinShell>
  );
};
