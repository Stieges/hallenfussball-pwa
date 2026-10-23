/**
 * B-50: Einstieg in die Klärungsliste – Knopf mit Zähler der offenen Einträge (Bauplan B-50), nur für die Turnierleitung
 * (`useMatchReviews`: leadMatches, Cloud-Turnier). Die Liste öffnet über `?klaerung=1` (URL-ROUTING: Zustand in der Adresse,
 * Zurück schließt sie, Neuladen behält sie).
 * - `variant="kopf"` (Kopf der Turnierverwaltung): sichtbar bei offenen Einträgen oder ungesehenen Hinweisen (Q4: „gesehen“
 *   je Gerät lokal, `seenNotices.ts`; gesehen ist ein Hinweis, sobald die Liste offen war).
 * - `variant="cockpit"` (Cockpit-Vollbild, Q8 Daniel 23.10.): unauffällig – kleiner neutraler Zähler-Knopf, keine Animation,
 *   nur bei offenen Einträgen; ohne offene Fälle nicht sichtbar. Ob er gezeigt wird, steuert `KLAERUNG_IM_COCKPIT_KOPF`.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'react-router-dom';
import { cssVars } from '../../design-tokens';
import type { Tournament } from '../../types/tournament';
import { openReviewCount } from '../../core/match/review/reviewCases';
import { KlaerungslisteDialog } from './KlaerungslisteDialog';
import { markNoticesSeen, readSeenNotices } from './seenNotices';
import { useLooseT } from './useLooseT';
import { useMatchReviews } from './useMatchReviews';

export const KLAERUNG_PARAM = 'klaerung';
/** Q8 (Daniel 23.10.): Einstieg auch im Cockpit-Kopf – hier ab- oder anschalten. */
export const KLAERUNG_IM_COCKPIT_KOPF = true;

const base: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: cssVars.spacing.xs, flex: 'none',
  minHeight: cssVars.touchTargets.minimum, minWidth: cssVars.touchTargets.minimum, padding: `0 ${cssVars.spacing.sm}`,
  borderRadius: cssVars.borderRadius.md, color: cssVars.colors.textPrimary, fontSize: cssVars.fontSizes.sm,
  fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
};
const kopfStil: CSSProperties = {
  ...base, marginRight: cssVars.spacing.sm, fontWeight: cssVars.fontWeights.semibold,
  background: cssVars.colors.warningLight, border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.warningBorder}`,
};
const cockpitStil: CSSProperties = {
  ...base, background: cssVars.colors.surface, border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderControl}`,
  color: cssVars.colors.textSecondary,
};
const badge: CSSProperties = {
  minWidth: cssVars.spacing.lg, padding: `0 ${cssVars.spacing.xs}`, borderRadius: cssVars.borderRadius.full,
  background: cssVars.colors.warning, color: cssVars.colors.onWarning, textAlign: 'center', fontVariantNumeric: 'tabular-nums',
};

export interface KlaerungslisteEinstiegProps {
  tournament: Tournament;
  compact?: boolean;
  variant?: 'kopf' | 'cockpit';
}

export function KlaerungslisteEinstieg({ tournament, compact = false, variant = 'kopf' }: KlaerungslisteEinstiegProps) {
  const t = useLooseT();
  const { enabled, reviews, refresh } = useMatchReviews(tournament.id);
  const [params, setParams] = useSearchParams();
  const isOpen = enabled && params.get(KLAERUNG_PARAM) === '1';
  const open = openReviewCount(reviews);
  const noticeIds = useMemo(() => reviews.filter((r) => r.kind === 'notice').map((r) => r.eventId), [reviews]);
  const [seen, setSeen] = useState(() => readSeenNotices(tournament.id));
  const unseen = noticeIds.filter((id) => !seen.has(id)).length;

  useEffect(() => {
    if (isOpen && noticeIds.some((id) => !seen.has(id))) {
      markNoticesSeen(tournament.id, noticeIds);
      setSeen((prev) => new Set([...prev, ...noticeIds])); // auch ohne Speicher: in dieser Sitzung gesehen
    }
  }, [isOpen, noticeIds, seen, tournament.id]);

  const setOpen = (value: boolean) => {
    const next = new URLSearchParams(params);
    if (value) { next.set(KLAERUNG_PARAM, '1'); } else { next.delete(KLAERUNG_PARAM); }
    setParams(next, { replace: !value });
  };

  const cockpit = variant === 'cockpit';
  const showButton = enabled && (open > 0 || (!cockpit && unseen > 0));
  if (!showButton && !isOpen) {
    return null;
  }
  return (
    <>
      {showButton && (
        <button
          type="button"
          style={cockpit ? cockpitStil : kopfStil}
          onClick={() => setOpen(true)}
          data-testid={cockpit ? 'klaerungsliste-knopf-cockpit' : 'klaerungsliste-knopf'}
          aria-label={t('tournament:klaerung.knopfAria', { offen: open, hinweise: unseen })}
        >
          {!compact && !cockpit && <span>{t('tournament:klaerung.knopf')}</span>}
          {open > 0
            ? <span style={cockpit ? undefined : badge} data-testid="klaerungsliste-zaehler">{open}</span>
            : <span data-testid="klaerungsliste-hinweise-kurz">{t('tournament:klaerung.hinweiseKurz', { count: unseen })}</span>}
        </button>
      )}
      {isOpen && <KlaerungslisteDialog isOpen onClose={() => setOpen(false)} tournament={tournament} reviews={reviews} refresh={refresh} />}
    </>
  );
}
