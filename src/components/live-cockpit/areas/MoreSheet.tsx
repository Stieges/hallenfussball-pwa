/**
 * MoreSheet – Blatt „Mehr“ des Live-Cockpits (Plan LT-1, Grundgerüst; Halbzeit, Fortsetzen und Helfer-Anfragen folgen in 3.7).
 *
 * Punkte: Uhr korrigieren, Seiten tauschen, Einstellungen. Auf `DialogSurface` (die Fläche ist modal), unter 600 px als Blatt
 * von unten, nie `ui/BottomSheet`. Abpfiff liegt in der Leiste (Entscheidung A2), nicht hier. Ein Punkt erscheint nur, wenn
 * der Aufrufer für ihn eine Aktion liefert (A-08c: ohne Handler kein Knopf); ob er im Zustand erlaubt ist, sagt
 * `mehrPunkteGrundgeruest` (`model/mehrPunkte.ts`, eigene Datei: reine Funktion, keine Komponente).
 */
import type { CSSProperties, ReactElement } from 'react';
import { useInRouterContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import { Button } from '../../ui/Button';
import { OwnTournamentsMoreItem } from '../../../features/helpers/components/OwnTournamentsMoreItem';
import { DialogSurface } from '../../ui/molecules/DialogSurface';
import type { MehrPunkt } from '../model/mehrPunkte';

export interface MoreSheetProps {
  isOpen: boolean;
  onClose: () => void;
  punkte: readonly MehrPunkt[];
  aktionen: Partial<Record<MehrPunkt, () => void>>;
  /** Für „Meine Turniere auf diesem Handy“ (Helfer-Gerät, @HE-110); ohne Turnier-Kennung kein solcher Punkt. */
  tournamentId?: string;
}

const flaecheStil: CSSProperties = { display: 'flex', flexDirection: 'column', gap: cssVars.spacing.md, padding: cssVars.spacing.lg };
const knopfStil: CSSProperties = { minHeight: cssVars.touchTargets.primary, width: '100%' };

const TEXT: Record<MehrPunkt, { key: 'mehr.uhrKorrigieren' | 'mehr.seitenTauschen' | 'mehr.einstellungen' | 'mehr.nichtAngetreten'; testId: string }> = {
  uhrKorrigieren: { key: 'mehr.uhrKorrigieren', testId: 'mehr-uhr-korrigieren' },
  seitenTauschen: { key: 'mehr.seitenTauschen', testId: 'mehr-seiten-tauschen' },
  nichtAngetreten: { key: 'mehr.nichtAngetreten', testId: 'mehr-nicht-angetreten' },
  einstellungen: { key: 'mehr.einstellungen', testId: 'mehr-einstellungen' },
};

export function MoreSheet({ isOpen, onClose, punkte, aktionen, tournamentId }: MoreSheetProps): ReactElement | null {
  const { t } = useTranslation('cockpit');
  const inRouter = useInRouterContext();
  return (
    <DialogSurface isOpen={isOpen} onClose={onClose} placement="sheet" ariaLabel={t('mehr.titel')} testId="more-sheet">
      <div style={flaecheStil}>
        <h2 style={{ fontSize: cssVars.fontSizes.lg, margin: 0 }}>{t('mehr.titel')}</h2>
        {punkte.map((punkt) => {
          const aktion = aktionen[punkt];
          if (!aktion) { return null; }
          return (
            <Button key={punkt} variant="secondary" style={knopfStil} data-testid={TEXT[punkt].testId} onClick={() => { onClose(); aktion(); }}>
              {t(TEXT[punkt].key)}
            </Button>
          );
        })}
        {isOpen && inRouter && tournamentId && <OwnTournamentsMoreItem tournamentId={tournamentId} onBeforeNavigate={onClose} />}
        <Button variant="ghost" style={knopfStil} data-testid="mehr-schliessen" onClick={onClose}>{t('mehr.schliessen')}</Button>
      </div>
    </DialogSurface>
  );
}
