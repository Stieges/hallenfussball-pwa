import type { CSSProperties } from 'react';
import { displayColorSchemes, displayFontSizes, displaySpacing } from '../../../design-tokens';
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
          fontWeight: 700,
          marginBottom: displaySpacing.sectionMD,
        }}>
          {slide.config.headline}
        </div>
      )}

      {/* Body */}
      {slide.config.body && (
        <div style={{
          fontSize: displayFontSizes.headingMD,
          maxWidth: '800px',
          lineHeight: 1.5,
        }}>
          {slide.config.body}
        </div>
      )}
    </div>
  );
}
