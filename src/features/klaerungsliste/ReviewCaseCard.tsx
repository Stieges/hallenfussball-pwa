/**
 * B-50: ein Fall der Klärungsliste (@FU-038, @FU-095, @FU-096, @FU-017, @HE-056, @FU-130).
 * - Kopf: „3 Einträge von Tom nach Übernahme“, darunter „Spiel 9 · Feld 2“.
 * - Ein Eintrag: Zeile direkt sichtbar. Mehrere: „Einträge zeigen“ klappt die Häkchen auf (je gekoppelter Einheit eins,
 *   @FU-096), anfangs alle gewählt.
 * - „Übernehmen“ zeigt vor dem Speichern die Vorschau (neuer Stand, Übernommenes; „nichts wird übernommen“), erst „Speichern“
 *   sendet. „Alle übernehmen“ / „Alle verwerfen“ (ab 2 Einträgen) und „Verwerfen“ (1 Eintrag) entscheiden mit einem Tipp.
 * - VISUAL-DESIGN § 8: „Übernehmen“/„Verwerfen“ gleichrangig als Zweittasten; Haupttaste nur „Speichern“ in der Vorschau.
 */
import { useMemo, useState, type CSSProperties } from 'react';
import { useLooseT } from './useLooseT';
import { Button } from '../../components/ui/Button';
import { InlineNotice } from '../../components/ui/molecules/InlineNotice';
import { cssVars } from '../../design-tokens';
import type { ReviewCase } from '../../core/match/review/reviewCases';
import { acceptedReviews, decisionsFor, previewDecision, type ReviewDecision, type ReviewPreview } from '../../core/match/review/reviewDecision';
import type { MatchReview } from '../../core/match/review/matchReviewTypes';

type CardPreview = ReviewPreview | { kind: 'list'; accepted: MatchReview[] };
import type { MatchContext, MatchState } from '../../core/match';
import { caseTitle, deviceTime, entryLine, matchLine, type TeamNameOf } from './reviewTexts';

export interface ReviewCaseCardProps {
  reviewCase: ReviewCase;
  teamName: TeamNameOf;
  /** Heutiger Stand und Kontext des Spiels für die Vorschau; `null` = Spiel hier nicht geladen. */
  basis: { state: MatchState; ctx: MatchContext; home: string; away: string } | null;
  now: () => number;
  busy: boolean;
  message: string | null;
  onDecide: (decisions: ReviewDecision[]) => void;
}

