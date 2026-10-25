/**
 * Dialog „Turnier abschließen“ (Plan R3-4 = B-33; Mockup Runde 2, 25.10.). Er zeigt, was der Abschluss-Dienst
 * (`useFinishTournament`) meldet – und sonst nichts: kein eigener Zustand für den Abschluss, nie ein Teilzustand (@LZ-024).
 *
 *   prüft → A „noch nicht möglich“ (Liste mit Sprungziel, Haupttaste „Zurück zur Verwaltung“, kein gesperrter Abschließen-Knopf)
 *         → B „bereit“ → Speichern läuft (Abbrechen und X gesperrt) → fertig (Dialog schließt, die Verwaltung zeigt Zustand C)
 *         → „nicht bestätigt“ / Fehler (Haupttaste „Erneut versuchen“)
 *   ohne Netz: Hinweis „Kein Netz“, Haupttaste gesperrt mit der Zeile „Abschließen geht erst mit Verbindung“ (@LZ-019); kommt das
 *   Netz zurück, prüft der Dialog von selbst neu.
 * Handy: Vollbild mit festem Fuß (Inhalt scrollt); breiter: zentriert, 560 px.
 */
import { useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Tournament } from '../../../types/tournament';
import type { FinishReady } from '../../../core/services/finishPreparation';
import { cssVars, dialogWidths, iconSizeValues } from '../../../design-tokens';
import type { FinishTournamentApi } from '../../../hooks/useFinishTournament';
import { useIsOnline } from '../../../hooks/useOnlineStatus';
import { Icons } from '../../../components/ui/Icons';
import { DialogSurface } from '../../../components/ui/molecules/DialogSurface';
import { InlineNotice } from '../../../components/ui/molecules/InlineNotice';
import { useBelowSheetWidth } from '../hooks/useBelowSheetWidth';
import { rejectionView } from '../model/finishRejection';
import { useFinishT } from '../hooks/useFinishT';
import { FinishBlockedBody } from './FinishBlockedBody';
import { FinishFooter } from './FinishFooter';
import { FinishReadyBody, type FinishReadyBodyProps } from './FinishReadyBody';
import { small, stack, strong, text } from './finishStyles';

export interface FinishTournamentDialogProps {
  isOpen: boolean;
  /** Der Stand für Namen und Zahlen (roh). */
  tournament: FinishReadyBodyProps['tournament'] & Pick<Tournament, 'id'>;
  finish: FinishTournamentApi;
  /** Schließt den Dialog (Abbrechen, X, Esc, „Zurück zur Verwaltung“); nie während des Speicherns. */
  onClose: () => void;
  /** Sprung zu einem offenen Punkt (der Aufrufer navigiert). */
  onJump: (target: string) => void;
  /** Stand neu laden (Antwort auf „Der Stand hat sich geändert“). */
  onReloadState: () => Promise<void>;
}

