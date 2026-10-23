/**
 * B-50: Klärungsliste der Turnierleitung als Dialog (URL `?klaerung=1`, URL-ROUTING Query-Parameter).
 * - Oben die Statuszeile der letzten Entscheidung (Review M1): sie bleibt stehen, auch wenn der Fall danach aus der Liste fällt
 *   („Bereits entschieden“, „Spiel 9 war schon beendet – … bitte neu abschließen“, „Geht nur mit Netz“).
 * - Offene Fälle (ältester zuerst); höchstens EINE Vorschau zugleich (eine Haupttaste im Dialog, Review m6).
 * - Hinweise „nachträglich eingefügt“ (@FU-037).
 * - „Zuletzt entschieden“: entschiedene Einträge mit „verworfen“ bzw. „übernommen von …, Uhrzeit“, jüngste zuerst – nur als
 *   Rückblick in der Liste. Der eine Verlauf je Spiel (B6.3, @FU-095) ist das Spielprotokoll im Cockpit
 *   (`discardedProtocol.ts`, `ProtocolRow` „verworfen von …“).
 */
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Dialog } from '../../components/dialogs';
import { InlineNotice } from '../../components/ui/molecules/InlineNotice';
import { cssVars, dialogWidths } from '../../design-tokens';
import type { Tournament } from '../../types/tournament';
import type { MatchReview } from '../../core/match/review/matchReviewTypes';
import { buildReviewCases, buildReviewNotices, type ReviewCase } from '../../core/match/review/reviewCases';
import type { ReviewDecision } from '../../core/match/review/reviewDecision';
import { ReviewCaseCard } from './ReviewCaseCard';
import { decisionLine, matchLine, noticeText, outcomeText, type OutboxTone } from './reviewTexts';
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
const small: CSSProperties = { ...text, fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary };
const list: CSSProperties = { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: cssVars.spacing.xs };

export function KlaerungslisteDialog({ isOpen, onClose, tournament, reviews, refresh }: KlaerungslisteDialogProps) {
  const t = useLooseT();
  const api = useReviewDecision(tournament);
  const [busyCase, setBusyCase] = useState<string | null>(null);
  const [previewCase, setPreviewCase] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<{ text: string; tone: OutboxTone } | null>(null);
  const cases = useMemo(() => buildReviewCases(reviews, api.penaltySeconds), [reviews, api.penaltySeconds]);
  const notices = useMemo(() => buildReviewNotices(reviews), [reviews]);
  const decided = useMemo(
    () => reviews.filter((r) => r.kind === 'review' && r.decision !== null).sort((a, b) => (b.decision?.at ?? 0) - (a.decision?.at ?? 0)),
    [reviews],
  );
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
      setMeldung(outcomeText(t, outcome, reviewCase.matchNumber));
      setPreviewCase(null);
      await refresh();
    } finally {
      setBusyCase(null);
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={t('tournament:klaerung.titel')} maxWidth={dialogWidths.lg}>
      <div style={column} data-testid="klaerungsliste">
        {meldung && <InlineNotice tone={meldung.tone} data-testid="klaerungsliste-meldung">{meldung.text}</InlineNotice>}
        {cases.length === 0 && <p style={text} data-testid="klaerungsliste-leer">{t('tournament:klaerung.leer')}</p>}
        {cases.map((reviewCase) => (
          <ReviewCaseCard
            key={reviewCase.key}
            reviewCase={reviewCase}
            teamName={teamName}
            basis={basisFor(reviewCase)}
            now={api.serverNow}
            busy={busyCase !== null}
            previewOpen={previewCase === reviewCase.key}
            onPreview={(open) => setPreviewCase(open ? reviewCase.key : null)}
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
        {decided.length > 0 && (
          <section style={column} data-testid="klaerungsliste-verlauf">
            <h3 style={heading}>{t('tournament:klaerung.verlauf.titel')}</h3>
            <ul style={list}>
              {decided.map((review) => (
                <li key={review.eventId} style={small} data-testid={`klaerung-verlauf-${review.eventId}`}>
                  {decisionLine(t, review, teamName)}
                  {matchLine(t, review.matchNumber, null) && <span> · {matchLine(t, review.matchNumber, null)}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Dialog>
  );
}
