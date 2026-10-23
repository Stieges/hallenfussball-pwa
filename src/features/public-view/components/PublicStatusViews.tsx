/**
 * Zustandsansichten der Zuschauer-Seite: Laden, Nicht gefunden, Fehler (B-13d1).
 * Texte und Aufbau wörtlich aus LiveViewScreen übernommen.
 */
import { CSSProperties } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import { publicPageContainerStyle, publicPageContentStyle } from '../publicPageStyles';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';

const errorContainerStyle: CSSProperties = {
  textAlign: 'center',
  padding: cssVars.spacing.xxl,
};

const errorIconStyle: CSSProperties = {
  fontSize: '4rem',
  marginBottom: cssVars.spacing.lg,
};

export const PublicLoadingView: React.FC<{ shareCode: string }> = ({ shareCode }) => {
  const { t } = useTranslation('publicView');
  return (
  <div style={publicPageContainerStyle}>
    <div style={publicPageContentStyle}>
      <div style={{ ...errorContainerStyle, color: cssVars.colors.textSecondary }}>
        <div
          style={{
            width: 48,
            height: 48,
            border: `3px solid ${cssVars.colors.border}`,
            borderTopColor: cssVars.colors.primary,
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto',
            marginBottom: cssVars.spacing.lg,
          }}
        />
        <p>{t('loading.title')}</p>
        <p style={{ fontSize: cssVars.fontSizes.sm, marginTop: cssVars.spacing.sm }}>
          {t('loading.code', { code: shareCode })}
        </p>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  </div>
  );
};

export const PublicNotFoundView: React.FC<{ shareCode: string }> = ({ shareCode }) => {
  const { t } = useTranslation('publicView');
  return (
  <div style={publicPageContainerStyle}>
    <div style={publicPageContentStyle}>
      <Card>
        <div style={errorContainerStyle}>
          <div style={errorIconStyle}>🔍</div>
          <h2 style={{ fontSize: cssVars.fontSizes.xl, marginBottom: cssVars.spacing.md }}>
            {t('notFound.title')}
          </h2>
          <p style={{ color: cssVars.colors.textMuted, marginBottom: cssVars.spacing.lg }}>
            <Trans i18nKey="notFound.body" ns="publicView" values={{ code: shareCode }} components={{ strong: <strong /> }} />
          </p>
          <Button
            variant="secondary"
            onClick={() => window.location.href = '/'}
          >
            {t('notFound.home')}
          </Button>
        </div>
      </Card>
    </div>
  </div>
  );
};

export const PublicErrorView: React.FC<{ errorMessage: string | null }> = ({ errorMessage }) => {
  const { t } = useTranslation('publicView');
  return (
  <div style={publicPageContainerStyle}>
    <div style={publicPageContentStyle}>
      <Card>
        <div style={errorContainerStyle}>
          <div style={errorIconStyle}>⚠️</div>
          <h2 style={{ fontSize: cssVars.fontSizes.xl, marginBottom: cssVars.spacing.md }}>
            {t('error.title')}
          </h2>
          <p style={{ color: cssVars.colors.textMuted, marginBottom: cssVars.spacing.lg }}>
            {errorMessage ?? t('error.unknown')}
          </p>
          <Button
            variant="secondary"
            onClick={() => window.location.reload()}
          >
            {t('error.retry')}
          </Button>
        </div>
      </Card>
    </div>
  </div>
  );
};
