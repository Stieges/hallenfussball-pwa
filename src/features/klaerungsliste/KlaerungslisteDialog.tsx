/**
 * B-50: Klärungsliste der Turnierleitung als Dialog (URL `?klaerung=1`, URL-ROUTING Query-Parameter). Oben die offenen
 * Fälle (ältester zuerst), darunter die Hinweise „nachträglich eingefügt“ (@FU-037). Nach jeder Entscheidung wird die Liste
 * neu geladen; die Rückmeldung bleibt am Fall stehen, bis er verschwindet.
 */
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Dialog } from '../../components/dialogs';
import { cssVars, dialogWidths } from '../../design-tokens';
import type { Tournament } from '../../types/tournament';
import type { MatchReview } from '../../core/match/review/matchReviewTypes';
import { buildReviewCases, buildReviewNotices, type ReviewCase } from '../../core/match/review/reviewCases';
import type { ReviewDecision } from '../../core/match/review/reviewDecision';
import { ReviewCaseCard } from './ReviewCaseCard';
import { matchLine, noticeText, outcomeText } from './reviewTexts';
import { useLooseT } from './useLooseT';
import { useReviewDecision } from './useReviewDecision';

export interface KlaerungslisteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  tournament: Tournament;
  reviews: MatchReview[];
  refresh: () => Promise<void>;
}

const column: CSSProperties = { display: 'flex', flexDirection: 'column', gap: cssVars.spacing.md, minWidth: 0 };
const heading: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.md, fontWeight: cssVars.fontWeights.semibold, color: cssVars.colors.textSecondary };
const text: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.md, color: cssVars.colors.textPrimary, overflowWrap: 'break-word' };

export function KlaerungslisteDialog({ isOpen, onClose, tournament, reviews, refresh }: KlaerungslisteDialogProps) {
  const t = useLooseT();
  const api = useReviewDecision(tournament);
  const [busyCase, setBusyCase] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, string>>({});
  const cases = useMemo(() => buildReviewCases(reviews, api.penaltySeconds), [reviews, api.penaltySeconds]);
  const notices = useMemo(() => buildReviewNotices(reviews), [reviews]);
  // Spiele der offenen Fälle laden, damit die Vorschau den heutigen Stand kennt; danach neu zeichnen
  const [, setPrepared] = useState(0);
  const matchIds = useMemo(() => [...new Set(cases.map((c) => c.matchId))].join(','), [cases]);
  const { prepare } = api;
  useEffect(() => {
    if (!isOpen || matchIds === '') { return; }
    let alive = true;
    void Promise.all(matchIds.split(',').map((id) => prepare(id))).then(() => { if (alive) { setPrepared((n) => n + 1); } });
    return () => { alive = false; };
  }, [isOpen, matchIds, prepare]);

  const teamName = useCallback((teamId: string | null) => {
    if (teamId === null) { return null; }
    return tournament.teams.find((team) => team.id.toLowerCase() === teamId.toLowerCase())?.name ?? null;
  }, [tournament.teams]);

  const basisFor = (reviewCase: ReviewCase) => {
    const entry = api.entryFor(reviewCase.matchId);
    const state = api.stateFor(reviewCase.matchId);
    return entry && state ? { state, ctx: entry.ctx, home: entry.meta.homeTeam.name, away: entry.meta.awayTeam.name } : null;
  };

  const decide = async (reviewCase: ReviewCase, decisions: ReviewDecision[]) => {
    setBusyCase(reviewCase.key);
    try {
      const outcome = await api.decide(reviewCase.matchId, decisions);
      const message = outcomeText(t, outcome, reviewCase.matchNumber);
      setMessages((prev) => ({ ...prev, [reviewCase.key]: message ?? t('tournament:klaerung.ergebnis.gespeichert') }));
      await refresh();
    } finally {
      setBusyCase(null);
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={t('tournament:klaerung.titel')} maxWidth={dialogWidths.lg}>
      <div style={column} data-testid="klaerungsliste">
        {cases.length === 0 && notices.length === 0 && <p style={text} data-testid="klaerungsliste-leer">{t('tournament:klaerung.leer')}</p>}
        {cases.map((reviewCase) => (
          <ReviewCaseCard
            key={reviewCase.key}
            reviewCase={reviewCase}
            teamName={teamName}
            basis={basisFor(reviewCase)}
            now={api.serverNow}
            busy={busyCase === reviewCase.key}
            message={messages[reviewCase.key] ?? null}
            onDecide={(decisions) => { void decide(reviewCase, decisions); }}
          />
        ))}
        {notices.length > 0 && (
          <section style={column} data-testid="klaerungsliste-hinweise">
            <h3 style={heading}>{t('tournament:klaerung.hinweis.titel')}</h3>
            {notices.map((notice) => (
              <p key={notice.key} style={text} data-testid="klaerungsliste-hinweis">
                {noticeText(t, notice)}
                {matchLine(t, notice.matchNumber, null) && <span style={{ color: cssVars.colors.textSecondary }}> · {matchLine(t, notice.matchNumber, null)}</span>}
              </p>
            ))}
          </section>
        )}
      </div>
    </Dialog>
  );
}
