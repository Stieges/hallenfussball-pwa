/**
 * TimedNotice – kleiner Hinweis in einer Ecke, der nach `durationMs` von selbst verschwindet.
 *
 * Einmal gezeigt, bleibt er für die Lebensdauer der Komponente ausgeblendet (Atomic Design: Molekül aus
 * Text und Verhalten, Farben und Maße aus den Tokens).
 */
import { useEffect, useState, type CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens';

export interface TimedNoticeProps {
  /** Text des Hinweises (übersetzt vom Aufrufer). */
  text: string;
  /** Sichtbare Dauer in Millisekunden. */
  durationMs: number;
  /** Corner-Position. */
  corner?: 'top-right' | 'bottom-right';
  /** Test-Kennung. */
  testId?: string;
}

const cornerStyle = (corner: NonNullable<TimedNoticeProps['corner']>): CSSProperties =>
  corner === 'top-right'
    ? { top: cssVars.spacing.lg, right: cssVars.spacing.lg }
    : { bottom: cssVars.spacing.lg, right: cssVars.spacing.lg };

export function TimedNotice({ text, durationMs, corner = 'top-right', testId }: TimedNoticeProps) {
  const [sichtbar, setSichtbar] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setSichtbar(false), durationMs);
    return () => clearTimeout(timer);
  }, [durationMs]);

  if (!sichtbar) { return null; }

  return (
    <div
      role="status"
      data-testid={testId}
      style={{
        position: 'fixed',
        ...cornerStyle(corner),
        maxWidth: '40%',
        padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
        background: cssVars.colors.surfaceDarkMedium,
        color: cssVars.colors.textPrimary,
        borderRadius: cssVars.borderRadius.md,
        fontSize: cssVars.fontSizes.sm,
        zIndex: cssVars.zIndex.sticky,
      }}
    >
      {text}
    </div>
  );
}
