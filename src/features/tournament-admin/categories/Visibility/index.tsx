/**
 * VisibilityCategory - Visibility & QR-Code
 *
 * Control what's publicly visible and sharing options.
 * Integrates with Supabase for share code generation.
 *
 * @see docs/concepts/TOURNAMENT-ADMIN-CENTER-KONZEPT-v1.2.md Section 5.7
 * @see docs/concepts/PUBLIC-PAGE-KONZEPT-v4-FINAL.md
 */

import { useState, useEffect, useCallback, useRef, CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../../design-tokens';
import { CategoryPage, CollapsibleSection } from '../shared';
import type { Tournament } from '../../../../types/tournament';
import { useRepository } from '../../../../hooks/useRepository';
import { generateShareCode } from '../../../../utils/shareCode';
import { generateLiveUrl, generateTournamentUrl } from '../../../../utils/shareUtils';
import { isSupabaseConfigured } from '../../../../lib/supabase';

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
  const { t } = useTranslation('admin');
  // Get repository from context (respects auth state)
  const repository = useRepository();

  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isPublic, setIsPublic] = useState(tournament.isPublic ?? false);
  const [shareCode, setShareCode] = useState<string | null>(tournament.shareCode ?? null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track if we've already tried to auto-generate
  const hasAutoGenerated = useRef(false);

  // Sync state from tournament prop
  useEffect(() => {
    setIsPublic(tournament.isPublic ?? false);
    setShareCode(tournament.shareCode ?? null);
  }, [tournament.isPublic, tournament.shareCode]);

  // Auto-generate share code if tournament is public but has no share code
  useEffect(() => {
    const shouldAutoGenerate =
      (tournament.isPublic ?? true) && // Default is public
      !tournament.shareCode &&
      !hasAutoGenerated.current &&
      !isUpdating;

    if (!shouldAutoGenerate) {
      return;
    }

    hasAutoGenerated.current = true;

    const autoGenerateShareCode = async () => {
      setIsUpdating(true);
      setError(null);

      try {
        // Use repository from context (supports both Supabase and localStorage)
        const result = await repository.makeTournamentPublic(tournamentId);

        if (result) {
          setShareCode(result.shareCode);
          setIsPublic(true);
          onTournamentUpdate({
            ...tournament,
            isPublic: true,
            shareCode: result.shareCode,
            shareCodeCreatedAt: result.createdAt,
            updatedAt: new Date().toISOString(),
          });
        } else {
          // Fallback: Generate locally if repository returns null
          const newShareCode = generateShareCode();
          const createdAt = new Date().toISOString();

          setShareCode(newShareCode);
          setIsPublic(true);
          onTournamentUpdate({
            ...tournament,
            isPublic: true,
            shareCode: newShareCode,
            shareCodeCreatedAt: createdAt,
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.error('Failed to auto-generate share code:', err);
        // Don't show error for auto-generation, just log it
        hasAutoGenerated.current = false; // Allow retry
      } finally {
        setIsUpdating(false);
      }
    };

    void autoGenerateShareCode();
  }, [tournament, tournamentId, onTournamentUpdate, isUpdating, repository]);

  // Generate public URL based on share code (uses HashRouter: /#/live/...)
  const publicUrl = shareCode ? generateLiveUrl(shareCode) : null;

  // Make tournament public (generate share code)
  const handleMakePublic = useCallback(async () => {
    setIsUpdating(true);
    setError(null);

    try {
      const result = await repository.makeTournamentPublic(tournamentId);

      if (result) {
        setShareCode(result.shareCode);
        setIsPublic(true);
        onTournamentUpdate({
          ...tournament,
          isPublic: true,
          shareCode: result.shareCode,
          shareCodeCreatedAt: result.createdAt,
          updatedAt: new Date().toISOString(),
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (err) {
      console.error('Failed to make tournament public:', err);
      setError(t('visibility.errorMakingPublic'));
    } finally {
      setIsUpdating(false);
    }
  }, [tournamentId, tournament, onTournamentUpdate, repository, t]);

  // Make tournament private (remove share code)
  const handleMakePrivate = useCallback(async () => {
    setIsUpdating(true);
    setError(null);

    try {
      await repository.makeTournamentPrivate(tournamentId);

      setShareCode(null);
      setIsPublic(false);
      onTournamentUpdate({
        ...tournament,
        isPublic: false,
        shareCode: undefined,
        shareCodeCreatedAt: undefined,
        updatedAt: new Date().toISOString(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to make tournament private:', err);
      setError(t('visibility.errorMakingPrivate'));
    } finally {
      setIsUpdating(false);
    }
  }, [tournamentId, tournament, onTournamentUpdate, repository, t]);

  // Regenerate share code
  const handleRegenerateCode = useCallback(async () => {
    setIsUpdating(true);
    setError(null);

    try {
      const result = await repository.regenerateShareCode(tournamentId);

      if (result) {
        setShareCode(result.shareCode);
        onTournamentUpdate({
          ...tournament,
          shareCode: result.shareCode,
          shareCodeCreatedAt: result.createdAt,
          updatedAt: new Date().toISOString(),
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (err) {
      console.error('Failed to regenerate share code:', err);
      setError(t('visibility.errorRegeneratingCode'));
    } finally {
      setIsUpdating(false);
    }
  }, [tournamentId, tournament, onTournamentUpdate, repository, t]);

  // Handle copy to clipboard
  const handleCopy = async () => {
    if (!publicUrl) {
      return;
    }

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
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- Fallback for browsers without Clipboard API
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
      title={t('visibility.title')}
      description={t('visibility.description')}
      headerExtra={
        saved && (
          <span style={styles.saveIndicator}>
            <span>✓</span>
            <span>{t('visibility.saved')}</span>
          </span>
        )
      }
    >
      {/* QR Code & Sharing - only shown when public */}
      <CollapsibleSection icon="📱" title={t('visibility.qrAndSharing')} defaultOpen>
        <div style={styles.qrContainer}>
          {/* Error Message */}
          {error && (
            <div style={{
              padding: cssVars.spacing.md,
              background: cssVars.colors.errorLight,
              border: `1px solid ${cssVars.colors.errorBorder}`,
              borderRadius: cssVars.borderRadius.md,
              color: cssVars.colors.error,
              marginBottom: cssVars.spacing.md,
            }}>
              {error}
            </div>
          )}

          {/* Public sharing with share code */}
          {isPublic && publicUrl ? (
            <>
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
                  {copied ? t('visibility.copied') : t('visibility.copy')}
                </button>
              </div>

              {/* Share Code Display */}
              <div style={{
                padding: cssVars.spacing.md,
                background: cssVars.colors.primarySubtle,
                borderRadius: cssVars.borderRadius.md,
                textAlign: 'center',
              }}>
                <span style={{ color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.bodySm }}>
                  {t('visibility.shareCode')}:
                </span>
                <div style={{
                  fontSize: cssVars.fontSizes.headlineLg,
                  fontWeight: cssVars.fontWeights.bold,
                  // eslint-disable-next-line local-rules/no-hardcoded-font-styles -- Monospace is intentional for share code display
                  fontFamily: 'monospace',
                  letterSpacing: '0.2em',
                  color: cssVars.colors.primary,
                  marginTop: cssVars.spacing.xs,
                }}>
                  {shareCode}
                </div>
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
                    <span>{t('visibility.openPublicView')}</span>
                  </button>
                  <button
                    style={styles.actionButton}
                    onClick={() => { void handleRegenerateCode(); }}
                    disabled={isUpdating}
                  >
                    <span>🔄</span>
                    <span>{isUpdating ? t('visibility.generating') : t('visibility.generateNewCode')}</span>
                  </button>
                  <button style={styles.actionButton}>
                    <span>🖨️</span>
                    <span>{t('visibility.printQr')}</span>
                  </button>
                  <button style={styles.actionButton}>
                    <span>📥</span>
                    <span>{t('visibility.downloadQr')}</span>
                  </button>
                </div>
              </div>

              <div style={styles.tip}>
                <span>💡</span>
                <span>
                  {t('visibility.qrTip')}
                </span>
              </div>
            </>
          ) : (
            <>
              {/* Internal link sharing (for logged-in users) */}
              <div style={{
                padding: cssVars.spacing.md,
                background: cssVars.colors.warningLight,
                border: `1px solid ${cssVars.colors.warningBorder}`,
                borderRadius: cssVars.borderRadius.md,
                marginBottom: cssVars.spacing.md,
              }}>
                <p style={{ margin: 0, color: cssVars.colors.warning, fontSize: cssVars.fontSizes.bodySm }}>
                  {t('visibility.privateWarning')}
                </p>
              </div>

              <div style={styles.linkRow}>
                <input
                  type="text"
                  value={generateTournamentUrl(tournamentId)}
                  readOnly
                  style={styles.linkInput}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  style={{
                    ...styles.copyButton,
                    ...(copied ? styles.copyButtonSuccess : {}),
                  }}
                  onClick={() => {
                    const internalUrl = generateTournamentUrl(tournamentId);
                    navigator.clipboard.writeText(internalUrl)
                      .then(() => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      })
                      .catch(() => {
                        // Fallback
                        const textArea = document.createElement('textarea');
                        textArea.value = internalUrl;
                        document.body.appendChild(textArea);
                        textArea.select();
                        // eslint-disable-next-line @typescript-eslint/no-deprecated -- Fallback for browsers without Clipboard API
                        document.execCommand('copy');
                        document.body.removeChild(textArea);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      });
                  }}
                >
                  {copied ? t('visibility.copied') : t('visibility.copy')}
                </button>
              </div>

              {!isSupabaseConfigured && (
                <div style={{
                  ...styles.tip,
                  marginTop: cssVars.spacing.md,
                  background: cssVars.colors.infoLight,
                  borderColor: cssVars.colors.infoBorder,
                  color: cssVars.colors.info,
                }}>
                  <span>ℹ️</span>
                  <span>
                    {t('visibility.localModeInfo')}
                  </span>
                </div>
              )}

              <div style={{ ...styles.tip, marginTop: cssVars.spacing.md }}>
                <span>💡</span>
                <span>
                  {t('visibility.enableShareableTip')}
                </span>
              </div>
            </>
          )}
        </div>
      </CollapsibleSection>

      {/* Content Visibility */}
      <CollapsibleSection icon="🖼️" title={t('visibility.contentVisibility')} defaultOpen>
        <p style={{ color: cssVars.colors.textSecondary, marginBottom: cssVars.spacing.md }}>
          {t('visibility.whatVisitorsSee')}
        </p>
        <div style={styles.checkboxGroup}>
          <label style={styles.checkbox}>
            <input type="checkbox" checked disabled />
            <span>{t('visibility.scheduleAlwaysVisible')}</span>
          </label>
          <label style={styles.checkbox}>
            <input
              type="checkbox"
              checked={!tournament.hideScoresForPublic}
              onChange={(e) => handleScoresVisibility(e.target.checked)}
            />
            <span>{t('visibility.results')}</span>
          </label>
          <label style={styles.checkbox}>
            <input
              type="checkbox"
              checked={!tournament.hideRankingsForPublic}
              onChange={(e) => handleRankingsVisibility(e.target.checked)}
              disabled={tournament.isKidsTournament}
            />
            <span>{t('visibility.rankings')} {tournament.isKidsTournament && t('visibility.disabledByBambini')}</span>
          </label>
        </div>
      </CollapsibleSection>

      {/* Bambini Mode */}
      <CollapsibleSection icon="👶" title={t('visibility.bambiniMode')} defaultOpen>
        <label style={styles.checkbox}>
          <input
            type="checkbox"
            checked={tournament.isKidsTournament || false}
            onChange={(e) => handleBambiniMode(e.target.checked)}
          />
          <span>{t('visibility.enableBambiniMode')}</span>
        </label>
        <p style={{ color: cssVars.colors.textSecondary, marginTop: cssVars.spacing.md }}>
          {t('visibility.whenEnabled')}:
        </p>
        <ul style={{ color: cssVars.colors.textSecondary, paddingLeft: cssVars.spacing.lg, margin: `${cssVars.spacing.sm} 0` }}>
          <li>{t('visibility.noTables')}</li>
          <li>{t('visibility.noPlacements')}</li>
          <li>{t('visibility.focusOnFun')}</li>
        </ul>
        <div style={{ ...styles.tip, marginTop: cssVars.spacing.md }}>
          <span>💡</span>
          <span>{t('visibility.bambiniIdeal')}</span>
        </div>
      </CollapsibleSection>

      {/* Visibility Level */}
      <CollapsibleSection icon="🔒" title={t('visibility.tournamentVisibility')}>
        <div style={styles.radioGroup}>
          {/* Private Option */}
          <label
            style={{
              ...styles.radioOption,
              ...(!isPublic ? styles.radioOptionSelected : {}),
              opacity: isUpdating ? 0.6 : 1,
              cursor: isUpdating ? 'not-allowed' : 'pointer',
            }}
            onClick={() => {
              if (!isUpdating && isPublic) {
                void handleMakePrivate();
              }
            }}
          >
            <input
              type="radio"
              name="visibility"
              checked={!isPublic}
              readOnly
              disabled={isUpdating}
            />
            <div>
              <div style={styles.radioLabel}>{t('visibility.private')}</div>
              <div style={styles.radioDescription}>
                {t('visibility.privateDesc')}
              </div>
            </div>
          </label>

          {/* Shareable Option */}
          <label
            style={{
              ...styles.radioOption,
              ...(isPublic ? styles.radioOptionSelected : {}),
              opacity: isUpdating ? 0.6 : 1,
              cursor: isUpdating ? 'not-allowed' : 'pointer',
            }}
            onClick={() => {
              if (!isUpdating && !isPublic) {
                void handleMakePublic();
              }
            }}
          >
            <input
              type="radio"
              name="visibility"
              checked={isPublic}
              readOnly
              disabled={isUpdating}
            />
            <div>
              <div style={styles.radioLabel}>
                {t('visibility.shareable')}
                {isUpdating && <span style={{ marginLeft: cssVars.spacing.sm }}>⏳</span>}
              </div>
              <div style={styles.radioDescription}>
                {t('visibility.shareableDesc')}
              </div>
            </div>
          </label>

          {/* Public Listed Option (future) */}
          <label style={{ ...styles.radioOption, opacity: 0.5, cursor: 'not-allowed' }}>
            <input type="radio" name="visibility" disabled />
            <div>
              <div style={styles.radioLabel}>{t('visibility.publicListed')}</div>
              <div style={styles.radioDescription}>
                {t('visibility.publicListedDesc')}
              </div>
            </div>
          </label>
        </div>

        {!isSupabaseConfigured && (
          <div style={{
            ...styles.tip,
            marginTop: cssVars.spacing.md,
            background: cssVars.colors.infoLight,
            borderColor: cssVars.colors.infoBorder,
            color: cssVars.colors.info,
          }}>
            <span>ℹ️</span>
            <span>
              {t('visibility.localModeActive')}
            </span>
          </div>
        )}

        <div style={{ ...styles.tip, marginTop: cssVars.spacing.md }}>
          <span>ℹ️</span>
          <span>
            {t('visibility.shareCodeInfo')}
          </span>
        </div>
      </CollapsibleSection>
    </CategoryPage>
  );
}

export default VisibilityCategory;
