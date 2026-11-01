/**
 * Versus – das Wort zwischen zwei Mannschaften: „gegen“ auf Deutsch, „vs“ auf Englisch (@OB-076).
 * Eine Quelle für alle Paarungen („DJK Kammer gegen TSV Petting“); das Wort kommt aus dem Glossar (`sport:tournament.versus`).
 */
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

export function Versus(): ReactElement {
  const { t } = useTranslation('sport');
  return <>{t('tournament.versus')}</>;
}
