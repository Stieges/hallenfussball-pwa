/**
 * HallentonKarte – Karte „Töne → Hallenton“ im Match Cockpit der Verwaltung (H4-8, G10): Hallen-Lautsprecher, Lautstärke und Testton
 * wohnen im Unterpunkt „Hallenton“; die Karte führt dorthin. Nur mit dem Recht `manageScreens` (wie der Menüpunkt, @HT-022).
 */
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { useInRouterContext, useNavigate } from 'react-router-dom';
import { cssVars, iconSizeValues } from '../../../../design-tokens';
import { Button } from '../../../../components/ui/Button';
import { Icons } from '../../../../components/ui/Icons';
import { useCan } from '../../../auth/hooks/useCan';

const abschnittStil: CSSProperties = { display: 'flex', flexDirection: 'column', gap: cssVars.spacing.md };
const kartenStil: CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: cssVars.spacing.md, padding: cssVars.spacing.md,
  border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`, borderRadius: cssVars.borderRadius.lg,
  backgroundColor: cssVars.colors.surface, color: cssVars.colors.textPrimary,
};
const titelStil: CSSProperties = { margin: 0, display: 'flex', alignItems: 'center', gap: cssVars.spacing.xs, fontSize: cssVars.fontSizes.titleMd, fontWeight: cssVars.fontWeights.semibold };
const textStil: CSSProperties = { margin: 0, color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.md, lineHeight: cssVars.lineHeights.bodyMd };

/** Ohne Router (alte Prüfstände der Kategorie) gibt es kein Navigationsziel und damit keine Karte; in der App steht der Router immer. */
export function HallentonKarte({ tournamentId }: { tournamentId: string }) {
  return useInRouterContext() ? <HallentonKarteMitRouter tournamentId={tournamentId} /> : null;
}

function HallentonKarteMitRouter({ tournamentId }: { tournamentId: string }) {
  const { t } = useTranslation('hallenton');
  const navigate = useNavigate();
  const darf = useCan('manageScreens', tournamentId);
  if (!darf) {
    return null;
  }
  return (
    <section style={abschnittStil} data-testid="karte-toene-hallenton">
      <h2 style={{ margin: 0, fontSize: cssVars.fontSizes.titleLg, fontWeight: cssVars.fontWeights.semibold }}>{t('toeneKarte.abschnitt')}</h2>
      <div style={kartenStil}>
        <h3 style={titelStil}>
          <span aria-hidden="true">🔊</span>
          {t('toeneKarte.titel')} <Icons.ChevronRight size={iconSizeValues.xs} /> {t('toeneKarte.ziel')}
        </h3>
        <p style={textStil}>{t('toeneKarte.text')}</p>
        <div>
          <Button variant="secondary" onClick={() => { void navigate(`/tournament/${tournamentId}/admin/hallenton`); }} data-testid="toene-hallenton-oeffnen">
            {t('toeneKarte.oeffnen')}
          </Button>
        </div>
      </div>
    </section>
  );
}
