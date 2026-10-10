/**
 * Zustandsansichten der Zuschauer-Seite: Laden, Nicht gefunden, Fehler (B-13d1).
 * Texte und Aufbau wörtlich aus LiveViewScreen übernommen.
 */
import { CSSProperties } from 'react';
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

export const PublicLoadingView: React.FC<{ shareCode: string }> = ({ shareCode }) => (
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
        <p>Turnier wird geladen...</p>
        <p style={{ fontSize: cssVars.fontSizes.sm, marginTop: cssVars.spacing.sm }}>
          Code: {shareCode}
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

export const PublicNotFoundView: React.FC<{ shareCode: string }> = ({ shareCode }) => (
  <div style={publicPageContainerStyle}>
    <div style={publicPageContentStyle}>
      <Card>
        <div style={errorContainerStyle}>
          <div style={errorIconStyle}>🔍</div>
          <h2 style={{ fontSize: cssVars.fontSizes.xl, marginBottom: cssVars.spacing.md }}>
            Turnier nicht gefunden
          </h2>
          <p style={{ color: cssVars.colors.textMuted, marginBottom: cssVars.spacing.lg }}>
            Der Code <strong>{shareCode}</strong> ist ungültig oder das Turnier wurde nicht freigegeben.
          </p>
          <Button
            variant="secondary"
            onClick={() => window.location.href = '/'}
          >
            Zur Startseite
          </Button>
        </div>
      </Card>
    </div>
  </div>
);

export const PublicErrorView: React.FC<{ errorMessage: string | null }> = ({ errorMessage }) => (
  <div style={publicPageContainerStyle}>
    <div style={publicPageContentStyle}>
      <Card>
        <div style={errorContainerStyle}>
          <div style={errorIconStyle}>⚠️</div>
          <h2 style={{ fontSize: cssVars.fontSizes.xl, marginBottom: cssVars.spacing.md }}>
            Fehler beim Laden
          </h2>
          <p style={{ color: cssVars.colors.textMuted, marginBottom: cssVars.spacing.lg }}>
            {errorMessage ?? 'Ein unbekannter Fehler ist aufgetreten.'}
          </p>
          <Button
            variant="secondary"
            onClick={() => window.location.reload()}
          >
            Erneut versuchen
          </Button>
        </div>
      </Card>
    </div>
  </div>
);
