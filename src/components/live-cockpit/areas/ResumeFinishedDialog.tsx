/**
 * ResumeFinishedDialog – „Spiel fortsetzen“ mit Restzeit (LT-6, @SL-074): Tom stellt die Restzeit ein, „Fortsetzen“ lässt das Spiel
 * mit dem Stand weiterlaufen. Auf `DialogSurface` (Plan Auflage 13); Regler `TimeStepper` wie „Uhr korrigieren“ (10 Sekunden je
 * Schritt, Grenzen aus `restGrenzenOf`). „Abbrechen“, Esc und Tipp daneben ändern nichts – der Endstand steht weiter.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import { Button } from '../../ui/Button';
import { DialogSurface } from '../../ui/molecules/DialogSurface';
import { TimeStepper } from '../../ui/molecules/TimeStepper';
import { FORTSETZEN_SCHRITT_S, type RestGrenzen } from '../model/fortsetzen';

export interface ResumeFinishedDialogProps {
  offen: boolean;
  spielNummer: number;
  grenzen: RestGrenzen | null;
  onFortsetzen: (restSekunden: number) => void;
  onAbbrechen: () => void;
}

const flaecheStil: CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: cssVars.spacing.md, padding: cssVars.spacing.lg };
const titelStil: CSSProperties = { fontSize: cssVars.fontSizes.lg, margin: 0 };
const textStil: CSSProperties = { fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary, margin: 0 };
const reglerStil: CSSProperties = { display: 'flex', justifyContent: 'center' };
const tastenStil: CSSProperties = { display: 'flex', gap: cssVars.spacing.md };
const knopfStil: CSSProperties = { minHeight: cssVars.touchTargets.primary, flex: 1 };

/** Sekunden als `m:ss` (Minuten ohne führende Null). */
function mmss(sekunden: number): string {
  return `${Math.floor(sekunden / 60)}:${String(sekunden % 60).padStart(2, '0')}`;
}

export function ResumeFinishedDialog({ offen, spielNummer, grenzen, onFortsetzen, onAbbrechen }: ResumeFinishedDialogProps): ReactElement | null {
  const { t } = useTranslation('cockpit');
  const abbrechenRef = useRef<HTMLButtonElement>(null);
  const [rest, setRest] = useState<number | null>(null);
  // Jedes Öffnen beginnt mit der Vorbelegung
  useEffect(() => { if (!offen) { setRest(null); } }, [offen]);
  if (!grenzen) { return null; }
  const wert = Math.min(grenzen.max, Math.max(grenzen.min, rest ?? grenzen.start));
  const titel = t('fortsetzen.titel', { spiel: spielNummer });
  return (
    <DialogSurface isOpen={offen} onClose={onAbbrechen} ariaLabel={titel} testId="resume-finished-dialog" initialFocusRef={abbrechenRef}>
      <div style={flaecheStil}>
        <h2 style={titelStil}>{titel}</h2>
        <p style={textStil}>{t('fortsetzen.restzeit')}</p>
        <div style={reglerStil}>
          <TimeStepper
            value={wert} min={grenzen.min} max={grenzen.max} step={FORTSETZEN_SCHRITT_S} format={mmss}
            labelDecrease={t('fortsetzen.weniger')} labelIncrease={t('fortsetzen.mehr')} onChange={setRest} testId="resume-rest-stepper"
          />
        </div>
        <p style={textStil}>{t('fortsetzen.hoechstens', { zeit: mmss(grenzen.max) })}</p>
        <div style={tastenStil} data-dialog-actions>
          <Button ref={abbrechenRef} variant="secondary" style={knopfStil} data-testid="resume-cancel" onClick={onAbbrechen}>{t('fortsetzen.abbrechen')}</Button>
          <Button variant="primary" style={knopfStil} data-testid="resume-apply" onClick={() => { onFortsetzen(wert); }}>{t('fortsetzen.fortsetzen')}</Button>
        </div>
      </div>
    </DialogSurface>
  );
}
