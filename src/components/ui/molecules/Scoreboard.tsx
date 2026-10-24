/**
 * Scoreboard – Tafel-Block des Live-Cockpits (Cockpit-Spec § 4.1, § 6, § 8.2).
 *
 * Oben Zustands-Abzeichen, Abschnitt und die Abzeichen (Einträge warten, Helfer-Anfrage, Ton, Wachhalten), in der
 * Mitte Stand-Kasten | Uhr | Stand-Kasten (ab `regular` mit Teamnamen), darunter stehende Zeilen und die Meldezeile
 * (`NoticeLine`) im selben Block. Texte kommen fertig im Modell (kein i18n im Baustein), Farben und Maße nur aus
 * Tokens. Die Uhr ist reine Anzeige und wird nicht sekündlich vorgelesen; Stand und Zustand sind `aria-live="polite"`.
 * Die Tafel ist in beiden Themes dunkel (Tokens `scoreboard*`).
 */
import type { CSSProperties, ReactElement } from 'react';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { getColorsByTheme } from '../../../design-tokens/colors';
import { ScoreBox } from './ScoreBox';
import { ClockDigits } from '../atoms/ClockDigits';
import { pairFrameStrength } from './scoreBoxStyle';
import styles from './Scoreboard.module.css';
import { Icons } from '../Icons';
import { TafelIcons } from '../IconsTafel';
import { MatchStatusBadge } from './MatchStatusBadge';
import { Abzeichen } from './ScoreboardAbzeichen';
import { ueberstandVon, zeileHoehe } from './scoreboardAbzeichenMasse';
import { ScoreboardDesktop } from './ScoreboardDesktop';
import type { ScoreboardSeite, ScoreboardProps } from './scoreboardTypes';

export type {
  ScoreboardSeite, ScoreboardBalken, ScoreboardUhr, ScoreboardModel, ScoreboardAbzeichenKnopf, ScoreboardProps,
} from './scoreboardTypes';

// Die Tafel ist in beiden Themes dunkel; `ScoreBox` rechnet Kontrast und Rahmen aus Hex-Werten (keine CSS-Variablen möglich)
const tafelFarben = getColorsByTheme('dark');

export function Scoreboard(props: ScoreboardProps): ReactElement {
  // Laptop: die Tafel wie am Hallenmonitor (Plan Cockpit v2 B1); Handy und Tablet hochkant behalten diese Tafel
  return props.size === 'wide' ? <ScoreboardDesktop {...props} /> : <ScoreboardKompakt {...props} />;
}

