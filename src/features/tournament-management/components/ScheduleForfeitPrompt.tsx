/**
 * ScheduleForfeitPrompt (B-12, @W2A-022, @W2A-024, @W2A-026): Rückfragen zu „nicht angetreten“ im Spielplan.
 * - mark (@SL-174, ein Dialog für Spielplan und Cockpit): Auswahl Heim / Gast / beide (Tasten ≥ 44 px, gewählte Taste
 *   hervorgehoben), darunter die Vorschau „X gewinnt 2:0 (Wertung)“; bei einem fehlenden Team die Wahl „Nur dieses Spiel“
 *   (vorgewählt) oder „Team ist abgereist – auch alle restlichen Spiele werten“ (@W2A-023). Die Haupttaste
 *   „Wertung eintragen“ ist unten rechts und bleibt gesperrt, bis gewählt ist. Titel und Tasten-Fuß stehen fest (Slots
 *   `header`/`footer`), nur die Auswahl dazwischen scrollt: „Wertung eintragen“ bleibt auch bei 360×640 im Bild (T2-UI).
 * - revoke: Rückfrage „Wertung zurücknehmen“ (ConfirmDialog).
 * Fläche `DialogSurface`, Fuß `DialogActions`. Abbruch speichert nichts.
 */
import { useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { DialogActions } from '../../../components/ui/molecules/DialogActions';
import { DialogSurface } from '../../../components/ui/molecules/DialogSurface';
import { cssVars, dialogWidths } from '../../../design-tokens';
import type { ForfeitAbsent } from '../../../types/tournament';
import type { ForfeitPrompt } from '../hooks/useScheduleForfeit';

export interface ScheduleForfeitPromptProps {
  prompt: ForfeitPrompt | null;
  answerPrompt: (answer: string | null) => void;
}

const bodyStyle: CSSProperties = { padding: cssVars.spacing.lg, display: 'flex', flexDirection: 'column', gap: cssVars.spacing.md };
const titleStyle: CSSProperties = { margin: 0, padding: `${cssVars.spacing.lg} ${cssVars.spacing.lg} ${cssVars.spacing.sm}`, fontSize: cssVars.fontSizes.lg, fontWeight: cssVars.fontWeights.bold, color: cssVars.colors.textPrimary };
const textStyle: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.md, color: cssVars.colors.textPrimary };
const choicesStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: cssVars.spacing.sm };

function MarkPrompt({ prompt, answerPrompt }: { prompt: Extract<ForfeitPrompt, { kind: 'mark' }>; answerPrompt: (answer: string | null) => void }) {
  const { t } = useTranslation('tournament');
  const [absent, setAbsent] = useState<ForfeitAbsent | null>(null);
  const [rest, setRest] = useState(false);
  const choices: { value: ForfeitAbsent; label: string }[] = [
    { value: 'A', label: t('schedule.forfeit.teamAbsent', { name: prompt.homeName }) },
    { value: 'B', label: t('schedule.forfeit.teamAbsent', { name: prompt.awayName }) },
    { value: 'both', label: t('schedule.forfeit.bothAbsent') },
  ];
  const summary = absent === null ? null
    : absent === 'both'
      ? t('schedule.forfeit.summaryBoth', { against: prompt.against })
      : t('schedule.forfeit.summaryOne', { winner: absent === 'A' ? prompt.awayName : prompt.homeName, score: prompt.scores[absent] });

  return (
    <DialogSurface
      isOpen
      onClose={() => answerPrompt(null)}
      maxWidth={dialogWidths.md}
      accent={cssVars.colors.warning}
      labelledBy="forfeit-title"
      header={<h2 id="forfeit-title" style={titleStyle}>{t('schedule.forfeit.title', { number: prompt.matchNumber })}</h2>}
      footer={(
        <DialogActions
          secondary={[{ label: t('schedule.forfeit.cancel'), onClick: () => answerPrompt(null), 'data-testid': 'forfeit-cancel' }]}
          primary={{ label: t('schedule.forfeit.confirm'), onClick: () => answerPrompt(absent === null ? null : rest ? `${absent}:rest` : absent), disabled: absent === null, 'data-testid': 'forfeit-confirm' }}
        />
      )}
    >
      <div style={bodyStyle} data-testid="forfeit-dialog">
        <p style={textStyle}>{t('schedule.forfeit.question')}</p>
        <div style={choicesStyle} role="group" aria-labelledby="forfeit-title">
          {choices.map((choice) => (
            <Button
              key={choice.value}
              variant={absent === choice.value ? 'primary' : 'secondary'}
              size="lg"
              fullWidth
              onClick={() => { setAbsent(choice.value); if (choice.value === 'both') { setRest(false); } }}
              data-testid={`forfeit-choice-${choice.value}`}
            >
              {choice.label}
            </Button>
          ))}
        </div>
        {summary !== null && <p role="status" style={textStyle} data-testid="forfeit-summary">{summary}</p>}
        {absent !== null && absent !== 'both' && (
          <div style={choicesStyle} role="group" aria-label={t('schedule.forfeit.scopeLabel')}>
            <Button variant={rest ? 'secondary' : 'primary'} size="lg" fullWidth onClick={() => setRest(false)} data-testid="forfeit-scope-this">
              {t('schedule.forfeit.scopeThis')}
            </Button>
            <Button variant={rest ? 'primary' : 'secondary'} size="lg" fullWidth onClick={() => setRest(true)} data-testid="forfeit-scope-rest">
              {t('schedule.forfeit.scopeRest')}
            </Button>
            {rest && (
              <p role="status" style={textStyle} data-testid="forfeit-rest-hint">
                {t('schedule.forfeit.scopeRestCount', { count: prompt.rest[absent], name: absent === 'A' ? prompt.homeName : prompt.awayName })}
              </p>
            )}
          </div>
        )}
      </div>
    </DialogSurface>
  );
}

export function ScheduleForfeitPrompt({ prompt, answerPrompt }: ScheduleForfeitPromptProps) {
  const { t } = useTranslation('tournament');
  if (!prompt) {
    return null;
  }
  if (prompt.kind === 'mark') {
    return <MarkPrompt key={prompt.matchNumber} prompt={prompt} answerPrompt={answerPrompt} />;
  }
  return (
    <ConfirmDialog
      variant="warning"
      title={t('schedule.forfeit.revokeTitle', { number: prompt.matchNumber })}
      message={t('schedule.forfeit.revokeQuestion')}
      confirmText={t('schedule.forfeit.revokeConfirm')}
      cancelText={t('schedule.forfeit.cancel')}
      onConfirm={() => answerPrompt('yes')}
      onCancel={() => answerPrompt(null)}
    />
  );
}
