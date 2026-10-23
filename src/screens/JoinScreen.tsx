/**
 * Beitritt per Helfer-QR-Code (A-17b, Route `/join/:code`, Mockup M-GA5 M1/M2, Tabelle § 3.2). Dünner Bildschirm: der Ablauf
 * steckt in `useJoinFlow` (Zustandsautomat aus A-17a), die Bilder in `features/helpers/components`. Eine Anfrage entsteht
 * erst beim Absenden des Namens; Konten werden nur nach Rückfrage und ohne wartende Einträge abgemeldet.
 * `/invite` (alte Einladungslinks) zeigt nur den Hinweis (`legacyInvite`, @HE-063).
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { JoinAccountDialog } from '../features/helpers/components/JoinAccountDialog';
import { JoinAccountWaiting } from '../features/helpers/components/JoinAccountWaiting';
import { JoinEndState } from '../features/helpers/components/JoinEndState';
import { JoinInfoCard } from '../features/helpers/components/JoinInfoCard';
import { JoinEntryForm } from '../features/helpers/components/JoinEntryForm';
import { JoinShell } from '../features/helpers/components/JoinShell';
import { JoinWaitingWatcher } from '../features/helpers/components/JoinWaitingWatcher';
import { helperFieldPath, spectatorPath } from '../features/helpers/joinPaths';
import { useJoinFlow } from '../features/helpers/useJoinFlow';
import type { JoinFlowDeps } from '../features/helpers/joinFlowSteps';
import type { HelperStatusDeps } from '../features/helpers/useHelperAccessStatus';

export interface JoinScreenProps {
  code: string;
  /** Nur für Tests: statt der echten Server-Aufrufe. */
  deps?: JoinFlowDeps;
  /** Nur für Tests: statt der echten Abfrage des Zugangsstatus (A-17c). */
  statusDeps?: HelperStatusDeps;
  /** Nur für Tests: statt des echten Ladens der lokalen Kopie („Offline bereit“, A-17c). */
  loadOfflineCopy?: (tournamentId: string) => Promise<boolean>;
}

/** `/invite`: alte Einladungslinks führen zu diesem Hinweis statt zu einer Anfrage (@HE-063). */
export const LegacyInviteScreen = () => {
  const navigate = useNavigate();
  return (
    <JoinShell>
      <JoinEndState
        view={{ view: 'oldInvite' }}
        onNavigate={(path) => void navigate(path)}
        onHome={() => void navigate('/')}
        onRecheck={() => undefined}
      />
    </JoinShell>
  );
};

export const JoinScreen = ({ code, deps, statusDeps, loadOfflineCopy }: JoinScreenProps) => {
  const { t } = useTranslation('helpers');
  const navigate = useNavigate();
  const flow = useJoinFlow(code, deps);
  const { state, meta, accountName } = flow;
  const go = (path: string) => void navigate(path);

  // @HE-095, @HE-098 Z.3: zugelassen und Turnier läuft → direkt das Feld öffnen, kein Zwischenbild.
  const openField = state.step === 'show' && state.view.view === 'openField' ? state.view : null;
  useEffect(() => {
    if (openField) {
      void navigate(helperFieldPath(openField.tournamentId, openField.field), { replace: true });
    }
  }, [openField, navigate]);

  // @HE-090: „Abbrechen“ → nichts gesendet, nicht abgemeldet; zurück zur Startseite (das Konto ist weiter angemeldet).
  const cancelled = state.step === 'cancelled';
  useEffect(() => {
    if (cancelled) {
      void navigate('/', { replace: true });
    }
  }, [cancelled, navigate]);

  const body = (() => {
    switch (state.step) {
      case 'loading':
        return <p data-testid="join-loading" role="status" aria-busy="true">{t('join.loading')}</p>;
      case 'form':
      case 'submitting':
        return (
          <JoinEntryForm
            state={state}
            onNameChange={flow.setName}
            onSubmit={flow.submit}
            onViewer={(shareCode) => go(spectatorPath(shareCode))}
            onPrivacy={() => go('/datenschutz')}
          />
        );
      case 'accountConfirm':
      case 'signingOut':
        return (
          <>
            <JoinEntryForm
              state={{ step: 'form', code: state.code, tournament: state.tournament, shareCode: state.shareCode, name: '', notice: null }}
              onNameChange={() => undefined}
              onSubmit={() => undefined}
              onViewer={() => undefined}
              onPrivacy={() => undefined}
            />
            <JoinAccountDialog accountName={accountName} busy={state.step === 'signingOut'} onContinue={flow.confirmSignOut} onCancel={flow.cancel} />
          </>
        );
      case 'accountWaiting':
        return (
          <>
            {meta.tournament ? <JoinInfoCard title={meta.tournament.title} date={meta.tournament.date} /> : null}
            <JoinAccountWaiting waitingCount={state.waitingCount} onRecheck={flow.recheck} />
          </>
        );
      case 'cancelled':
        return null;
      case 'show':
        return state.view.view === 'waiting' ? (
          <JoinWaitingWatcher
            tournament={meta.tournament}
            name={meta.name}
            checkNumber={state.view.checkNumber}
            deviceUserId={flow.deviceUserId}
            statusDeps={statusDeps}
            loadOfflineCopy={loadOfflineCopy}
            onNavigate={go}
            onHome={() => go('/')}
            onRecheck={flow.recheck}
          />
        ) : openField ? null : (
          <>
            {/* e5: die Leitung sieht die Turnierkarte; alle anderen Endkarten zeigen kein Turnier (@HE-004) */}
            {state.view.view === 'leader' && meta.tournament ? <JoinInfoCard title={meta.tournament.title} date={meta.tournament.date} /> : null}
            <JoinEndState
              view={state.view}
              tournament={meta.tournament}
              accountName={accountName}
              onNavigate={go}
              onHome={() => go('/')}
              onRecheck={flow.recheck}
            />
          </>
        );
    }
  })();

  return <JoinShell>{body}</JoinShell>;
};
