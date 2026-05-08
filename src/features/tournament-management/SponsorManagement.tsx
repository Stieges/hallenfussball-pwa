/**
 * SponsorManagement - Sponsoren-Verwaltung (CRUD)
 *
 * MON-KONF-01: Zentrales Sponsoren-Management (Single Source of Truth)
 *
 * Features:
 * - Liste aller Sponsoren mit Logo-Vorschau
 * - Hinzufügen / Bearbeiten / Löschen
 * - Logo-Upload mit Base64 (resized, max 500KB)
 * - Tier-Auswahl (Gold/Silber/Bronze)
 * - Warnung bei Löschen von verwendeten Sponsoren
 *
 * @see MONITOR-KONFIGURATOR-UMSETZUNGSPLAN-v2.md P1-01
 */

import { useState, useRef, CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Input } from '../../components/ui';
import { cssVars } from '../../design-tokens';
import type { Tournament } from '../../types/tournament';
import type { Sponsor, SponsorTier } from '../../types/sponsor';
import { SPONSOR_LOGO_CONSTRAINTS } from '../../types/sponsor';
import { useSponsors } from '../../hooks';

// =============================================================================
// TYPES
// =============================================================================

interface SponsorManagementProps {
  tournament: Tournament;
  onTournamentUpdate: (tournament: Tournament) => Promise<void>;
}

interface SponsorFormData {
  name: string;
  tier: SponsorTier;
  websiteUrl: string;
  logoBase64?: string;
}

const EMPTY_FORM: SponsorFormData = {
  name: '',
  tier: 'bronze',
  websiteUrl: '',
  logoBase64: undefined,
};

// =============================================================================
// TIER CONFIG
// =============================================================================

const TIER_CONFIG: Record<SponsorTier, { labelKey: string; color: string; icon: string }> = {
  gold: { labelKey: 'sponsor.tiers.gold', color: '#FFD700', icon: '🥇' },
  silver: { labelKey: 'sponsor.tiers.silver', color: '#C0C0C0', icon: '🥈' },
  bronze: { labelKey: 'sponsor.tiers.bronze', color: '#CD7F32', icon: '🥉' },
};

// =============================================================================
// COMPONENT
// =============================================================================

