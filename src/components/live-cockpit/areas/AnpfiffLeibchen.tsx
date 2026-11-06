/**
 * AnpfiffLeibchen – Leibchen in der Anpfiff-Ansicht (@SL-137, @SL-138, @SL-139, @SL-148, @SL-149, @SL-151, @SL-173).
 *
 * Der Hinweis auf gleiche oder zu ähnliche Farben steht in der Tafel (@SL-196), „Ohne Leibchen anpfeifen“ in der Daumenleiste neben dem
 * Anpfiff (@SL-149). `LeibchenSeite`: „Leibchen für …“ in der Spalte des Teams (im Platz der Tor-Taste, sichtbar „Leibchen“, der zugängliche
 * Name nennt das Team), Heim bei Konflikt vorbelegt; ein Tipp auf die gewählte Seite hebt die Wahl auf. `AnpfiffLeibchen` darunter: Mit Leibchen die Leibchenfarbe (vorbelegt mit der des
 * Turniers, änderbar). Ist sie der Farbe des Gegners zu ähnlich, sagt der Bereich das (@SL-151); anpfeifen geht trotzdem. Ohne Konflikt
 * nur „Leibchen festlegen“ (freiwillig, @SL-138). Die Wahl gilt nur für dieses Spiel.
 */
import type { CSSProperties, ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import type { KitSide } from '../../../core/models/kit';
import { leibchenFarbName } from '../../../core/models/kitChoice';
import { Button } from '../../ui/Button';
import { Icons } from '../../ui/Icons';
import { MatchIcons } from '../../ui/IconsMatch';
import { fillTextColor } from '../../ui/molecules/scoreBoxStyle';
import type { LeibchenWahlZustand } from '../hooks/useLeibchenWahl';

export interface LeibchenSeiteProps {
  zustand: LeibchenWahlZustand;
  seite: KitSide;
  team: string;
}

const seitenKnopf = (gewaehlt: boolean): CSSProperties => ({
  minHeight: cssVars.touchTargets.minimum, height: cssVars.touchTargets.minimum, paddingTop: 0, paddingBottom: 0, minWidth: 0, width: '100%',
  ...(gewaehlt ? { background: cssVars.colors.primaryLight, borderColor: cssVars.colors.primary, fontWeight: cssVars.fontWeights.bold } : {}),
});

/** Taste „Leibchen für <Team>“ in der Spalte des Teams; steht nur, wenn die Seiten zur Wahl stehen (`zeigeSeiten`). */
export function LeibchenSeite({ zustand, seite, team }: LeibchenSeiteProps): ReactElement | null {
  const { t } = useTranslation('cockpit');
  if (!zustand.zeigeSeiten) { return null; }
  const gewaehlt = zustand.wahl.bibSide === seite;
  return (
    <Button variant="secondary" aria-pressed={gewaehlt} aria-label={t('anpfiff.leibchenFuer', { team })} style={seitenKnopf(gewaehlt)}
      icon={gewaehlt ? <Icons.Check /> : <MatchIcons.Shirt />} data-testid={`anpfiff-leibchen-${seite === 'a' ? 'heim' : 'gast'}`}
      onClick={() => { zustand.waehleSeite(gewaehlt ? null : seite); }}>
      {t('anpfiff.leibchen')}
    </Button>
  );
}

export interface AnpfiffLeibchenProps {
  zustand: LeibchenWahlZustand;
  /** Namen der Seiten (`a` = Heim, `b` = Gast). */
  teams: { a: string; b: string };
}

const flaeche: CSSProperties = { display: 'flex', flexDirection: 'column', gap: cssVars.spacing.xs, minWidth: 0 };
const farbReihe: CSSProperties = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: cssVars.spacing.sm };
const farbKnopf = (farbe: string, gewaehlt: boolean): CSSProperties => ({
  width: cssVars.touchTargets.minimum, height: cssVars.touchTargets.minimum, borderRadius: cssVars.borderRadius.full, background: farbe,
  border: `${cssVars.borderWidth.medium} solid ${gewaehlt ? cssVars.colors.textPrimary : cssVars.colors.borderControl}`,
  outline: gewaehlt ? `${cssVars.borderWidth.medium} solid ${cssVars.colors.primary}` : undefined, outlineOffset: gewaehlt ? cssVars.borderWidth.medium : undefined,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, cursor: 'pointer', flex: 'none',
});

/** Unter den Spalten: „Leibchen festlegen“ (ohne Konflikt), die Leibchenfarbe und der Hinweis Leibchen gegen Gegner (@SL-151). */
export function AnpfiffLeibchen({ zustand, teams }: AnpfiffLeibchenProps): ReactElement {
  const { t } = useTranslation('cockpit');
  const { wahl, hinweis, farben } = zustand;
  const name = (seite: KitSide): string => (seite === 'a' ? teams.a : teams.b);
  const gegner = wahl.bibSide === null ? '' : name(wahl.bibSide === 'a' ? 'b' : 'a');
  const farbName = (farbe: string): string => t(`anpfiff.farbe.${leibchenFarbName(farbe) ?? 'turnier'}`);

  return (
    <div style={flaeche} data-testid="anpfiff-leibchen" data-hinweis={hinweis}>
      {!zustand.zeigeSeiten && (
        <Button variant="secondary" icon={<MatchIcons.Shirt />} style={{ minHeight: cssVars.touchTargets.minimum }} data-testid="anpfiff-leibchen-festlegen" onClick={zustand.oeffne}>
          {t('anpfiff.festlegen')}
        </Button>
      )}
      {wahl.bibSide !== null && (
        <div style={farbReihe} role="group" aria-label={t('anpfiff.farbeLabel', { farbe: farbName(wahl.bibColor) })}>
          {farben.map((farbe) => (
            <button key={farbe} type="button" aria-pressed={wahl.bibColor === farbe} style={farbKnopf(farbe, wahl.bibColor === farbe)}
              aria-label={zustand.zuAehnlich(farbe) ? t('anpfiff.farbeZuAehnlich', { farbe: farbName(farbe), gegner }) : farbName(farbe)}
              data-zu-aehnlich={zustand.zuAehnlich(farbe) ? 'true' : undefined}
              data-testid={`anpfiff-leibchen-farbe-${leibchenFarbName(farbe) ?? 'turnier'}`} onClick={() => zustand.waehleFarbe(farbe)}>
              {/* Gewählt: Häkchen; dem Gegner zu ähnlich: Warnzeichen (nicht nur die Farbe trägt die Bedeutung, @SL-151) */}
              {(wahl.bibColor === farbe || zustand.zuAehnlich(farbe)) && (
                <span style={{ display: 'inline-flex', color: fillTextColor({ kind: 'solid', color: farbe }) }}>
                  {wahl.bibColor === farbe ? <Icons.Check size={iconSizeValues.sm} /> : <Icons.AlertTriangle size={iconSizeValues.sm} />}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
