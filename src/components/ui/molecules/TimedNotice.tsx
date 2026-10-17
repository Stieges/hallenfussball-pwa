/**
 * TimedNotice – kleiner Hinweis oben rechts (Stil „corner“, Monitor-Mockup v8; steht in der Höhe der Kopfzeile und
 * verdeckt weder Stand noch Schiedsrichter-Zeile, @ME-006), der nach `durationMs` von selbst verschwindet.
 *
 * Einmal gezeigt, bleibt er für die Lebensdauer der Komponente ausgeblendet (Atomic Design: Molekül aus
 * Text und Verhalten, Farben und Maße aus den Tokens).
 */
import { useEffect } from 'react';
import { cssVars, displayFontSizes, displayLayout } from '../../../design-tokens';

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
        top: displayLayout.noticeTop,
        right: displayLayout.noticeRight,
        maxWidth: displayLayout.noticeMaxWidth,
        padding: `${displayLayout.noticePadY} ${displayLayout.noticePadX}`,
        background: cssVars.colors.surfaceDarkMedium,
        color: cssVars.colors.textPrimary,
        border: `${displayLayout.noticeBorderWidth} solid ${cssVars.colors.borderStrong}`,
        borderRadius: displayLayout.noticeRadius,
        fontSize: displayFontSizes.notice,
        fontWeight: cssVars.fontWeights.semibold,
        lineHeight: displayLayout.noticeLineHeight,
        zIndex: cssVars.zIndex.sticky,
      }}
    >
      {text}
    </div>
  );
}