export function FinishTournamentDialog({ isOpen, tournament, finish, onClose, onJump, onReloadState }: FinishTournamentDialogProps) {
  const { t, i18n } = useTranslation('tournament');
  const tt = useFinishT();
  const titleId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null); // Start-Fokus auf den Titel (kein Fokusring um das X); Tab geht von dort weiter
  const phone = useBelowSheetWidth();
  const online = useIsOnline();
  const { state } = finish;
  const lastReady = useRef<FinishReady | null>(null);
  if (state.phase === 'confirming') {
    lastReady.current = state.ready;
  }
  const sending = state.phase === 'sending';

  // Beim Öffnen prüfen (neuer Durchlauf, neue request_id); beim Schließen verwerfen
  useEffect(() => {
    if (isOpen) {
      void finish.start();
    } else {
      lastReady.current = null;
      finish.reset();
    }
    // `finish.start/reset` sind stabil; der Dialog startet genau beim Öffnen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Kommt das Netz zurück, nachdem der Dialog ohne Netz geöffnet wurde, prüft er von selbst neu (@LZ-019: nichts wird nachgereicht)
  const offlineReject = state.phase === 'rejected' && state.reason.code === 'OFFLINE';
  useEffect(() => {
    if (isOpen && online && offlineReject) {
      void finish.start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, offlineReject, isOpen]);

  // Fertig: der Dialog schließt, die Verwaltung zeigt jetzt Zustand C (der Dienst hat neu geladen)
  const done = state.phase === 'done';
  useEffect(() => {
    if (isOpen && done) {
      onClose();
    }
  }, [isOpen, done, onClose]);

  const close = (): void => { if (!sending) { onClose(); } };
  const notice = (tone: 'warn' | 'info' | 'error', icon: React.ReactNode, title: string, body: string, testId: string) => (
    <InlineNotice tone={tone} icon={icon} data-testid={testId}>
      <span style={strong}>{title}</span>
      <span style={text}>{body}</span>
    </InlineNotice>
  );

  let body: React.ReactNode;
  let footer: React.ReactNode;
  const cancel = { label: t('finish.cancel'), onClick: close, disabled: sending };
  const retryFooter = (label: string, onClick: () => void) => (
    <FinishFooter phone={phone} secondary={cancel} primary={{ label, onClick, testId: 'tournament-finish-retry' }} />
  );

  if (state.phase === 'confirming' || state.phase === 'sending' || state.phase === 'unconfirmed') {
    const ready = state.phase === 'confirming' ? state.ready : lastReady.current;
    const unconfirmedText = state.phase === 'unconfirmed'
      ? [t('finish.unconfirmed.text'), state.serverLifecycle === undefined ? t('finish.unconfirmed.asking')
        : state.serverLifecycle === 'finished' ? t('finish.unconfirmed.finished')
          : state.serverLifecycle === null ? t('finish.unconfirmed.unknown') : t('finish.unconfirmed.running')].join(' ')
      : '';
    const top = state.phase === 'sending'
      ? <InlineNotice tone="info" data-testid="finish-sending"><span style={strong}>{t('finish.sending.title')}</span><span style={text}>{t('finish.sending.text')}</span></InlineNotice>
      : state.phase === 'unconfirmed'
        ? notice('warn', <Icons.AlertTriangle size={iconSizeValues.sm} />, t('finish.unconfirmed.title'), unconfirmedText, 'finish-unconfirmed')
        : !online ? notice('warn', <Icons.AlertTriangle size={iconSizeValues.sm} />, t('finish.offline.title'), t('finish.offline.text'), 'finish-offline') : undefined;
    body = ready === null ? null : <FinishReadyBody ready={ready} tournament={tournament} topNotice={top} showWarnings={state.phase !== 'sending'} />;
    footer = state.phase === 'unconfirmed'
      ? retryFooter(t('finish.error.retry'), () => { void finish.retry(); })
      : (
        <FinishFooter
          phone={phone} secondary={cancel} hint={sending ? t('finish.sending.hint') : !online ? t('finish.offline.hint') : undefined}
          primary={{
            label: sending ? t('finish.sending.button') : (<><Icons.Lock size={iconSizeValues.sm} />{t('finish.ready.confirm')}</>),
            onClick: () => { void finish.confirm(); }, disabled: !online, busy: sending, testId: 'tournament-finish-confirm',
          }}
        />
      );
  } else if (state.phase === 'rejected' && state.reason.code === 'OPEN_ITEMS') {
    body = <FinishBlockedBody items={state.reason.items} tournament={tournament} onJump={onJump} />;
    footer = <FinishFooter phone={phone} primary={{ label: t('finish.blocked.back'), onClick: onClose, testId: 'finish-back' }} />;
  } else if (state.phase === 'rejected' && state.reason.code === 'OFFLINE') {
    body = notice('warn', <Icons.AlertTriangle size={iconSizeValues.sm} />, t('finish.offline.title'), t('finish.offline.text'), 'finish-offline');
    footer = (
      <FinishFooter
        phone={phone} secondary={cancel} hint={t('finish.offline.hint')}
        primary={{ label: (<><Icons.Lock size={iconSizeValues.sm} />{t('finish.ready.confirm')}</>), onClick: () => undefined, disabled: true, testId: 'tournament-finish-confirm' }}
      />
    );
  } else if (state.phase === 'rejected') {
    const view = rejectionView(state.reason, tt, i18n.language);
    body = (
      <InlineNotice tone={view.tone === 'error' ? 'error' : view.tone === 'info' ? 'info' : 'warn'} data-testid="finish-error">
        {view.title !== null && <span style={strong}>{view.title}</span>}
        <span style={text}>{view.text}</span>
      </InlineNotice>
    );
    footer = view.action === 'close'
      ? <FinishFooter phone={phone} primary={{ label: state.reason.code === 'ALREADY_FINISHED' ? t('finish.error.alreadyFinishedClose') : t('finish.blocked.back'), onClick: onClose, testId: 'finish-back' }} />
      : view.action === 'reloadState'
        ? retryFooter(t('finish.error.staleButton'), () => { void onReloadState().then(() => finish.start()); })
        : retryFooter(t('finish.error.retry'), () => { void finish.start(); });
  } else {
    body = <p style={small} role="status" data-testid="finish-checking">{t('finish.checking')}</p>;
    footer = <FinishFooter phone={phone} secondary={cancel} primary={{ label: t('finish.ready.confirm'), onClick: () => undefined, disabled: true, testId: 'tournament-finish-confirm' }} />;
  }

  const barStyle = {
    display: 'flex', alignItems: 'center', gap: cssVars.spacing.sm, minHeight: cssVars.touchTargets.primary,
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm} ${cssVars.spacing.xs} ${cssVars.spacing.md}`,
    background: cssVars.colors.surfaceSolid, borderBottom: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`, flex: 'none',
  } as const;
  const header = (
    <div style={barStyle}>
      <h2 id={titleId} ref={titleRef} tabIndex={-1} style={{ outline: 'none', margin: 0, flex: 1, minWidth: 0, fontSize: cssVars.fontSizes.titleMd, lineHeight: 1.3, fontWeight: cssVars.fontWeights.bold, color: cssVars.colors.textPrimary }}>{t('finish.title')}</h2>
      <button
        type="button" aria-label={t('finish.close')} disabled={sending} onClick={close} data-testid="finish-close"
        style={{ flex: 'none', width: cssVars.touchTargets.minimum, height: cssVars.touchTargets.minimum, minWidth: cssVars.touchTargets.minimum, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, background: 'transparent', border: 'none', color: cssVars.colors.textSecondary, cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.5 : 1 }}
      >
        <Icons.X size={iconSizeValues.md} />
      </button>
    </div>
  );
  const content = <div style={stack} data-testid="finish-dialog-body">{body}</div>;

  // Handy: Vollbild; Kopf, scrollender Inhalt und Fuß sind direkte Kinder, der Fuß klebt unten (Safe-Area). Breiter: Kopf und Fuß als
  // Slots der Fläche – nur der Inhalt scrollt, die Haupttaste bleibt im Bild (S1, @OB-062).
  if (phone) {
    return (
      <DialogSurface isOpen={isOpen} onClose={close} dismissible={!sending} labelledBy={titleId} size="fullscreen" testId="finish-dialog" suppressEnter initialFocusRef={titleRef}>
        {header}
        <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', padding: cssVars.spacing.md }}>{content}</div>
        <div style={{ flex: 'none', padding: cssVars.spacing.md, paddingBottom: `calc(${cssVars.spacing.md} + env(safe-area-inset-bottom, 0px))`, borderTop: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`, background: cssVars.colors.surfaceSolid }}>{footer}</div>
      </DialogSurface>
    );
  }
  return (
    <DialogSurface
      isOpen={isOpen} onClose={close} dismissible={!sending} labelledBy={titleId} maxWidth={dialogWidths.md} testId="finish-dialog" suppressEnter initialFocusRef={titleRef}
      header={header} footer={footer}
    >
      <div style={{ padding: cssVars.spacing.md }}>{content}</div>
    </DialogSurface>
  );
}
