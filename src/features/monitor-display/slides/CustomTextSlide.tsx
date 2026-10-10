import type { CSSProperties } from 'react';
import { cssVars, displayColorSchemes, displayFontSizes, displaySpacing, displayMonitor } from '../../../design-tokens';
import type { MonitorSlide } from '../../../types/monitor';

interface CustomTextSlideProps {
  slide: MonitorSlide;
  style: CSSProperties;
}

/** Freie Text-Folie (Überschrift + Fließtext, Farbschema der Folie). */
export function CustomTextSlide({ slide, style }: CustomTextSlideProps) {
  const colorSchemeKey = slide.config.colorScheme;
  const scheme = (colorSchemeKey && colorSchemeKey in displayColorSchemes)
    ? displayColorSchemes[colorSchemeKey]
    : displayColorSchemes.default;

  return (
    <div style={{
      ...style,
      background: scheme.background,
      color: scheme.text,
      textAlign: slide.config.textAlign ?? 'center',
    }}>
      {/* Headline */}
      {slide.config.headline && (
        <div style={{
          fontSize: displayFontSizes.headingXL,
          fontWeight: cssVars.fontWeights.bold,
          marginBottom: displaySpacing.sectionMD,
        }}>
          {slide.config.headline}
        </div>
      )}

      {/* Body */}
      {slide.config.body && (
        <div style={{
          fontSize: displayFontSizes.headingMD,
          maxWidth: displayMonitor.size.textMaxWidth,
          lineHeight: displayMonitor.text.lineHeight,
        }}>
          {slide.config.body}
        </div>
      )}
    </div>
  );
}
