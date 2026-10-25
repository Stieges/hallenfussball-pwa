/**
 * VisibilityCategory - Visibility & QR-Code
 *
 * Control what's publicly visible and sharing options.
 * Integrates with Supabase for share code generation.
 *
 * @see docs/concepts/TOURNAMENT-ADMIN-CENTER-KONZEPT-v1.2.md Section 5.7
 * @see docs/concepts/PUBLIC-PAGE-KONZEPT-v4-FINAL.md
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../../design-tokens';
import { CategoryPage, CollapsibleSection } from '../shared';
import type { Tournament } from '../../../../types/tournament';
import { useRepository } from '../../../../hooks/useRepository';
import { useToast } from '../../../../components/ui/Toast';
import { generateLiveUrl, generateTournamentUrl } from '../../../../utils/shareUtils';
import { isSupabaseConfigured } from '../../../../lib/supabase';
import { isReleaseRefusal } from '../../../../core/repositories/OfflineRepository';
import { useCan } from '../../../auth/hooks/useCan';
import { useTournamentClosed } from '../../../../hooks/useTournamentClosed';
import { TournamentClosedHint } from '../../../../components/ui/molecules/TournamentClosedHint';
import { visibilityStyles as styles } from './visibilityStyles';
import { SpectatorDisplaySection } from './SpectatorDisplaySection';

// =============================================================================
// PROPS
// =============================================================================

interface VisibilityCategoryProps {
  tournamentId: string;
  tournament: Tournament;
  onTournamentUpdate: (tournament: Tournament) => void;
}

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
  const { showError } = useToast();

  // Ein Entwurf ist nicht öffentlich erreichbar — Teilen ist erst nach der Freigabe möglich.
  //
  // Gate auf publishedAt, NICHT status: `publishedAt` wird genau einmal beim ersten
  // Festlegen gesetzt und überdauert die Bearbeitung (@W5-004: ein festgelegtes Turnier
  // bleibt dabei festgelegt).
  // Mit status als Gate verlöre der Organisator mitten im laufenden Turnier den Link/QR-Code
  // und könnte ihn nicht mehr nachdrucken, obwohl das Turnier nachweislich online ist. Dasselbe
  // Prädikat wie im Service und in der Datenbankfunktion make_tournament_public — damit stimmen
  // alle drei Schichten überein.
  const isDraft = !tournament.publishedAt;
  // @ZM-019 (A-11): „Anzeige für Zuschauer“ stellen nur Turnierleitung und Co-Admin
  const canEditDisplay = useCan('tournamentSettings', tournamentId);
  // R3-3 (@LZ-037): nach dem Abschluss bleiben nur Teilen/Beenden der öffentlichen Ansicht; die Inhalts-Schalter sind gesperrt
  const closed = useTournamentClosed(tournamentId);

  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isPublic, setIsPublic] = useState(tournament.isPublic ?? false);
  const [shareCode, setShareCode] = useState<string | null>(tournament.shareCode ?? null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state from tournament prop
  useEffect(() => {
    setIsPublic(tournament.isPublic ?? false);
    setShareCode(tournament.shareCode ?? null);
  }, [tournament.isPublic, tournament.shareCode]);

  // Kein Auto-Generate beim Mounten mehr: Das bloße Öffnen dieser Seite darf die
  // Sichtbarkeit nicht verändern. Der alte Effekt erzeugte einen Share-Code für jedes
  // Turnier mit `(tournament.isPublic ?? true) && !tournament.shareCode` — ein fehlendes
  // Feld galt also als "öffentlich". handleMakePublic ist der explizite Weg.

  // Generate public URL based on share code (uses HashRouter: /#/live/...)
  const publicUrl = shareCode ? generateLiveUrl(shareCode) : null;

  // Make tournament public (generate share code)
  const handleMakePublic = useCallback(async () => {
    // Ein Entwurf wird nicht geteilt — die DB lehnt es ohnehin ab
    // (make_tournament_public prüft config->'publishedAt').
    if (isDraft) {
      return;
    }

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
      // Die rohe RPC-Meldung ("Tournament has not been released yet...") ist Englisch und darf
      // nicht ungefiltert vor den Nutzer — sie bleibt nur fürs Error-Reporting (siehe oben,
      // console.error) erhalten. Die Freigabe-Sperre bekommt einen eigenen deutschen Text;
      // isReleaseRefusal ist dieselbe Prüfung, mit der OfflineRepository diese Ablehnung von
      // einem Verbindungsfehler unterscheidet (SQLSTATE HF001, s. Fix 1).
      const message = isReleaseRefusal(err)
        ? t('visibility.errorNotReleased')
        : (err instanceof Error && err.message.length > 0
          ? err.message
          : t('visibility.errorMakingPublic'));
      setError(message);
      showError(message);
    } finally {
      setIsUpdating(false);
    }
  }, [tournamentId, tournament, onTournamentUpdate, repository, t, isDraft, showError]);

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

          {/* Entwurf: kein Teilen, nur der Hinweis */}
          {isDraft && (
            <div style={styles.tip} data-testid="visibility-draft-hint">
              <span>ℹ️</span>
              <span>{t('visibility.draftHint')}</span>
            </div>
          )}

          {/* Public sharing with share code */}
          {!isDraft && (isPublic && publicUrl ? (
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
          ))}
        </div>
      </CollapsibleSection>

      {/* Content Visibility */}
      <CollapsibleSection icon="🖼️" title={t('visibility.contentVisibility')} defaultOpen>
        <p style={{ color: cssVars.colors.textSecondary, marginBottom: cssVars.spacing.md }}>
          {t('visibility.whatVisitorsSee')}
        </p>
        {closed && <div style={{ marginBottom: cssVars.spacing.md }}><TournamentClosedHint /></div>}
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
              disabled={!canEditDisplay}
              data-testid="visibility-scores-toggle"
            />
            <span>{t('visibility.results')}</span>
          </label>
          <label style={styles.checkbox}>
            <input
              type="checkbox"
              checked={!tournament.hideRankingsForPublic}
              onChange={(e) => handleRankingsVisibility(e.target.checked)}
              disabled={tournament.isKidsTournament || !canEditDisplay}
              data-testid="visibility-rankings-toggle"
            />
            <span>{t('visibility.rankings')} {tournament.isKidsTournament && t('visibility.disabledByBambini')}</span>
          </label>
        </div>
      </CollapsibleSection>

      {/* Visibility Level */}
      <CollapsibleSection icon="🔒" title={t('visibility.tournamentVisibility')}>
        {isDraft && (
          <div style={{ ...styles.tip, marginBottom: cssVars.spacing.md }}>
            <span>ℹ️</span>
            <span>{t('visibility.draftHint')}</span>
          </div>
        )}

        <div style={{ ...styles.radioGroup, ...(isDraft ? styles.disabledSection : {}) }}>
          {/* Private Option */}
          <label
            style={{
              ...styles.radioOption,
              ...(!isPublic ? styles.radioOptionSelected : {}),
              opacity: isUpdating ? 0.6 : 1,
              cursor: isUpdating ? 'not-allowed' : 'pointer',
            }}
            onClick={() => {
              if (!isUpdating && !isDraft && isPublic) {
                void handleMakePrivate();
              }
            }}
          >
            <input
              type="radio"
              name="visibility"
              checked={!isPublic}
              readOnly
              disabled={isUpdating || isDraft}
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
              // `!shareCode` erhält den Reparaturpfad, den der gelöschte Auto-Effekt bot:
              // ein bereits öffentliches Turnier ohne Code bekommt einen — aber nur auf Klick.
              if (!isUpdating && !isDraft && (!isPublic || !shareCode)) {
                void handleMakePublic();
              }
            }}
          >
            <input
              type="radio"
              name="visibility"
              checked={isPublic}
              readOnly
              disabled={isUpdating || isDraft}
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
      {/* Anzeige für Zuschauer: Teamfarben und Standardfarben der Ergebniskästen mit Vorschau (@ZM-152) */}
      <SpectatorDisplaySection tournament={tournament} onTournamentUpdate={onTournamentUpdate} canEdit={canEditDisplay} />
    </CategoryPage>
  );
}

export default VisibilityCategory;
