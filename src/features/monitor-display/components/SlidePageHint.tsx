import { useTranslation } from 'react-i18next';
import { displayFontSizes, displaySpacing } from '../../../design-tokens';

interface SlidePageHintProps {
  /** Aktuelle Seite, 0-basiert. */
  page: number;
  /** Seitenzahl der Folie. */
  pages: number;
  color: string;
}

/** „Seite x / y“ unter einer Folie mit mehreren Seiten (B-16f3); bei einer Seite nichts. */
export function SlidePageHint({ page, pages, color }: SlidePageHintProps) {
  const { t } = useTranslation('monitor');
  if (pages <= 1) { return null; }
  const shown = Math.min(Math.max(page, 0), pages - 1) + 1;
  return (
    <div style={{
      fontSize: displayFontSizes.bodySM,
      color,
      marginTop: displaySpacing.contentMD,
    }}>
      {t('slides.page', { page: shown, pages })}
    </div>
  );
}
