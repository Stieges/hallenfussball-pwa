/**
 * NurLesenLeiste – ersetzt die Daumenleiste, wenn dieses Gerät nur liest (`kannSteuern = false`, Spec § 4.4, @SL-018).
 *
 * Zeile „Feld 1 wird von Tom gesteuert“ bzw. nach dem Verlust der Steuer „Die Spielleitung hat jetzt Olli“ (@FU-026, @FU-027, B-49)
 * mit „Spielleitung übernehmen“ (nur mit `onUebernehmen`, @SL-046, @SL-015), dazu die zwei Wege,
 * die auch lesend offen bleiben: die Liste der Einträge (unter 1024 px) und „Mehr“ (Einstellungen gesperrt sichtbar,
 * Seiten tauschen). Keine Werkzeugleiste, keine Steuer-Knöpfe.
 */
import type { CSSProperties, ReactElement } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import { Button } from '../../ui/Button';
import { MatchIcons } from '../../ui/IconsMatch';
import type { LiveCockpitLeisteProps } from '../typesLeiste';

export interface NurLesenLeisteProps {
  fieldName: string;
  steuerung?: LiveCockpitLeisteProps['steuerung'];
  /** Turnier abgeschlossen (R3-3): statt eines Helfer-Satzes steht „Das Turnier ist abgeschlossen“. */
  abgeschlossen?: boolean;
  mitEreignissen: boolean;
  onEreignisse: () => void;
  onMehr: () => void;
}

const stil: CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: cssVars.spacing.sm,
  padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
  paddingBottom: `calc(${cssVars.spacing.sm} + env(safe-area-inset-bottom, 0px))`,
  background: cssVars.colors.surfaceSolid, borderTop: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`,
};
const reiheStil: CSSProperties = { display: 'flex', gap: cssVars.spacing.sm };
const knopfStil: CSSProperties = { flex: 1, minHeight: cssVars.touchTargets.minimum };

type Steuerung = NonNullable<LiveCockpitLeisteProps['steuerung']>;

function steuerText(t: TFunction<'cockpit'>, feld: string, s: Steuerung): string {
  const name = s.leitetName;
  if (s.verloren === true) {
    return name !== null ? t('leiste.uebergegangen', { name }) : t('leiste.uebergegangenOhneName');
  }
  return name !== null ? t('leiste.leitet', { feld, name }) : t('leiste.leitetOhneName', { feld });
}

export function NurLesenLeiste({ fieldName, steuerung, abgeschlossen = false, mitEreignissen, onEreignisse, onMehr }: NurLesenLeisteProps): ReactElement {
  const { t } = useTranslation('cockpit');
  return (
    <div data-testid="leiste-nur-lesen" style={stil}>
      {abgeschlossen && <div data-testid="leiste-abgeschlossen">{t('leiste.abgeschlossen')}</div>}
      {steuerung && <div data-testid="leiste-leitet" role="status">{steuerText(t, fieldName, steuerung)}</div>}
      {steuerung?.onUebernehmen && (
        <Button variant="primary" style={{ minHeight: cssVars.touchTargets.primary }} data-testid="leiste-uebernehmen" onClick={steuerung.onUebernehmen}>
          {t('leiste.uebernehmen')}
        </Button>
      )}
      <div style={reiheStil}>
        {mitEreignissen && (
          <Button variant="secondary" style={knopfStil} icon={<MatchIcons.List />} data-testid="match-event-log-button" onClick={onEreignisse}>{t('leiste.ereignisse')}</Button>
        )}
        <Button variant="secondary" style={knopfStil} icon={<MatchIcons.More />} data-testid="cockpit-more-button" onClick={onMehr}>{t('leiste.mehr')}</Button>
      </div>
    </div>
  );
}
