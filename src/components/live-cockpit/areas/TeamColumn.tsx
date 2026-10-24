/**
 * TeamColumn – eine Team-Spalte des Live-Cockpits (Scheibe 3, Aufgabe 3.3; Spec § 4.2, § 8.2).
 *
 * Kopf mit Name, „Heim“/„Gast“ und Streifen in der Teamfarbe; Foul-Zähler gegen die Grenze (@SL-099); Tor über die
 * ganze Breite; darunter Foul, Zeitstrafe, Karte; laufende Strafen, Unterzahl, Ergänzen und Sperre als stehende Zeilen.
 * Keine Wechsel- und Minus-Knöpfe (@SL-037). Welche Knöpfe da sind, entscheidet der Aufrufer über `knoepfe`
 * (Zustand und Recht, `darfAktion`); die Kartenarten des Turniers blenden Karte und Zeitstrafe zusätzlich aus (@SL-026).
 */
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import { Button } from '../../ui/Button';
import { MatchIcons } from '../../ui/IconsMatch';
import type { TeamColumnModel, TeamKnoepfe } from '../model/toTeamColumnModel';
import { TeamKopf } from './TeamKopf';
import { useFeinerZeiger } from '../hooks/useFeinerZeiger';

export interface TeamColumnProps {
  model: TeamColumnModel;
  knoepfe: TeamKnoepfe;
  onTor: () => void;
  onFoul: () => void;
  onZeitstrafe: () => void;
  onKarte: () => void;
  /** Handy: die drei Knöpfe untereinander, ab 768 px in einer Reihe. */
  kompakt?: boolean;
  /** Ab 1024 px größere Schrift im Kopf. */
  breit?: boolean;
  /** Tastenkürzel dieser Seite (@SL-153): Tor `1`/`2`, Foul `F`/`J`; ohne Angabe (Schalter aus, kein Laptop) weder Hinweis noch `aria-keyshortcuts`. */
  taste?: { tor: string; foul: string };
}

// Beide Spalten teilen sich die Zeilen der Spaltenreihe (Subgrid): gleich hoch laufen Kopf, Tor und Knopfreihe, ohne dass der Kopf Platz für drei Namenszeilen
// reservieren muss; der längere Name macht beide Köpfe höher (@OB-025). Kopf (mit Zähler), Tor, Knopfreihe, Zusatzzeilen = vier Zeilen.
const spalteStil: CSSProperties = { display: 'grid', gridTemplateRows: 'subgrid', gridRow: 'span 4', rowGap: cssVars.spacing.sm, minWidth: 0 };
const zaehlerStil: CSSProperties = { fontSize: cssVars.fontSizes.md, color: cssVars.colors.textSecondary, fontWeight: cssVars.fontWeights.semibold };
// Volle Fläche in der Primärfarbe, Schrift in „auf Primär“ (Kontrast ≥ 4,5 : 1, VISUAL-DESIGN § 5), kein Verlauf
const torStil = (breit: boolean): CSSProperties => ({
  // Laptop (Mockup): doppelte Mindesthöhe, damit das Tor die größte Fläche der Spalte ist; sonst Haupttasten-Größe
  position: 'relative', minHeight: breit ? 'var(--cockpit-tor, var(--sizing-cockpit-tor-normal))' : cssVars.touchTargets.primary, width: '100%', ...(breit ? { padding: cssVars.spacing.xs } : {}), background: cssVars.colors.primary, color: cssVars.colors.onPrimary,
});
const knopfStil = (kompakt: boolean, breit: boolean): CSSProperties => ({
  position: 'relative', minHeight: breit ? 'var(--cockpit-fuss, var(--sizing-cockpit-fuss-normal))' : cssVars.touchTargets.minimum, flexDirection: kompakt ? 'row' : 'column', gap: kompakt ? cssVars.spacing.xs : 0,
  padding: kompakt || breit ? cssVars.spacing.xs : cssVars.spacing.sm, minWidth: 0,
});
const markeStil = (steht: boolean): CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', fontSize: cssVars.fontSizes.sm, color: cssVars.colors.warning,
  border: `${cssVars.borderWidth.thin} solid ${steht ? cssVars.colors.textMuted : cssVars.colors.warning}`,
  borderRadius: cssVars.borderRadius.sm, padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
});
const hinweisStil: CSSProperties = { fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary };
const zweizeilig: CSSProperties = { display: 'block' };
const einzeilig: CSSProperties = { display: 'inline' }; // Laptop: „Zeitstrafe 2 Min“ bricht nur um, wenn die Spalte zu schmal ist (Mockup: eine Zeile)

function Hinweis({ children, testId }: { children: ReactNode; testId?: string }): ReactElement {
  return <div style={hinweisStil} data-testid={testId}>{children}</div>;
}

// Kürzel-Hinweis oben rechts im Knopf (Mockup „haupt-720“): nur mit Maus oder Trackpad, Tablet und Handy haben keine Tasten (@SL-188)
const kbdChipStil = (aufPrimaer: boolean): CSSProperties => ({
  position: 'absolute', top: cssVars.spacing.xs, right: cssVars.spacing.xs, minWidth: cssVars.spacing.lg, boxSizing: 'border-box', textAlign: 'center',
  padding: `0 ${cssVars.spacing.xs}`, border: `${cssVars.borderWidth.thin} solid ${aufPrimaer ? 'currentColor' : cssVars.colors.borderControl}`,
  borderRadius: cssVars.borderRadius.sm, fontFamily: 'inherit', fontSize: cssVars.fontSizes.labelMd, fontWeight: cssVars.fontWeights.bold,
  color: aufPrimaer ? cssVars.colors.onPrimary : cssVars.colors.textSecondary,
});

