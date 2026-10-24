/**
 * Hinweis zu einem offenen Gleichstand (Paket TB-B, TB-6b'; Mockup v3, Daniel G5): zwei Formen – „Strafstoßschießen nötig“
 * (Platz muss ausgespielt werden, nur dieser Weg) und „Gleichstand – Entscheidung nötig“ (Wahl zwischen Strafstoßschießen
 * und „Ergebnis so akzeptieren“). Turnierleitung und Co-Admin bekommen die Taste, der Helfer nur den Text, wer entscheidet
 * (@W2A-050). Ohne Netz bleibt die Taste sichtbar, ist gesperrt und nennt „Gruppe abschließen“ als Weg (@W2A-062, F9).
 */
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens';
import { Button } from '../../../components/ui/Button';
import { InlineNotice } from '../../../components/ui/molecules/InlineNotice';
import type { OpenTieBlock } from '../../../core/standings/tieViews';
import type { BlockWithdrawal } from '../../../core/standings/decisionLog';
import { listText, placeText, timeText } from './tieFormat';
import { useTiePlaceTexts } from './useTiePlaceTexts';

export interface OpenTieNoticeProps {
  block: OpenTieBlock;
  names: string[];
  canDecide: boolean;
  online: boolean;
  /**
   * Wer wann die Entscheidung zurückgenommen hat – und wer sie wann eingetragen hatte (nur Turnierleitung, aus dem Verlauf, @W2A-070;
   * eine Zeile: „akzeptiert von Olli · 14:32 · Zurückgenommen von Maria · 14:35“).
   */
  withdrawn?: BlockWithdrawal;
  onEntry: () => void;
}

const title: CSSProperties = { fontWeight: cssVars.fontWeights.semibold, fontSize: cssVars.fontSizes.md };
const line: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.md, lineHeight: cssVars.lineHeights.bodyMd };
// Innenabstand klein: auf 360 px bleibt für „Strafstoßschießen eintragen“ genug Breite, ohne Wort im Wort zu brechen
const actionButton: CSSProperties = { minHeight: cssVars.touchTargets.primary, padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}` };
const lockedButton: CSSProperties = {
  ...actionButton,
  opacity: 1,
  background: 'transparent',
  color: cssVars.colors.textSecondary,
  border: `${cssVars.borderWidth.thin} dashed ${cssVars.colors.borderControl}`,
};

/** Eine Zeile: Wer entschieden hat (soweit bekannt) · Zurückgenommen von … */
function withdrawnLine(t: TFunction<'tournament'>, language: string, { withdrawn, decided }: BlockWithdrawal): string {
  const back = withdrawn.name !== undefined
    ? t('standingsTie.notice.withdrawnBy', { name: withdrawn.name, time: timeText(withdrawn.at, language) })
    : t('standingsTie.notice.withdrawnByUnknown', { time: timeText(withdrawn.at, language) });
  if (decided === undefined) {
    return back;
  }
  const what = decided.kind === 'shared' ? 'accepted' : decided.kind === 'shootout' ? 'shootout' : 'order';
  const time = timeText(decided.at, language);
  const front = decided.name !== undefined ? t(`standingsTie.notice.${what}By`, { name: decided.name, time }) : t(`standingsTie.notice.${what}ByUnknown`, { time });
  return `${front} · ${back}`;
}

export const OpenTieNotice = ({ block, names, canDecide, online, withdrawn, onEntry }: OpenTieNoticeProps) => {
  const { t, i18n } = useTranslation('tournament');
  const placeTexts = useTiePlaceTexts();
  const choice = block.mayShare;
  const places = placeText(placeTexts, block.place, block.place + block.size - 1);
  const reason = block.mandatory;
  const entry = choice ? 'decide' : block.size === 2 ? 'shootout' : 'order';
  const helperLine = choice ? t('standingsTie.notice.helperChoice') : block.size === 2 ? t('standingsTie.notice.helperShootout') : t('standingsTie.notice.helperOrder');
  const locked = !online;

  return (
    <InlineNotice
      tone="warn"
      data-testid={choice ? 'tie-hint-choice' : 'tie-hint-mandatory'}
      footer={canDecide ? (
        <>
          <Button
            variant={locked ? 'secondary' : 'primary'}
            size="lg"
            fullWidth
            disabled={locked}
            onClick={onEntry}
            style={locked ? lockedButton : actionButton}
            data-primary
            data-testid={`tie-${entry}-entry`}
          >
            {t(`standingsTie.notice.${entry}`)}
          </Button>
          {locked ? <p style={{ ...line, fontWeight: cssVars.fontWeights.semibold }} data-testid="tie-offline-hint">{t('standingsTie.notice.offline')}</p> : null}
        </>
      ) : undefined}
    >
      <span style={title}>{choice ? t('standingsTie.notice.openTitle') : t('standingsTie.notice.needTitle')}</span>
      <p style={line}>{t('standingsTie.notice.teamsEqual', { names: listText(names, i18n.language), places })}</p>
      {canDecide && withdrawn !== undefined ? (
        <p style={line} data-testid="tie-withdrawn-by">{withdrawnLine(t, i18n.language, withdrawn)}</p>
      ) : null}
      {reason?.kind === 'setting' ? <p style={line}>{t('standingsTie.notice.needSetting', { place: reason.place })}</p> : null}
      {reason?.kind === 'followUp' ? <p style={line}>{t('standingsTie.notice.needFollowUp', { place: reason.place })}</p> : null}
      {choice && canDecide ? <p style={line}>{t('standingsTie.notice.openChoice')}</p> : null}
      {!canDecide ? <p style={line}>{helperLine}</p> : null}
    </InlineNotice>
  );
};
