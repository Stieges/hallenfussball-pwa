/**
 * Einstieg am Helfer-Handy (A-17b, Mockup M1 `e1`/`e2`, @HE-033, @HE-001, @HE-015): Turnierkarte, Info „nur für Helfer“ mit
 * Weg zur Zuschauer-Ansicht (nur mit `shareCode`), Namensfeld, Haupttaste „Anfrage senden“ (56 px), Datenschutzhinweis.
 * Eine Anfrage entsteht erst beim Absenden des Namens (S-5). Fehler (kein Netz, 429, unerwartet) stehen als Hinweis
 * über dem Feld, der Name bleibt stehen, die Haupttaste heißt dann „Erneut versuchen“ (@HE-015).
 */
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/Button';
import { Icons } from '../../../components/ui/Icons';
import { CountedTextField } from '../../../components/ui/molecules/CountedTextField';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { HELPER_NAME_MAX_LENGTH, type JoinFlowState, type JoinFormNotice } from '../joinFlow';
import { JoinInfoCard } from './JoinInfoCard';
import { JoinNotice } from './JoinNotice';

type FormState = Extract<JoinFlowState, { step: 'form' | 'submitting' }>;

export interface JoinEntryFormProps {
  state: FormState;
  onNameChange: (name: string) => void;
  onSubmit: () => void;
  onViewer: (shareCode: string) => void;
  onPrivacy: () => void;
}

const NOTICE_KEYS: Partial<Record<JoinFormNotice, 'offline' | 'authRateLimited' | 'unexpected'>> = {
  offline: 'offline',
  authRateLimited: 'authRateLimited',
  unexpected: 'unexpected',
};

export const JoinEntryForm = ({ state, onNameChange, onSubmit, onViewer, onPrivacy }: JoinEntryFormProps) => {
  const { t } = useTranslation('helpers');
  const sending = state.step === 'submitting';
  const noticeKey = state.notice ? NOTICE_KEYS[state.notice] : undefined;
  const retry = noticeKey !== undefined;
  return (
    <>
      {state.tournament ? <JoinInfoCard title={state.tournament.title} date={state.tournament.date} /> : null}
      {noticeKey ? (
        <JoinNotice
          tone="warn"
          icon={noticeKey === 'offline' ? <Icons.WifiOff size={iconSizeValues.sm} /> : undefined}
          title={t(`join.formNotice.${noticeKey}.title`)}
          text={noticeKey === 'authRateLimited' ? undefined : t(`join.formNotice.${noticeKey}.text`)}
          data-testid={noticeKey === 'offline' ? 'join-offline' : noticeKey === 'authRateLimited' ? 'join-rate-limit' : 'join-unexpected'}
        />
      ) : (
        <JoinNotice
          tone="info"
          title={t('join.info.title')}
          text={t('join.info.text')}
          footer={state.shareCode ? (
            <Button variant="secondary" icon={<Icons.Eye size={iconSizeValues.sm} />} fullWidth onClick={() => onViewer(state.shareCode ?? '')} data-testid="join-viewer-link">
              {t('join.info.viewer')}
            </Button>
          ) : undefined}
          data-testid="join-info"
        />
      )}
      <CountedTextField
        label={t('join.name.label')}
        value={state.name}
        onChange={onNameChange}
        maxLength={HELPER_NAME_MAX_LENGTH}
        counter={t('join.name.counter', { count: state.name.length, max: HELPER_NAME_MAX_LENGTH })}
        hint={t('join.name.hint')}
        error={state.notice === 'invalidName' ? t('join.name.invalid') : undefined}
        disabled={sending}
        data-testid="join-name"
      />
      <Button
        variant="primary"
        fullWidth
        loading={sending}
        onClick={onSubmit}
        style={{ minHeight: cssVars.touchTargets.primary, fontSize: cssVars.fontSizes.lg }}
        data-primary
        data-testid={retry ? 'join-retry' : 'join-submit'}
        icon={retry ? <Icons.Refresh size={iconSizeValues.sm} /> : undefined}
      >
        {sending ? t('join.sending') : retry ? t('join.retry') : t('join.submit')}
      </Button>
      <Button variant="ghost" onClick={onPrivacy} data-testid="join-privacy" style={{ textDecoration: 'underline', alignSelf: 'flex-start' }}>
        {t('join.privacy')}
      </Button>
    </>
  );
};