function ScoreboardKompakt({ model, size, stufe, meldezeile, onHelferAnfragen, testId, wachhaltenHinweis, tonHinweis, kopfRechts }: ScoreboardProps): ReactElement {
  const gross = size !== 'compact';
  const id = (teil: string): string | undefined => (testId ? `${testId}-${teil}` : undefined);
  const uhr = model.uhr;
  const icon = iconSizeValues.xs;
  const hoehe = zeileHoehe(gross);
  const ueberstand = ueberstandVon(hoehe);
  const rasterAbstand = gross ? cssVars.spacing.sm : cssVars.spacing.xs;

  const tafel: CSSProperties = {
    // eine Spalte mit Mindestbreite 0: eine lange einzeilige Meldung weitet die Tafel nie über ihre Breite
    display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: rasterAbstand, minWidth: 0, boxSizing: 'border-box',
    padding: gross ? cssVars.spacing.md : `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
    background: cssVars.colors.scoreboardBg, color: cssVars.colors.scoreboardText,
    border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.scoreboardDivider}`, borderRadius: cssVars.borderRadius.lg,
  };
  // „überfällig“ im Platz des Abzeichens: Wort in der Warnfarbe der Tafel, Umriss gleich dem Abzeichen-Maß (@OB-068)
  const ueberfaellig: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
    borderRadius: cssVars.borderRadius.sm, border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.scoreboardHighlight}`,
    fontSize: cssVars.fontSizes.sm, lineHeight: cssVars.lineHeights.bodySm, fontWeight: cssVars.fontWeights.bold,
    whiteSpace: 'nowrap', color: cssVars.colors.scoreboardHighlight,
  };
  const kopf: CSSProperties = {
    display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: `${ueberstand} ${cssVars.spacing.sm}`,
    // Die Tippfläche der Abzeichen ragt unter die Zeile: so viel Luft darunter, dass sie keinen Text der nächsten Zeile schneidet
    minHeight: hoehe, minWidth: 0, marginBottom: `max(0px, calc(${ueberstand} - ${rasterAbstand}))`,
  };
  const abschnitt: CSSProperties = {
    flex: '1 1 auto', minWidth: 'max-content', textAlign: 'center', color: cssVars.colors.scoreboardTextMuted,
    fontSize: cssVars.fontSizes.sm, lineHeight: cssVars.lineHeights.bodySm, fontWeight: cssVars.fontWeights.semibold,
  };
  const rechts: CSSProperties = { display: 'flex', alignItems: 'center', gap: cssVars.spacing.xs, minWidth: 0, marginLeft: 'auto' };

  const mitte: CSSProperties = {
    display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)', columnGap: cssVars.spacing.sm, rowGap: cssVars.spacing.xs, alignItems: 'center', minWidth: 0,
  };
  const kastenHoehe = size === 'compact' ? `calc(${cssVars.spacing.xxl} + ${cssVars.spacing.sm})` : size === 'regular' ? `calc(${cssVars.spacing.xxl} * 2)` : `calc(${cssVars.spacing.xxl} * 2 - ${cssVars.spacing.sm})`;
  // Doppelpunkt zwischen den Kästen: Mitte der Spalte 2; Spalte 1 und 3 sind gleich breit, die Uhr darunter (ClockDigits) hat ihre Achse in der Mitte derselben Breite (@SL-179)
  const gestapelt = size !== 'wide'; // Handy und Tablet hochkant: Uhr unter den Kästen; Laptop (wide): Uhr zwischen den Kästen bis „Tafel wie Monitor“ (Plan B1)
  const doppelpunkt: CSSProperties = {
    gridColumn: 2, gridRow: 1, alignSelf: 'end', height: model.links.kasten ? 'var(--cockpit-kasten)' : kastenHoehe, display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 'var(--cockpit-ziffer)', fontWeight: cssVars.fontWeights.bold, lineHeight: 1, color: cssVars.colors.scoreboardTextMuted, userSelect: 'none',
  };
  const team: CSSProperties = { display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: cssVars.spacing.xs, minWidth: 0, alignSelf: 'end' };
  const name: CSSProperties = {
    width: '100%', textAlign: 'center', fontWeight: cssVars.fontWeights.bold, fontSize: cssVars.fontSizes.xl,
    lineHeight: cssVars.lineHeights.title, overflowWrap: 'break-word', hyphens: 'manual',
  };
  // Neutraler Kasten nur ohne Farben (`kasten` fehlt); sonst zeichnet `ScoreBox` Fläche, Weste, Rahmen und Ziffernfarbe (@SL-176)
  const neutralerKasten: CSSProperties = {
    width: '100%', height: kastenHoehe, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: `calc(${cssVars.borderWidth.thin} * 2) solid ${cssVars.colors.scoreboardBorder}`, borderRadius: cssVars.borderRadius.md,
    fontSize: gross ? cssVars.sizing.scoreboardScoreRegular : cssVars.sizing.scoreboardScoreCompact, fontWeight: cssVars.fontWeights.bold,
    fontVariantNumeric: 'tabular-nums', lineHeight: 1, background: 'transparent', color: cssVars.colors.scoreboardText,
  };
  // Markierung ohne Layoutwirkung (B1: „die Tafel springt nicht“): Outline statt Rand und Innenabstand
  const markierung = uhr?.steht ? cssVars.colors.scoreboardHighlight : uhr?.ton === 'ok' ? cssVars.colors.scoreboardOk : null;
  const uhrFlaeche: CSSProperties = {
    ...(gestapelt ? { gridColumn: '1 / -1', gridRow: 2, width: '100%' } : { gridColumn: 2, gridRow: 1 }), textAlign: 'center', minWidth: 0, margin: '0 auto', borderRadius: cssVars.borderRadius.md,
    outline: markierung ? `calc(${cssVars.borderWidth.thin} * 2) dashed ${markierung}` : undefined,
    outlineOffset: markierung ? cssVars.spacing.xs : undefined,
  };
  const uhrFarbe = uhr?.schlussphase ? cssVars.colors.scoreboardFinalPhase : uhr?.ton === 'ok' ? cssVars.colors.scoreboardOk : uhr?.ton === 'gedaempft' ? cssVars.colors.scoreboardTextMuted : cssVars.colors.scoreboardText;
  const klein: CSSProperties = { color: cssVars.colors.scoreboardTextMuted, fontSize: gross ? cssVars.fontSizes.md : cssVars.fontSizes.sm, lineHeight: gross ? cssVars.lineHeights.bodyMd : cssVars.lineHeights.bodySm, fontVariantNumeric: 'tabular-nums' };
  const uhrZahl: CSSProperties = {
    // Ziffern ≥ 11 mm (@SL-178): Größe je Gerät und Stufe aus den Tokens (`--cockpit-ziffer`, Scoreboard.module.css)
    color: uhrFarbe, fontSize: 'var(--cockpit-ziffer)', fontWeight: cssVars.fontWeights.bold, lineHeight: 1,
  };
  // Der Stand als Text für Screenreader (die Kästen sind aria-hidden); außerhalb des Bildes wie die alte Statusmeldung
  const nurVorlesen: CSSProperties = { position: 'absolute', left: '-100vw', width: cssVars.sizing.hairline, height: cssVars.sizing.hairline, overflow: 'hidden' };
  const zeile: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: cssVars.spacing.xs, fontSize: cssVars.fontSizes.sm, lineHeight: cssVars.lineHeights.bodySm, textAlign: 'center' };

  // Gleiche Rahmenbreite beider Kästen (Entscheidung Daniel 15.10.)
  const pairFrame = model.links.kasten && model.rechts.kasten
    ? pairFrameStrength({ fill: model.links.kasten.fill }, { fill: model.rechts.kasten.fill }, tafelFarben.scoreboardBg)
    : undefined;
  const seite = (s: ScoreboardSeite, wo: 'links' | 'rechts'): ReactElement => (
    <div style={team}>
      {gross && <div style={name} data-teamname="" data-testid={id(`name-${wo}`)}>{s.name}</div>}
      <div aria-hidden="true" style={{ width: '100%' }}>
        {s.kasten ? (
          <ScoreBox
            score={s.tore} fill={s.kasten.fill} size="cockpit" background={tafelFarben.scoreboardBg} textColor={tafelFarben.scoreboardText}
            bib={s.kasten.bib} frameStrength={pairFrame} ariaLabel={`${s.name}: ${String(s.tore)}`} testId={id(`box-${wo}`) ?? `box-${wo}`}
          />
        ) : <div style={neutralerKasten} data-testid={id(`box-${wo}`)} data-trikot="neutral">{s.tore}</div>}
      </div>
    </div>
  );

  return (
    <section data-testid={testId} data-size={size} data-stufe={stufe} className={styles.tafel} style={tafel}>
      <div style={kopf}>
        <span aria-live="polite" data-testid={id('state')} style={{ display: 'inline-flex', minWidth: 0 }}>
          {model.ueberfaelligText
            ? <span style={ueberfaellig} data-testid={id('ueberfaellig')}>{model.ueberfaelligText}</span>
            : <MatchStatusBadge model={model.badge} size="card" surface="scoreboard" testId={id('abzeichen')} />}
        </span>
        <span style={abschnitt}>{model.abschnittText}</span>
        <span style={rechts}>
          {kopfRechts}
          {tonHinweis && <Abzeichen hoehe={hoehe} label={tonHinweis.label} kurz={tonHinweis.kurz} icon={<TafelIcons.VolumeOff size={icon} />} onAntippen={tonHinweis.onAntippen} testId={id('ton')} />}
          {wachhaltenHinweis && <Abzeichen hoehe={hoehe} label={wachhaltenHinweis.label} kurz={wachhaltenHinweis.kurz} icon={<TafelIcons.Lock size={icon} />} onAntippen={wachhaltenHinweis.onAntippen} testId={id('wachhalten')} />}
          {model.eintraegeWartenText && <Abzeichen hoehe={hoehe} label={model.eintraegeWartenText} kurz={tonHinweis ? (model.eintraegeWartenKurz ?? undefined) : undefined} icon={<Icons.Upload size={icon} />} testId={id('eintraege-warten')} />}
          {model.helferAnfragenText && <Abzeichen hoehe={hoehe} label={model.helferAnfragenText} icon={<Icons.Users size={icon} />} onAntippen={onHelferAnfragen} testId={id('helfer-anfragen')} />}
        </span>
      </div>

      {model.leerAnzeige ? (
        <div style={{ textAlign: 'center', minWidth: 0 }} data-testid={id('empty')}>
          <div style={name} data-teamname="">{model.leerAnzeige.titel}</div>
          {model.leerAnzeige.untertitel && <div style={klein}>{model.leerAnzeige.untertitel}</div>}
        </div>
      ) : (
        <div style={mitte}>
          {seite(model.links, 'links')}
          {gestapelt && <span style={doppelpunkt} aria-hidden="true" data-testid={id('colon')}>:</span>}
          <div style={uhrFlaeche} data-testid={id('clock')} data-schlussphase={String(uhr?.schlussphase ?? false)} data-steht={String(uhr?.steht ?? false)}>
            {uhr && (
              <>
                {uhr.label && <div style={{ ...klein, fontWeight: cssVars.fontWeights.bold, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: cssVars.spacing.xs }}>{uhr.steht && <TafelIcons.Pause size={iconSizeValues.xs} />}{uhr.label}</div>}
                <ClockDigits text={uhr.rest} style={uhrZahl} testId={id('clock-rest')} />
                <div style={{ ...klein, minHeight: gross ? cssVars.lineHeights.bodyMd : cssVars.lineHeights.bodySm }} data-testid={id('clock-sub')}>{uhr.unterzeile ?? uhr.gespielt}</div>
              </>
            )}
          </div>
          {seite(model.rechts, 'rechts')}
        </div>
      )}
      {!model.leerAnzeige && (
        <div style={nurVorlesen} role="group" aria-live="polite" aria-label={model.ariaStand} data-testid={id('score')}>{model.links.tore}:{model.rechts.tore}</div>
      )}
      {model.quittungText && (
        <div style={zeile} role="status" data-testid={id('quittung')}>
          <span style={{ color: cssVars.colors.scoreboardOk, display: 'flex' }} aria-hidden="true"><Icons.Check size={icon} /></span>{model.quittungText}
        </div>
      )}
      {model.hinweise.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: cssVars.spacing.xs }}>
          {model.hinweise.map((text, index) => (
            <div key={`${index}-${text}`} style={zeile}><span style={{ color: cssVars.colors.scoreboardHighlight, display: 'flex' }} aria-hidden="true"><Icons.Info size={icon} /></span>{text}</div>
          ))}
        </div>
      )}
      {meldezeile}
    </section>
  );
}
