/**
 * Zeile an der Karte eines laufenden Turniers (@LZ-005, „wenn Olli die App öffnet“): Das letzte Spiel ist mindestens 7 Tage her, jedes
 * Spiel ist entschieden, das Turnier läuft aber noch – es fehlt nur das Abschließen. Nur für die Turnierleitung: der Aufrufer (Karte) fragt das Recht `manageLifecycle` über die Rolle der Liste.
 * Das Datum, bis wann die öffentliche Ansicht läuft, nennt der Hinweis erst mit @LZ-082.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../design-tokens';
import type { Tournament } from '../types/tournament';
import { lifecycleOf } from '../core/services/lifecycle';
import { formatDay } from '../features/tournament-finish/model/finishFormat';
import { lateFinishHint } from '../features/tournament-finish/model/finishSummary';

export function LateFinishNotice({ tournament, mayFinish }: { tournament: Tournament; mayFinish: boolean }) {
  const { t, i18n } = useTranslation('dashboard');
  const [now] = useState(() => new Date());
  const lifecycle = lifecycleOf(tournament);
  const since = mayFinish ? lateFinishHint(tournament, lifecycle, now) : null;
  const day = since === null ? null : formatDay(since, i18n.language);
  if (day === null) {
    return null;
  }
  return (
    <div
      role="status" data-testid="tournament-late-finish"
      style={{
        marginTop: cssVars.spacing.sm, padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`, background: cssVars.colors.warningLight,
        border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.warningBorder}`, borderRadius: cssVars.borderRadius.sm,
        fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textPrimary,
      }}
    >
      {t('card.lateFinishNotice', { date: day })}
    </div>
  );
}
