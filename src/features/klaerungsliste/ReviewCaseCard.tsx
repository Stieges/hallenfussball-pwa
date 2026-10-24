/**
 * B-50: ein Fall der Klärungsliste (@FU-038, @FU-095, @FU-096, @FU-017, @HE-056, @FU-130).
 * - Kopf: „3 Einträge von Tom nach Übernahme“, darunter „Spiel 9 · Feld 2“.
 * - Ein Eintrag: Zeile direkt sichtbar. Mehrere: „Einträge zeigen“ klappt die Häkchen auf (je gekoppelter Einheit eins,
 *   @FU-096), anfangs alle übernehmbaren gewählt.
 * - „Übernehmen“ zeigt vor dem Speichern die Vorschau (neuer Stand, Übernommenes; „nichts wird übernommen“), erst „Speichern“
 *   sendet, „Zurück“ speichert nichts. „Alle übernehmen“ / „Alle verwerfen“ (ab 2 Einträgen) und „Verwerfen“ (1 Eintrag)
 *   entscheiden mit einem Tipp. „Übernehmen“ gibt es nur, wenn der Fall etwas Übernehmbares hat (Review m2).
 * - VISUAL-DESIGN § 6/§ 8: „Übernehmen“/„Verwerfen“ gleichrangig als Zweittasten; Haupttaste nur „Speichern“ der EINEN offenen
 *   Vorschau im Dialog (`previewOpen`, Review m6), gesetzt über `DialogActions` (Haupttaste ≥ `touchTargets.primary`).
 */
import { useMemo, useState, type CSSProperties } from 'react';
import { Button } from '../../components/ui/Button';
import { DialogActions } from '../../components/ui/molecules/DialogActions';
import { InlineNotice } from '../../components/ui/molecules/InlineNotice';
import { cssVars } from '../../design-tokens';
import type { ReviewCase } from '../../core/match/review/reviewCases';
import type { MatchReview } from '../../core/match/review/matchReviewTypes';
import { acceptedReviews, decisionsFor, previewDecision, type ReviewDecision, type ReviewPreview } from '../../core/match/review/reviewDecision';
import type { MatchContext, MatchState } from '../../core/match';
import { caseTitle, deviceTime, entryLine, matchLine, reasonText, type TeamNameOf, type TFunction } from './reviewTexts';
import { useLooseT } from './useLooseT';

type CardPreview = ReviewPreview | { kind: 'list'; accepted: MatchReview[] };

export interface ReviewCaseCardProps {
  reviewCase: ReviewCase;
  teamName: TeamNameOf;
  /** Heutiger Stand und Kontext des Spiels für die Vorschau; `null` = Spiel hier nicht geladen. */
  basis: { state: MatchState; ctx: MatchContext; home: string; away: string } | null;
  now: () => number;
  busy: boolean;
  /** Ist die Vorschau dieses Falls die eine offene im Dialog? */
  previewOpen: boolean;
  onPreview: (open: boolean) => void;
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
const sub: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary, overflowWrap: 'break-word' };
const row: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: cssVars.spacing.sm };
const list: CSSProperties = { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: cssVars.spacing.xs };
const checkRow: CSSProperties = { display: 'flex', alignItems: 'center', gap: cssVars.spacing.sm, minHeight: cssVars.touchTargets.minimum, cursor: 'pointer', minWidth: 0 };
const checkbox: CSSProperties = { width: cssVars.spacing.lg, height: cssVars.spacing.lg, accentColor: cssVars.colors.primary, flex: 'none', margin: 0 };
const lineText: CSSProperties = { minWidth: 0, overflowWrap: 'break-word', fontSize: cssVars.fontSizes.md, color: cssVars.colors.textPrimary };
const timeText: CSSProperties = { fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary, fontVariantNumeric: 'tabular-nums' };

