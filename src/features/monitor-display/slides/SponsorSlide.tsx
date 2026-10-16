import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { cssVars, displayEffects, displayFontSizes, displaySpacing, monitorThemes, displayMonitor } from '../../../design-tokens';
import type { Tournament } from '../../../types/tournament';
import type { MonitorSlide, MonitorTheme, PerformanceSettings } from '../../../types/monitor';
import { getSafeUrl, resolveTheme } from '../monitorDisplayHelpers';
import { zuschauerUrl } from '../publicVisibility';

interface SponsorSlideProps {
  slide: MonitorSlide;
  tournament: Tournament;
  performanceSettings: PerformanceSettings;
  theme: MonitorTheme;
  style: CSSProperties;
}

/** Sponsor-Folie: Logo oder Name, Stufen-Badge und QR-Code zur Zielseite. */
export function SponsorSlide({ slide, tournament, performanceSettings, theme, style }: SponsorSlideProps) {
  const { t } = useTranslation('monitor');
  const resolvedTheme = resolveTheme(theme);
  const themeColors = monitorThemes[resolvedTheme];

  const sponsorId = slide.config.sponsorId;
  const sponsors = tournament.sponsors ?? [];
  const sponsor = sponsors.find(s => s.id === sponsorId);

  if (!sponsor) {
    return (
      <div style={style}>
        <div style={{ fontSize: displayFontSizes.headingMD, color: themeColors.textMuted }}>
          {t('slides.sponsor.notFound')}
        </div>
      </div>
    );
  }

  // Use logoUrl or logoBase64
  const logoSrc = sponsor.logoUrl ?? sponsor.logoBase64;

  // QR-Ziel (B-16e2, R7): Rückfall ist die Zuschauer-Adresse (nie die Verwaltung); ohne sie kein QR.
  const fallbackUrl = zuschauerUrl(tournament);
  const qrUrl = slide.config.qrTarget === 'sponsor-website' && sponsor.websiteUrl
    ? getSafeUrl(sponsor.websiteUrl, fallbackUrl ?? '')
    : slide.config.qrTarget === 'custom' && slide.config.customQrUrl
      ? getSafeUrl(slide.config.customQrUrl, fallbackUrl ?? '')
      : fallbackUrl;

  return (
    <div style={style}>
      {/* Sponsor Logo or Name */}
      {logoSrc ? (
        <img
          src={logoSrc}
          alt={sponsor.name}
          style={{
            maxWidth: displayMonitor.size.sponsorLogoMaxWidth,
            maxHeight: displayMonitor.size.sponsorLogoMaxHeight,
            objectFit: 'contain',
            marginBottom: displaySpacing.sectionLG,
            boxShadow: performanceSettings.enableGlow ? displayEffects.cardShadow : 'none',
          }}
        />
      ) : (
        <div style={{
          fontSize: displayFontSizes.headingXL,
          fontWeight: cssVars.fontWeights.bold,
          color: themeColors.text,
          marginBottom: displaySpacing.sectionLG,
        }}>
          {sponsor.name}
        </div>
      )}

      {/* Sponsor Tier Badge */}
      {sponsor.tier && (
        <div style={{
          fontSize: displayFontSizes.bodyMD,
          color: themeColors.textSecondary,
          marginBottom: displaySpacing.sectionMD,
          textTransform: 'capitalize',
        }}>
          {sponsor.tier === 'gold' ? '🥇' : sponsor.tier === 'silver' ? '🥈' : '🥉'} {t('slides.sponsor.tier', { tier: sponsor.tier })}
        </div>
      )}

      {/* QR Code Placeholder */}
      {slide.config.showQrCode !== false && qrUrl && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginTop: displaySpacing.sectionMD,
        }}>
          <QRCodeSVG
            value={qrUrl}
            size={displayMonitor.qr.sizeSmall}
            bgColor={displayMonitor.qr.background}
            fgColor={displayMonitor.qr.foreground}
            level="M"
            style={{
              borderRadius: displayMonitor.radius.card,
            }}
          />
          <div style={{
            fontSize: displayFontSizes.bodySM,
            color: themeColors.textMuted,
            marginTop: displaySpacing.contentSM,
          }}>
            {t('slides.sponsor.scanMore')}
          </div>
        </div>
      )}
    </div>
  );
}
