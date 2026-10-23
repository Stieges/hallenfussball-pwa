/**
 * B-50: Einstieg in die Klärungsliste im Kopf der Turnierverwaltung – Knopf „Klärungsliste“ mit Zähler der offenen Einträge
 * (Bauplan B-50 „Liste der Turnierleitung mit Zähler“). Sichtbar nur für die Turnierleitung (leadMatches) und nur, wenn es
 * etwas gibt (offene Einträge oder Hinweise, Plan B-50 Q4). Offen ist die Liste über `?klaerung=1` (URL-ROUTING:
 * Zustand in der Adresse, Zurück schließt sie, Neuladen behält sie).
 */
import type { CSSProperties } from 'react';
import { useSearchParams } from 'react-router-dom';
import { cssVars } from '../../design-tokens';
import type { Tournament } from '../../types/tournament';
import { buildReviewNotices, openReviewCount } from '../../core/match/review/reviewCases';
import { KlaerungslisteDialog } from './KlaerungslisteDialog';
import { useLooseT } from './useLooseT';
import { useMatchReviews } from './useMatchReviews';

export const KLAERUNG_PARAM = 'klaerung';

const button: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: cssVars.spacing.xs,
  minHeight: cssVars.touchTargets.minimum,
  minWidth: cssVars.touchTargets.minimum,
  padding: `0 ${cssVars.spacing.sm}`,
  marginRight: cssVars.spacing.sm,
  background: cssVars.colors.warningLight,
  border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.warningBorder}`,
  borderRadius: cssVars.borderRadius.md,
  color: cssVars.colors.textPrimary,
  fontSize: cssVars.fontSizes.sm,
  fontWeight: cssVars.fontWeights.semibold,
  cursor: 'pointer',
  flexShrink: 0,
  whiteSpace: 'nowrap',
};
const badge: CSSProperties = {
  minWidth: cssVars.spacing.lg,
  padding: `0 ${cssVars.spacing.xs}`,
  borderRadius: cssVars.borderRadius.full,
  background: cssVars.colors.warning,
  color: cssVars.colors.onWarning,
  textAlign: 'center',
  fontVariantNumeric: 'tabular-nums',
};

export function KlaerungslisteEinstieg({ tournament, compact }: { tournament: Tournament; compact: boolean }) {
  const t = useLooseT();
  const { enabled, reviews, refresh } = useMatchReviews(tournament.id);
  const [params, setParams] = useSearchParams();
  const isOpen = enabled && params.get(KLAERUNG_PARAM) === '1';
  const open = openReviewCount(reviews);
  const hints = buildReviewNotices(reviews).reduce((sum, notice) => sum + notice.count, 0);

  const setOpen = (value: boolean) => {
    const next = new URLSearchParams(params);
    if (value) { next.set(KLAERUNG_PARAM, '1'); } else { next.delete(KLAERUNG_PARAM); }
    setParams(next, { replace: !value });
  };

  if (!enabled || (open === 0 && hints === 0 && !isOpen)) {
    return null;
  }
  return (
    <>
      <button
        type="button"
        style={button}
        onClick={() => setOpen(true)}
        data-testid="klaerungsliste-knopf"
        aria-label={t('tournament:klaerung.knopfAria', { offen: open, hinweise: hints })}
      >
        {!compact && <span>{t('tournament:klaerung.knopf')}</span>}
        {open > 0
          ? <span style={badge} data-testid="klaerungsliste-zaehler">{open}</span>
          : <span data-testid="klaerungsliste-hinweise-kurz">{t('tournament:klaerung.hinweiseKurz', { count: hints })}</span>}
      </button>
      <KlaerungslisteDialog isOpen={isOpen} onClose={() => setOpen(false)} tournament={tournament} reviews={reviews} refresh={refresh} />
    </>
  );
}