export function SponsorManagement({
  tournament,
  onTournamentUpdate,
}: SponsorManagementProps) {
  const { t } = useTranslation('tournament');

  // State
  const [isAdding, setIsAdding] = useState(false);
  const [editingSponsorId, setEditingSponsorId] = useState<string | null>(null);
  const [formData, setFormData] = useState<SponsorFormData>(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hook
  const {
    sponsors,
    addSponsor,
    updateSponsor,
    deleteSponsor,
    isSponsorUsedInSlides,
  } = useSponsors(tournament, onTournamentUpdate);

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  const handleStartAdd = () => {
    setFormData(EMPTY_FORM);
    setEditingSponsorId(null);
    setIsAdding(true);
    setError(null);
  };

  const handleStartEdit = (sponsor: Sponsor) => {
    setFormData({
      name: sponsor.name,
      tier: sponsor.tier ?? 'bronze',
      websiteUrl: sponsor.websiteUrl ?? '',
      logoBase64: sponsor.logoBase64,
    });
    setEditingSponsorId(sponsor.id);
    setIsAdding(false);
    setError(null);
  };

  const handleCancel = () => {
    setFormData(EMPTY_FORM);
    setEditingSponsorId(null);
    setIsAdding(false);
    setError(null);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError(t('sponsor.errors.nameRequired'));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (editingSponsorId) {
        await updateSponsor(editingSponsorId, {
          name: formData.name.trim(),
          tier: formData.tier,
          websiteUrl: formData.websiteUrl.trim() || undefined,
          logoBase64: formData.logoBase64,
        });
      } else {
        await addSponsor({
          name: formData.name.trim(),
          tier: formData.tier,
          websiteUrl: formData.websiteUrl.trim() || undefined,
          logoBase64: formData.logoBase64,
        });
      }

      handleCancel();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('sponsor.errors.saveFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (deleteConfirmId !== id) {
      setDeleteConfirmId(id);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Note: deleteSponsor returns { wasUsedInSlides } which could be used for toast notification
      await deleteSponsor(id);

      setDeleteConfirmId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('sponsor.errors.deleteFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirmId(null);
  };

  // ==========================================================================
  // LOGO UPLOAD
  // ==========================================================================

  const handleLogoClick = () => {
    fileInputRef.current?.click();
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {return;}

    // Validate file type
    if (!SPONSOR_LOGO_CONSTRAINTS.allowedMimeTypes.includes(file.type as typeof SPONSOR_LOGO_CONSTRAINTS.allowedMimeTypes[number])) {
      setError(t('sponsor.errors.invalidFormat'));
      return;
    }

    // Validate file size
    if (file.size > SPONSOR_LOGO_CONSTRAINTS.maxFileSizeBytes) {
      setError(t('sponsor.errors.fileTooLarge', { maxKB: SPONSOR_LOGO_CONSTRAINTS.maxFileSizeBytes / 1024 }));
      return;
    }

    try {
      const base64 = await resizeAndConvertToBase64(file);
      setFormData(prev => ({ ...prev, logoBase64: base64 }));
      setError(null);
    } catch (err) {
      setError(t('sponsor.errors.logoLoadFailed'));
    }

    // Reset input
    e.target.value = '';
  };

  const handleRemoveLogo = () => {
    setFormData(prev => ({ ...prev, logoBase64: undefined }));
  };

  // ==========================================================================
  // STYLES
  // ==========================================================================

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.md,
  };

  const headerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: cssVars.spacing.sm,
  };

  const titleStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.lg,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textPrimary,
    margin: 0,
  };

  const addButtonStyle: CSSProperties = {
    minWidth: '44px',
    minHeight: '44px',
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
    borderRadius: cssVars.borderRadius.md,
    background: cssVars.colors.primary,
    color: 'white',
    border: 'none',
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.semibold,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.xs,
  };

  const listStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.sm,
  };

  const sponsorItemStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.md,
    padding: cssVars.spacing.md,
    background: cssVars.colors.surface,
    borderRadius: cssVars.borderRadius.md,
    border: `1px solid ${cssVars.colors.border}`,
  };

  const logoPreviewStyle: CSSProperties = {
    width: '48px',
    height: '48px',
    borderRadius: cssVars.borderRadius.sm,
    background: cssVars.colors.surfaceLight,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  };

  const sponsorInfoStyle: CSSProperties = {
    flex: 1,
    minWidth: 0,
  };

  const sponsorNameStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textPrimary,
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const tierBadgeStyle = (tier: SponsorTier): CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 8px',
    borderRadius: cssVars.borderRadius.sm,
    background: `${TIER_CONFIG[tier].color}22`,
    color: TIER_CONFIG[tier].color,
    fontSize: cssVars.fontSizes.xs,
    fontWeight: cssVars.fontWeights.medium,
  });

  const actionButtonStyle: CSSProperties = {
    minWidth: '44px',
    minHeight: '44px',
    padding: cssVars.spacing.sm,
    borderRadius: cssVars.borderRadius.md,
    background: 'transparent',
    border: `1px solid ${cssVars.colors.border}`,
    cursor: 'pointer',
    fontSize: cssVars.fontSizes.lg,
  };

  const formStyle: CSSProperties = {
    padding: cssVars.spacing.lg,
    background: cssVars.colors.surface,
    borderRadius: cssVars.borderRadius.md,
    border: `1px solid ${cssVars.colors.primary}`,
  };

  const logoUploadStyle: CSSProperties = {
    width: '100px',
    height: '100px',
    borderRadius: cssVars.borderRadius.md,
    border: `2px dashed ${cssVars.colors.border}`,
    background: cssVars.colors.surfaceLight,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    overflow: 'hidden',
    position: 'relative',
  };

  const tierSelectStyle: CSSProperties = {
    display: 'flex',
    gap: cssVars.spacing.sm,
    marginTop: cssVars.spacing.sm,
  };

  const tierOptionStyle = (tier: SponsorTier, isSelected: boolean): CSSProperties => ({
    flex: 1,
    minHeight: '44px',
    padding: cssVars.spacing.sm,
    borderRadius: cssVars.borderRadius.md,
    border: `2px solid ${isSelected ? TIER_CONFIG[tier].color : cssVars.colors.border}`,
    background: isSelected ? `${TIER_CONFIG[tier].color}22` : 'transparent',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: cssVars.spacing.xs,
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.medium,
    color: isSelected ? TIER_CONFIG[tier].color : cssVars.colors.textSecondary,
    transition: 'all 0.2s ease',
  });

  const buttonRowStyle: CSSProperties = {
    display: 'flex',
    gap: cssVars.spacing.sm,
    marginTop: cssVars.spacing.lg,
    justifyContent: 'flex-end',
  };

  const cancelButtonStyle: CSSProperties = {
    minHeight: '44px',
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.lg}`,
    borderRadius: cssVars.borderRadius.md,
    background: 'transparent',
    border: `1px solid ${cssVars.colors.border}`,
    color: cssVars.colors.textSecondary,
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.medium,
    cursor: 'pointer',
  };

  const saveButtonStyle: CSSProperties = {
    minHeight: '44px',
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.lg}`,
    borderRadius: cssVars.borderRadius.md,
    background: cssVars.colors.primary,
    border: 'none',
    color: 'white',
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.semibold,
    cursor: isLoading ? 'wait' : 'pointer',
    opacity: isLoading ? 0.7 : 1,
  };

  const emptyStateStyle: CSSProperties = {
    padding: cssVars.spacing.xl,
    textAlign: 'center',
    color: cssVars.colors.textSecondary,
    background: cssVars.colors.surfaceLight,
    borderRadius: cssVars.borderRadius.md,
    border: `1px dashed ${cssVars.colors.border}`,
  };

  const errorStyle: CSSProperties = {
    padding: cssVars.spacing.sm,
    background: `${cssVars.colors.error}22`,
    color: cssVars.colors.error,
    borderRadius: cssVars.borderRadius.sm,
    fontSize: cssVars.fontSizes.sm,
    marginBottom: cssVars.spacing.md,
  };

  const deleteConfirmStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    padding: cssVars.spacing.sm,
    background: `${cssVars.colors.error}22`,
    borderRadius: cssVars.borderRadius.sm,
    marginTop: cssVars.spacing.sm,
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================

  const isEditing = isAdding || editingSponsorId !== null;

  return (
    <Card>
      <div style={containerStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <h3 style={titleStyle}>{t('sponsor.title')}</h3>
          {!isEditing && (
            <button style={addButtonStyle} onClick={handleStartAdd}>
              <span>+</span>
              <span>{t('sponsor.addSponsor')}</span>
            </button>
          )}
        </div>

        {/* Error */}
        {error && <div style={errorStyle}>{error}</div>}

        {/* Form */}
        {isEditing && (
          <div style={formStyle}>
            <div style={{ display: 'flex', gap: cssVars.spacing.lg, flexWrap: 'wrap' }}>
              {/* Logo Upload */}
              <div>
                <label style={{ display: 'block', marginBottom: cssVars.spacing.xs, fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary }}>
                  {t('sponsor.logo')}
                </label>
                <div style={logoUploadStyle} onClick={handleLogoClick}>
                  {formData.logoBase64 ? (
                    <>
                      <img
                        src={formData.logoBase64}
                        alt="Logo"
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemoveLogo(); }}
                        aria-label={t('sponsor.removeLogo')}
                        style={{
                          position: 'absolute',
                          top: '4px',
                          right: '4px',
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          background: cssVars.colors.error,
                          color: 'white',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: cssVars.fontSizes.xs,
                        }}
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: cssVars.fontSizes.xxl }}>📷</span>
                      <span style={{ fontSize: cssVars.fontSizes.xs, color: cssVars.colors.textMuted }}>
                        Upload
                      </span>
                    </>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={SPONSOR_LOGO_CONSTRAINTS.allowedMimeTypes.join(',')}
                  onChange={(e) => void handleLogoChange(e)}
                  style={{ display: 'none' }}
                />
              </div>

              {/* Name & URL */}
              <div style={{ flex: 1, minWidth: '200px' }}>
                <Input
                  label={t('sponsor.nameLabel')}
                  value={formData.name}
                  onChange={(v) => setFormData(prev => ({ ...prev, name: v }))}
                  placeholder={t('sponsor.namePlaceholder')}
                />
                <div style={{ marginTop: cssVars.spacing.md }}>
                  <Input
                    label={t('sponsor.websiteLabel')}
                    value={formData.websiteUrl}
                    onChange={(v) => setFormData(prev => ({ ...prev, websiteUrl: v }))}
                    placeholder="https://..."
                  />
                </div>
              </div>
            </div>

            {/* Tier Selection */}
            <div style={{ marginTop: cssVars.spacing.lg }}>
              <label style={{ display: 'block', marginBottom: cssVars.spacing.xs, fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary }}>
                {t('sponsor.category')}
              </label>
              <div style={tierSelectStyle}>
                {(['gold', 'silver', 'bronze'] as SponsorTier[]).map((tier) => (
                  <button
                    key={tier}
                    style={tierOptionStyle(tier, formData.tier === tier)}
                    onClick={() => setFormData(prev => ({ ...prev, tier }))}
                    type="button"
                  >
                    <span>{TIER_CONFIG[tier].icon}</span>
                    <span>{t(TIER_CONFIG[tier].labelKey as never)}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Buttons */}
            <div style={buttonRowStyle}>
              <button style={cancelButtonStyle} onClick={handleCancel}>
                {t('sponsor.cancel')}
              </button>
              <button style={saveButtonStyle} onClick={() => void handleSave()} disabled={isLoading}>
                {isLoading ? t('sponsor.saving') : editingSponsorId ? t('sponsor.update') : t('sponsor.add')}
              </button>
            </div>
          </div>
        )}

        {/* List */}
        {!isEditing && (
          sponsors.length === 0 ? (
            <div style={emptyStateStyle}>
              <p style={{ margin: 0, fontSize: cssVars.fontSizes.md }}>{t('sponsor.emptyState')}</p>
              <p style={{ margin: `${cssVars.spacing.sm} 0 0`, fontSize: cssVars.fontSizes.sm }}>
                {t('sponsor.emptyStateHint')}
              </p>
            </div>
          ) : (
            <div style={listStyle}>
              {sponsors.map((sponsor) => {
                const isUsed = isSponsorUsedInSlides(sponsor.id);
                const isDeleting = deleteConfirmId === sponsor.id;

                return (
                  <div key={sponsor.id}>
                    <div style={sponsorItemStyle}>
                      {/* Logo Preview */}
                      <div style={logoPreviewStyle}>
                        {sponsor.logoBase64 ? (
                          <img
                            src={sponsor.logoBase64}
                            alt={sponsor.name}
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                          />
                        ) : (
                          <span style={{ fontSize: cssVars.fontSizes.xxl, color: cssVars.colors.textMuted }}>📷</span>
                        )}
                      </div>

                      {/* Info */}
                      <div style={sponsorInfoStyle}>
                        <h4 style={sponsorNameStyle}>{sponsor.name}</h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: cssVars.spacing.sm, marginTop: '4px' }}>
                          <span style={tierBadgeStyle(sponsor.tier ?? 'bronze')}>
                            {TIER_CONFIG[sponsor.tier ?? 'bronze'].icon}
                            {t(TIER_CONFIG[sponsor.tier ?? 'bronze'].labelKey as never)}
                          </span>
                          {isUsed && (
                            <span style={{ fontSize: cssVars.fontSizes.xs, color: cssVars.colors.textMuted }}>
                              {t('sponsor.usedInSlides')}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <button
                        style={actionButtonStyle}
                        onClick={() => handleStartEdit(sponsor)}
                        aria-label={t('sponsor.editAria', { name: sponsor.name })}
                        title={t('sponsor.edit')}
                      >
                        ✏️
                      </button>
                      <button
                        style={{
                          ...actionButtonStyle,
                          borderColor: isDeleting ? cssVars.colors.error : cssVars.colors.border,
                        }}
                        onClick={() => void handleDelete(sponsor.id)}
                        aria-label={t('sponsor.deleteAria', { name: sponsor.name })}
                        title={isDeleting ? t('sponsor.clickToConfirm') : t('sponsor.delete')}
                      >
                        🗑️
                      </button>
                    </div>

                    {/* Delete Confirmation */}
                    {isDeleting && (
                      <div style={deleteConfirmStyle}>
                        <span style={{ flex: 1, fontSize: cssVars.fontSizes.sm, color: cssVars.colors.error }}>
                          {isUsed
                            ? t('sponsor.deleteUsedConfirm')
                            : t('sponsor.deleteConfirm')}
                        </span>
                        <button
                          style={{
                            ...actionButtonStyle,
                            background: cssVars.colors.error,
                            color: 'white',
                            border: 'none',
                            fontSize: cssVars.fontSizes.sm,
                            padding: `${cssVars.spacing.xs} ${cssVars.spacing.md}`,
                          }}
                          onClick={() => void handleDelete(sponsor.id)}
                        >
                          {t('sponsor.confirmDelete')}
                        </button>
                        <button
                          style={{
                            ...actionButtonStyle,
                            fontSize: cssVars.fontSizes.sm,
                            padding: `${cssVars.spacing.xs} ${cssVars.spacing.md}`,
                          }}
                          onClick={handleCancelDelete}
                        >
                          {t('sponsor.cancel')}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </Card>
  );
}

// =============================================================================
// HELPER: Resize and convert image to Base64
// =============================================================================

async function resizeAndConvertToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = SPONSOR_LOGO_CONSTRAINTS.maxDimension;

        let { width, height } = img;

        // Only resize if larger than max dimension
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = (height / width) * maxDim;
            width = maxDim;
          } else {
            width = (width / height) * maxDim;
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Convert to WebP for better compression, fallback to PNG
        let dataUrl: string;
        try {
          dataUrl = canvas.toDataURL('image/webp', 0.85);
          // Check if browser supports WebP
          if (!dataUrl.startsWith('data:image/webp')) {
            dataUrl = canvas.toDataURL('image/png');
          }
        } catch {
          dataUrl = canvas.toDataURL('image/png');
        }

        resolve(dataUrl);
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export default SponsorManagement;
