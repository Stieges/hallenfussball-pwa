/**
 * VisibilityCategory - Visibility & QR-Code
 *
 * Control what's publicly visible and sharing options.
 *
 * @see docs/concepts/TOURNAMENT-ADMIN-CENTER-KONZEPT-v1.2.md Section 5.7
 */

import { useState, CSSProperties } from 'react';
import { cssVars } from '../../../../design-tokens';
import { CategoryPage, CollapsibleSection } from '../shared';
import type { Tournament } from '../../../../types/tournament';

// =============================================================================
// PROPS
// =============================================================================

interface VisibilityCategoryProps {
  tournamentId: string;
  tournament: Tournament;
  onTournamentUpdate: (tournament: Tournament) => void;
}

// =============================================================================
// STYLES
// =============================================================================

const styles = {
  radioGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.md,
  } as CSSProperties,

  radioOption: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: cssVars.spacing.sm,
    padding: cssVars.spacing.md,
    background: cssVars.colors.surface,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  } as CSSProperties,

  radioOptionSelected: {
    borderColor: cssVars.colors.primary,
    background: cssVars.colors.primarySubtle,
  } as CSSProperties,

  radioLabel: {
    fontSize: cssVars.fontSizes.bodyMd,
    fontWeight: cssVars.fontWeights.medium,
    color: cssVars.colors.textPrimary,
  } as CSSProperties,

  radioDescription: {
    fontSize: cssVars.fontSizes.labelSm,
    color: cssVars.colors.textSecondary,
    marginTop: 2,
  } as CSSProperties,

  checkboxGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.sm,
  } as CSSProperties,

  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    cursor: 'pointer',
    fontSize: cssVars.fontSizes.bodyMd,
    color: cssVars.colors.textPrimary,
  } as CSSProperties,

  qrContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.lg,
  } as CSSProperties,

  linkRow: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    flexWrap: 'wrap',
  } as CSSProperties,

  linkInput: {
    flex: 1,
    minWidth: 200,
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
    background: cssVars.colors.inputBg,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    color: cssVars.colors.textPrimary,
    fontSize: cssVars.fontSizes.bodySm,
  } as CSSProperties,

  copyButton: {
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
    background: cssVars.colors.primarySubtle,
    border: `1px solid ${cssVars.colors.primaryBorder}`,
    borderRadius: cssVars.borderRadius.md,
    color: cssVars.colors.primary,
    fontSize: cssVars.fontSizes.bodySm,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  } as CSSProperties,

  copyButtonSuccess: {
    background: cssVars.colors.successLight,
    borderColor: cssVars.colors.successHover,
    color: cssVars.colors.success,
  } as CSSProperties,

  qrPreview: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: cssVars.spacing.lg,
    flexWrap: 'wrap',
  } as CSSProperties,

  qrPlaceholder: {
    width: 150,
    height: 150,
    background: cssVars.colors.surfaceHover,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 48,
    color: cssVars.colors.textMuted,
    flexShrink: 0,
  } as CSSProperties,

  qrActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.sm,
  } as CSSProperties,

  actionButton: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.xs,
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
    background: cssVars.colors.surface,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    color: cssVars.colors.textPrimary,
    fontSize: cssVars.fontSizes.bodySm,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.15s ease',
  } as CSSProperties,

  tip: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: cssVars.spacing.sm,
    padding: cssVars.spacing.md,
    background: cssVars.colors.infoLight,
    border: `1px solid ${cssVars.colors.infoBorder}`,
    borderRadius: cssVars.borderRadius.md,
    fontSize: cssVars.fontSizes.bodySm,
    color: cssVars.colors.info,
  } as CSSProperties,

  saveIndicator: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: cssVars.spacing.xs,
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
    background: cssVars.colors.successLight,
    color: cssVars.colors.success,
    borderRadius: cssVars.borderRadius.sm,
    fontSize: cssVars.fontSizes.labelSm,
    marginLeft: cssVars.spacing.sm,
  } as CSSProperties,
} as const;

// =============================================================================
// COMPONENT
// =============================================================================

