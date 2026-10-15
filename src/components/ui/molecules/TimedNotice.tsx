/**
 * TimedNotice – kleiner Hinweis in der unteren rechten Ecke (verdeckt die Kopfzeile der Live-Folie nicht, @ME-006), der nach `durationMs` von selbst verschwindet.
 *
 * Einmal gezeigt, bleibt er für die Lebensdauer der Komponente ausgeblendet (Atomic Design: Molekül aus
 * Text und Verhalten, Farben und Maße aus den Tokens).
 */
import { useEffect } from 'react';
import { cssVars, displayLayout } from '../../../design-tokens';

export interface TimedNoticeProps {
  /** Text des Hinweises (übersetzt vom Aufrufer). */
  text: string;
  /** Sichtbare Dauer in Millisekunden. Danach ruft die Komponente `onDone` und entfernt sich nicht selbst. */
  durationMs: number;
  /** Wird nach Ablauf der Dauer einmal aufgerufen; der Aufrufer entscheidet, ob der Hinweis wieder erscheint. */
  onDone?: () => void;
  /** Test-Kennung. */
  testId?: string;
}

export function TimedNotice({ text, durationMs, onDone, testId }: TimedNoticeProps) {
  useEffect(() => {
    const timer = setTimeout(() => { onDone?.(); }, durationMs);
    return () => clearTimeout(timer);
  }, [durationMs, onDone]);

  return (
    <div
      role="status"
      data-testid={testId}
      style={{
        position: 'fixed',
        bottom: cssVars.spacing.lg,
        right: cssVars.spacing.lg,
        maxWidth: displayLayout.noticeMaxWidth,
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
