/**
 * Karten „Turnier abschließen“ in der Verwaltung (Mockup Runde 2, Daniel 25.10.): bei alles entschieden der Vorschlag mit der
 * Haupttaste (@LZ-007), sonst die Karte „Turnierstand“ mit „Turnier abschließen“ als zweiter Taste (@LZ-008, öffnet Dialog A);
 * dazu der Hinweis nach 7 Tagen (@LZ-005). Nur Darstellung; Rechte, Lesen und Dialog stecken in `FinishTournamentSection`.
 */
import { useTranslation } from 'react-i18next';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { Button } from '../../../components/ui/Button';
import { Icons } from '../../../components/ui/Icons';
import { InlineNotice } from '../../../components/ui/molecules/InlineNotice';
import { formatDay } from '../model/finishFormat';
import type { FinishFacts } from '../model/finishSummary';
import { card, cardSuggestion, heading, small, text } from './finishStyles';

export interface FinishSectionCardsProps {
  suggest: boolean;
  facts: FinishFacts;
  openReviews: number;
  /** Zeitpunkt des letzten Spiel-Endes, wenn der Hinweis „läuft noch“ erscheint (@LZ-005); sonst `null`. */
  lateSince: string | null;
  onOpen: () => void;
}

export function FinishSectionCards({ suggest, facts, openReviews, lateSince, onOpen }: FinishSectionCardsProps) {
  const { t, i18n } = useTranslation('tournament');
  const lateDay = lateSince === null ? null : formatDay(lateSince, i18n.language);
  const button = (primary: boolean) => (
    <Button
      variant={primary ? 'primary' : 'secondary'} size="lg" icon={<Icons.Lock size={iconSizeValues.sm} />} onClick={onOpen}
      data-testid="tournament-finish-open" data-primary={primary} style={{ minHeight: primary ? cssVars.touchTargets.primary : cssVars.touchTargets.minimum }}
    >
      {t('finish.open')}
    </Button>
  );
  return (
    <div style={{ display: 'grid', gap: cssVars.spacing.md }} data-testid="finish-section">
      {lateDay !== null && (
        <InlineNotice tone="warn" data-testid="finish-late-hint"><span style={text}>{t('finish.section.lateHint', { date: lateDay })}</span></InlineNotice>
      )}
      {suggest ? (
        <section style={cardSuggestion} data-testid="finish-suggestion" aria-labelledby="finish-suggestion-title">
          <h3 id="finish-suggestion-title" style={heading}>{t('finish.section.suggestionTitle')}</h3>
          <p style={text}>{t('finish.section.suggestionText')}</p>
          <div>{button(true)}</div>
        </section>
      ) : (
        <section style={card} data-testid="finish-status" aria-labelledby="finish-status-title">
          <h3 id="finish-status-title" style={heading}>{t('finish.section.statusTitle')}</h3>
          <p style={text}>{t('finish.section.gamesDone', { done: facts.played, total: facts.total })}</p>
          {openReviews > 0 && <p style={small}>{t('finish.section.reviewsOpen', { count: openReviews })}</p>}
          <div>{button(false)}</div>
        </section>
      )}
    </div>
  );
}