export function VisibilityCategory({
  tournamentId,
  tournament,
  onTournamentUpdate,
}: VisibilityCategoryProps) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const publicUrl = `${window.location.origin}/public/${tournamentId}`;

  // Handle copy to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = publicUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Helper to update tournament and show save indicator
  const updateTournament = (updates: Partial<Tournament>) => {
    onTournamentUpdate({
      ...tournament,
      ...updates,
      updatedAt: new Date().toISOString(),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Handle content visibility changes
  const handleScoresVisibility = (checked: boolean) => {
    updateTournament({ hideScoresForPublic: !checked });
  };

  const handleRankingsVisibility = (checked: boolean) => {
    updateTournament({ hideRankingsForPublic: !checked });
  };

  const handleBambiniMode = (checked: boolean) => {
    updateTournament({
      isKidsTournament: checked,
      // Bambini mode automatically hides rankings
      hideRankingsForPublic: checked ? true : tournament.hideRankingsForPublic,
    });
  };

  return (
    <CategoryPage
      icon="👁"
      title="Sichtbarkeit & QR-Code"
      description="Steuern was öffentlich sichtbar ist und Sharing-Optionen"
      headerExtra={
        saved && (
          <span style={styles.saveIndicator}>
            <span>✓</span>
            <span>Gespeichert</span>
          </span>
        )
      }
    >
      {/* QR Code & Sharing - moved up for importance */}
      <CollapsibleSection icon="📱" title="QR-Code & Sharing" defaultOpen>
        <div style={styles.qrContainer}>
          <div style={styles.linkRow}>
            <input
              type="text"
              value={publicUrl}
              readOnly
              style={styles.linkInput}
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button
              style={{
                ...styles.copyButton,
                ...(copied ? styles.copyButtonSuccess : {}),
              }}
              onClick={() => { void handleCopy(); }}
            >
              {copied ? '✓ Kopiert!' : '📋 Kopieren'}
            </button>
          </div>

          <div style={styles.qrPreview}>
            <div style={styles.qrPlaceholder}>
              <span>QR</span>
            </div>
            <div style={styles.qrActions}>
              <button
                style={styles.actionButton}
                onClick={() => window.open(publicUrl, '_blank')}
              >
                <span>🔗</span>
                <span>Public View öffnen</span>
              </button>
              <button style={styles.actionButton}>
                <span>🖨️</span>
                <span>QR-Code drucken</span>
              </button>
              <button style={styles.actionButton}>
                <span>📥</span>
                <span>QR-Code herunterladen</span>
              </button>
            </div>
          </div>

          <div style={styles.tip}>
            <span>💡</span>
            <span>
              Tipp: Hänge den QR-Code in der Halle aus, damit Eltern live mitverfolgen können.
            </span>
          </div>
        </div>
      </CollapsibleSection>

      {/* Content Visibility */}
      <CollapsibleSection icon="🖼️" title="Inhalts-Sichtbarkeit" defaultOpen>
        <p style={{ color: cssVars.colors.textSecondary, marginBottom: cssVars.spacing.md }}>
          Was sehen Besucher im Public View?
        </p>
        <div style={styles.checkboxGroup}>
          <label style={styles.checkbox}>
            <input type="checkbox" checked disabled />
            <span>Spielplan (immer sichtbar)</span>
          </label>
          <label style={styles.checkbox}>
            <input
              type="checkbox"
              checked={!tournament.hideScoresForPublic}
              onChange={(e) => handleScoresVisibility(e.target.checked)}
            />
            <span>Ergebnisse</span>
          </label>
          <label style={styles.checkbox}>
            <input
              type="checkbox"
              checked={!tournament.hideRankingsForPublic}
              onChange={(e) => handleRankingsVisibility(e.target.checked)}
              disabled={tournament.isKidsTournament}
            />
            <span>Tabellen / Rankings {tournament.isKidsTournament && '(durch Bambini-Modus deaktiviert)'}</span>
          </label>
        </div>
      </CollapsibleSection>

      {/* Bambini Mode */}
      <CollapsibleSection icon="👶" title="Bambini-Modus" defaultOpen>
        <label style={styles.checkbox}>
          <input
            type="checkbox"
            checked={tournament.isKidsTournament || false}
            onChange={(e) => handleBambiniMode(e.target.checked)}
          />
          <span>Bambini-Modus aktivieren</span>
        </label>
        <p style={{ color: cssVars.colors.textSecondary, marginTop: cssVars.spacing.md }}>
          Wenn aktiviert:
        </p>
        <ul style={{ color: cssVars.colors.textSecondary, paddingLeft: cssVars.spacing.lg, margin: `${cssVars.spacing.sm} 0` }}>
          <li>Keine Tabellen anzeigen</li>
          <li>Keine Platzierungen anzeigen</li>
          <li>Fokus auf Spaß statt Wettbewerb</li>
        </ul>
        <div style={{ ...styles.tip, marginTop: cssVars.spacing.md }}>
          <span>💡</span>
          <span>Ideal für E- und F-Jugend Turniere ohne Ergebnis-Fokus.</span>
        </div>
      </CollapsibleSection>

      {/* Visibility Level - informational for now */}
      <CollapsibleSection icon="🔒" title="Turnier-Sichtbarkeit">
        <div style={styles.radioGroup}>
          <label
            style={styles.radioOption}
          >
            <input type="radio" name="visibility" disabled />
            <div>
              <div style={styles.radioLabel}>🔒 Privat</div>
              <div style={styles.radioDescription}>
                Nur für eingeloggte Turnierleitung sichtbar. Kein Public View.
              </div>
            </div>
          </label>

          <label style={{ ...styles.radioOption, ...styles.radioOptionSelected }}>
            <input type="radio" name="visibility" checked readOnly />
            <div>
              <div style={styles.radioLabel}>🔗 Mit Link teilbar (Standard)</div>
              <div style={styles.radioDescription}>
                Jeder mit dem Link kann zuschauen. Nicht in Suchmaschinen auffindbar.
              </div>
            </div>
          </label>

          <label style={styles.radioOption}>
            <input type="radio" name="visibility" disabled />
            <div>
              <div style={styles.radioLabel}>🌍 Öffentlich gelistet</div>
              <div style={styles.radioDescription}>
                Im Internet suchbar. (Bald verfügbar)
              </div>
            </div>
          </label>
        </div>
        <div style={{ ...styles.tip, marginTop: cssVars.spacing.md }}>
          <span>ℹ️</span>
          <span>
            Erweiterte Sichtbarkeits-Optionen werden in einer zukünftigen Version verfügbar sein.
          </span>
        </div>
      </CollapsibleSection>
    </CategoryPage>
  );
}

export default VisibilityCategory;