const card: CSSProperties = {
  border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`,
  borderRadius: cssVars.borderRadius.md,
  background: cssVars.colors.surface,
  padding: cssVars.spacing.md,
  display: 'flex',
  flexDirection: 'column',
  gap: cssVars.spacing.sm,
  minWidth: 0,
};
const title: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.md, fontWeight: cssVars.fontWeights.semibold, color: cssVars.colors.textPrimary, overflowWrap: 'break-word' };
const sub: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary };
const row: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: cssVars.spacing.sm };
const list: CSSProperties = { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: cssVars.spacing.xs };
const checkRow: CSSProperties = { display: 'flex', alignItems: 'center', gap: cssVars.spacing.sm, minHeight: cssVars.touchTargets.minimum, cursor: 'pointer', minWidth: 0 };
const checkbox: CSSProperties = { width: cssVars.spacing.lg, height: cssVars.spacing.lg, accentColor: cssVars.colors.primary, flex: 'none', margin: 0 };
const lineText: CSSProperties = { minWidth: 0, overflowWrap: 'break-word', fontSize: cssVars.fontSizes.md, color: cssVars.colors.textPrimary };
const timeText: CSSProperties = { fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary, fontVariantNumeric: 'tabular-nums' };

export function ReviewCaseCard({ reviewCase, teamName, basis, now, busy, message, onDecide }: ReviewCaseCardProps) {
  const t = useLooseT();
  const { units } = reviewCase;
  const multi = reviewCase.count > 1;
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(units.filter((u) => u.acceptable).map((u) => u.key)));
  const [preview, setPreview] = useState<CardPreview | null>(null);
  const testBase = `klaerung-fall-${reviewCase.units[0]?.key ?? reviewCase.key}`;

  const toggle = (key: string) => {
    setPreview(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  };
  const all = useMemo(() => new Set(units.map((u) => u.key)), [units]);
  const showPreview = () => {
    if (basis) {
      setPreview(previewDecision(basis.state, basis.ctx, units, selected, now()));
      return;
    }
    // ohne geladenen Stand: nur zeigen, was übernommen wird (kein Stand geraten)
    const accepted = acceptedReviews(units, selected);
    setPreview(accepted.length === 0 ? { kind: 'nothing' } : { kind: 'list', accepted });
  };

  const lines = (
    <ul style={list}>
      {units.map((unit) => {
        const text = unit.reviews.map((r) => entryLine(t, r, teamName)).join(' + ');
        const time = deviceTime(t, unit.reviews[0]);
        const inner = (
          <span style={lineText}>
            {text}
            {time && <span style={timeText}> · {time}</span>}
            {!unit.acceptable && <span style={timeText}> · {t('tournament:klaerung.nurVerwerfen')}</span>}
          </span>
        );
        return (
          <li key={unit.key} data-testid={`klaerung-einheit-${unit.key}`}>
            {multi ? (
              <label style={checkRow}>
                <input
                  type="checkbox" style={checkbox} checked={selected.has(unit.key)} disabled={!unit.acceptable || busy}
                  onChange={() => toggle(unit.key)} data-testid={`klaerung-haken-${unit.key}`}
                />
                {inner}
              </label>
            ) : inner}
          </li>
        );
      })}
    </ul>
  );

  return (
    <article style={card} data-testid={testBase} aria-label={caseTitle(t, reviewCase)}>
      <h3 style={title} data-testid={`${testBase}-titel`}>{caseTitle(t, reviewCase)}</h3>
      {matchLine(t, reviewCase.matchNumber, reviewCase.field) && <p style={sub}>{matchLine(t, reviewCase.matchNumber, reviewCase.field)}</p>}
      {(!multi || open) && lines}
      {preview && (
        <div data-testid={`${testBase}-vorschau`} role="status">
          <PreviewText preview={preview} basis={basis} teamName={teamName} />
        </div>
      )}
      {message && <InlineNotice tone="info" data-testid={`${testBase}-meldung`}>{message}</InlineNotice>}
      <div style={row}>
        {preview ? (
          <>
            <Button variant="secondary" disabled={busy} onClick={() => setPreview(null)} data-testid={`${testBase}-zurueck`}>{t('tournament:klaerung.zurueck')}</Button>
            <Button variant="primary" data-primary disabled={busy || preview.kind === 'rejected'} onClick={() => onDecide(decisionsFor(units, selected))} data-testid={`${testBase}-speichern`}>{t('tournament:klaerung.speichern')}</Button>
          </>
        ) : (
          <>
            {multi && (
              <Button variant="ghost" onClick={() => setOpen((v) => !v)} aria-expanded={open} data-testid={`${testBase}-aufklappen`}>
                {t(open ? 'tournament:klaerung.zuklappen' : 'tournament:klaerung.aufklappen')}
              </Button>
            )}
            {(!multi || open) && (
              <Button variant="secondary" disabled={busy} onClick={showPreview} data-testid={`${testBase}-uebernehmen`}>{t('tournament:klaerung.uebernehmen')}</Button>
            )}
            {multi ? (
              <>
                <Button variant="secondary" disabled={busy} onClick={() => onDecide(decisionsFor(units, all))} data-testid={`${testBase}-alle-uebernehmen`}>{t('tournament:klaerung.alleUebernehmen')}</Button>
                <Button variant="secondary" disabled={busy} onClick={() => onDecide(decisionsFor(units, new Set()))} data-testid={`${testBase}-alle-verwerfen`}>{t('tournament:klaerung.alleVerwerfen')}</Button>
              </>
            ) : (
              <Button variant="secondary" disabled={busy} onClick={() => onDecide(decisionsFor(units, new Set()))} data-testid={`${testBase}-verwerfen`}>{t('tournament:klaerung.verwerfen')}</Button>
            )}
          </>
        )}
      </div>
    </article>
  );
}

function PreviewText({ preview, basis, teamName }: { preview: CardPreview; basis: ReviewCaseCardProps['basis']; teamName: TeamNameOf }) {
  const t = useLooseT();
  if (preview.kind === 'nothing') {
    return <p style={sub}>{t('tournament:klaerung.vorschau.nichts')}</p>;
  }
  if (preview.kind === 'rejected') {
    const text = preview.reason === 'KNOCKOUT_FINISHED' ? t('tournament:klaerung.vorschau.koBeendet') : t('tournament:klaerung.vorschau.nichtMoeglich', { reason: preview.reason ?? preview.code });
    return <InlineNotice tone="warn">{text}</InlineNotice>;
  }
  const list = t('tournament:klaerung.vorschau.uebernommen', { list: preview.accepted.map((r) => entryLine(t, r, teamName)).join(', ') });
  if (preview.kind === 'list') {
    return <p style={sub}>{list}</p>;
  }
  return (
    <>
      <p style={{ ...sub, color: cssVars.colors.textPrimary, fontVariantNumeric: 'tabular-nums' }}>
        {t('tournament:klaerung.vorschau.stand', { home: basis?.home ?? '', away: basis?.away ?? '', score: `${preview.home}:${preview.away}` })}
      </p>
      <p style={sub}>{list}</p>
    </>
  );
}