export function TeamColumn({ model, knoepfe, onTor, onFoul, onZeitstrafe, onKarte, kompakt = false, breit = false, taste }: TeamColumnProps): ReactElement {
  const { t } = useTranslation('cockpit');
  const chips = useFeinerZeiger() && taste !== undefined;
  const { seite, name, fouls, strafen, kartenArten } = model;
  const foulText = fouls.grenze === null
    ? t('spalte.foulsOhneGrenze', { zaehlt: fouls.zaehlt })
    : t('spalte.fouls', { zaehlt: fouls.zaehlt, grenze: fouls.grenze });
  // Die Bildschirmleser-Fassung ohne Trennpunkt: „Foul SV Süd, Foul 5“ (@SL-102)
  const foulAria = fouls.grenze === null ? t('spalte.foulsOhneGrenzeAria', { zaehlt: fouls.zaehlt }) : foulText;
  const zeigeKarte = knoepfe.karte && (kartenArten.yellow || kartenArten.yellowRed || kartenArten.red);
  const zeigeStrafe = knoepfe.zeitstrafe && kartenArten.timePenalty;
  const reiheStil: CSSProperties = {
    display: 'grid', gap: cssVars.spacing.xs,
    gridTemplateColumns: kompakt ? '1fr' : `repeat(${[knoepfe.foul, zeigeStrafe, zeigeKarte].filter(Boolean).length || 1}, 1fr)`,
  };

  return (
    <section style={spalteStil} data-testid={`team-column-${seite}`} aria-label={name}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: cssVars.spacing.sm, minWidth: 0 }}>
      <TeamKopf seite={seite} name={name} kasten={model.kasten} breit={breit} fuellend />
      {/* Der Zähler steht im Foul-Knopf (Laptop-Mockup Stand 4); eine eigene Zeile nur ohne Foul-Knopf (Halbzeitpause, Nur-Lesen) */}
      {!knoepfe.foul && <div style={zaehlerStil} data-testid={`team-fouls-${seite}`}>{foulText}</div>}
      </div>
      {knoepfe.tor && (
        <Button size="lg" icon={<MatchIcons.Ball />} style={torStil(breit)} data-primary data-testid={`goal-button-${seite}`} onClick={onTor}
          aria-keyshortcuts={taste?.tor} aria-label={t('spalte.aria.tor', { team: name })}>{t('spalte.tor')}{chips && <kbd aria-hidden="true" data-testid={`tor-taste-${seite}`} style={kbdChipStil(true)}>{taste.tor}</kbd>}</Button>
      )}
      <div style={reiheStil} data-testid={`team-row3-${seite}`}>
        {knoepfe.foul && (
          <Button variant="secondary" icon={<MatchIcons.Flag />} style={knopfStil(kompakt, breit)} data-testid={`foul-button-${seite}`} onClick={onFoul}
            aria-keyshortcuts={taste?.foul} aria-label={t('spalte.aria.foul', { team: name, zaehler: foulAria })}>
            <span data-testid={`team-fouls-${seite}`}>{foulText}</span>
            {chips && <kbd aria-hidden="true" data-testid={`foul-taste-${seite}`} style={kbdChipStil(false)}>{taste.foul}</kbd>}
          </Button>
        )}
        {zeigeStrafe && (
          <Button variant="secondary" icon={<MatchIcons.Stopwatch />} style={knopfStil(kompakt, breit)} data-testid={`penalty-button-${seite}`} onClick={onZeitstrafe}
            aria-label={t('spalte.aria.strafe', { team: name })}>
            <span style={breit ? einzeilig : zweizeilig}>{t('spalte.strafeKnopf')}</span>{' '}
            <span style={breit ? einzeilig : zweizeilig}>{t('spalte.strafeDauer', { minuten: model.zeitstrafeMinuten })}</span>
          </Button>
        )}
        {zeigeKarte && (
          <Button variant="secondary" icon={<MatchIcons.Card />} style={knopfStil(kompakt, breit)} data-testid={`card-button-${seite}`} onClick={onKarte}
            aria-label={t('spalte.aria.karte', { team: name })}>{t('spalte.karte')}</Button>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: cssVars.spacing.sm, minWidth: 0 }}>
      {/* Am Laptop stehen die laufenden Strafen als Karten in der rechten Spalte (@SL-186), nicht noch einmal unter den Tasten */}
      {strafen.length > 0 && !breit && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: cssVars.spacing.xs }}>
          {strafen.map((s) => (
            <span key={s.id} style={markeStil(s.steht)} data-testid={`team-penalty-${s.id}`} data-steht={String(s.steht)}>
              {s.nummer === null ? t('spalte.strafeOhneNr', { rest: s.rest }) : t('spalte.strafe', { nummer: s.nummer, rest: s.rest })}
            </span>
          ))}
        </div>
      )}
      {model.unterzahl && <Hinweis>{t('spalte.unterzahl', { rest: model.unterzahl.rest })}</Hinweis>}
      {model.darfErgaenzen && <Hinweis>{t('spalte.ergaenzen')}</Hinweis>}
      {model.gesperrt.map((nummer) => <Hinweis key={nummer}>{t('spalte.gesperrt', { nummer })}</Hinweis>)}
      </div>
    </section>
  );
}