export function ReviewCaseCard({ reviewCase, teamName, basis, now, busy, previewOpen, onPreview, onDecide }: ReviewCaseCardProps) {
  const t = useLooseT();
  const { units } = reviewCase;
  const multi = reviewCase.count > 1;
  const canAccept = units.some((unit) => unit.acceptable);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(units.filter((u) => u.acceptable).map((u) => u.key)));
  const [preview, setPreview] = useState<CardPreview | null>(null);
  const testBase = `klaerung-fall-${reviewCase.units[0]?.key ?? reviewCase.key}`;
  const all = useMemo(() => new Set(units.map((u) => u.key)), [units]);
  const shown = previewOpen ? preview : null;

  const toggle = (key: string) => {
    onPreview(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  };
  const showPreview = () => {
    if (basis) {
      setPreview(previewDecision(basis.state, basis.ctx, units, selected, now()));
    } else {
      // ohne geladenen Stand: nur zeigen, was übernommen wird (kein Stand geraten)
      const accepted = acceptedReviews(units, selected);
      setPreview(accepted.length === 0 ? { kind: 'nothing' } : { kind: 'list', accepted });
    }
    onPreview(true);
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
            {multi && canAccept ? (
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

  const matchText = matchLine(t, reviewCase.matchNumber, reviewCase.field);
  return (
    <article style={card} data-testid={testBase} aria-label={caseTitle(t, reviewCase)}>
      <h3 style={title} data-testid={`${testBase}-titel`}>{caseTitle(t, reviewCase)}</h3>
      {matchText && <p style={sub}>{matchText}</p>}
      {(!multi || open) && lines}
      {shown ? (
        <>
          <div data-testid={`${testBase}-vorschau`} role="status"><PreviewText t={t} preview={shown} basis={basis} teamName={teamName} /></div>
          <DialogActions
            data-testid={`${testBase}-vorschau-tasten`}
            secondary={[{ label: t('tournament:klaerung.zurueck'), onClick: () => onPreview(false), disabled: busy, 'data-testid': `${testBase}-zurueck` }]}
            primary={{ label: t('tournament:klaerung.speichern'), onClick: () => onDecide(decisionsFor(units, selected)), disabled: busy || shown.kind === 'rejected', 'data-testid': `${testBase}-speichern` }}
          />
        </>
      ) : (
        <div style={row}>
          {multi && (
            <Button variant="ghost" onClick={() => setOpen((v) => !v)} aria-expanded={open} data-testid={`${testBase}-aufklappen`}>
              {t(open ? 'tournament:klaerung.zuklappen' : 'tournament:klaerung.aufklappen')}
            </Button>
          )}
          {canAccept && (!multi || open) && (
            <Button variant="secondary" disabled={busy} onClick={showPreview} data-testid={`${testBase}-uebernehmen`}>{t('tournament:klaerung.uebernehmen')}</Button>
          )}
          {multi && canAccept && (
            <Button variant="secondary" disabled={busy} onClick={() => onDecide(decisionsFor(units, all))} data-testid={`${testBase}-alle-uebernehmen`}>{t('tournament:klaerung.alleUebernehmen')}</Button>
          )}
          <Button variant="secondary" disabled={busy} onClick={() => onDecide(decisionsFor(units, new Set()))} data-testid={`${testBase}-${multi ? 'alle-verwerfen' : 'verwerfen'}`}>
            {t(multi ? 'tournament:klaerung.alleVerwerfen' : 'tournament:klaerung.verwerfen')}
          </Button>
        </div>
      )}
    </article>
  );
}

function PreviewText({ t, preview, basis, teamName }: { t: TFunction; preview: CardPreview; basis: ReviewCaseCardProps['basis']; teamName: TeamNameOf }) {
  if (preview.kind === 'nothing') {
    return <p style={sub}>{t('tournament:klaerung.vorschau.nichts')}</p>;
  }
  if (preview.kind === 'rejected') {
    return <InlineNotice tone="warn">{reasonText(t, preview.reason)}</InlineNotice>;
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
