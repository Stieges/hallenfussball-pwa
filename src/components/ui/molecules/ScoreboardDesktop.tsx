/**
 * ScoreboardDesktop – die Tafel am Laptop (Plan Cockpit v2 B1; @SL-180, @SL-181, @SL-179, @SL-176): wie die Live-Folie des Hallenmonitors.
 *
 * Kopfzeile: „Live“ ohne rote Fläche, rechts „Spiel 3 · Feld 1 · 2. Halbzeit · Gespielt 4:06“; Meldungen („Tor für …“) blenden sich über die
 * Kopfzeile ein und verschieben nichts. Darunter Name klein über jedem Kasten (in der Stufe „knapp“ nur „Heim“/„Gast“, Variante a: der Name
 * steht groß in der Leiste über den Tasten), die Kästen mit Doppelpunkt, über der Uhr „Restzeit“, unter ihr der Zeitbalken. Lange Namen
 * brechen um, nie mit „…“ (VISUAL-DESIGN § 1). Die Maße kommen aus der Stufe der Fensterhöhe (`data-stufe`, Scoreboard.module.css).
 */
import type { CSSProperties, ReactElement } from 'react';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { getColorsByTheme } from '../../../design-tokens/colors';
import { ScoreBox } from './ScoreBox';
import { ClockDigits } from '../atoms/ClockDigits';
import { ZeitBalken } from '../atoms/ZeitBalken';
import { pairFrameStrength } from './scoreBoxStyle';
import { Icons } from '../Icons';
import { TafelIcons } from '../IconsTafel';
import { MatchStatusBadge } from './MatchStatusBadge';
import { Abzeichen } from './ScoreboardAbzeichen';
import { zeileHoehe } from './scoreboardAbzeichenMasse';
import type { ScoreboardProps, ScoreboardSeite } from './scoreboardTypes';
import styles from './Scoreboard.module.css';
import desktop from './ScoreboardDesktop.module.css';

// Die Tafel ist in beiden Themes dunkel; `ScoreBox` rechnet Kontrast und Rahmen aus Hex-Werten (keine CSS-Variablen möglich)
const tafelFarben = getColorsByTheme('dark');

const uhrZahl = (farbe: string): CSSProperties => ({ color: farbe, fontSize: 'var(--cockpit-ziffer)', fontWeight: cssVars.fontWeights.bold, lineHeight: 'var(--cockpit-uhr-zeile, 1)' });
const nurVorlesen: CSSProperties = { position: 'absolute', left: '-100vw', width: cssVars.sizing.hairline, height: cssVars.sizing.hairline, overflow: 'hidden' };
const neutralerKasten: CSSProperties = {
  width: '100%', height: 'var(--cockpit-kasten)', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center',
  border: `calc(${cssVars.borderWidth.thin} * 2) solid ${cssVars.colors.scoreboardBorder}`, borderRadius: cssVars.borderRadius.md,
  fontSize: 'var(--cockpit-ziffer)', fontWeight: cssVars.fontWeights.bold, fontVariantNumeric: 'tabular-nums', lineHeight: 1, color: cssVars.colors.scoreboardText,
};

export function ScoreboardDesktop({ model, stufe, meldezeile, onHelferAnfragen, testId, wachhaltenHinweis, tonHinweis, kopfRechts }: ScoreboardProps): ReactElement {
  const id = (teil: string): string | undefined => (testId ? `${testId}-${teil}` : undefined);
  const uhr = model.uhr;
  const icon = iconSizeValues.xs;
  const hoehe = zeileHoehe(true);
  const nurLabel = stufe === 'knapp'; // Variante a (@SL-181): unter 720 px Fensterhöhe nur „Heim“/„Gast“ über dem Kasten
  const markierung = uhr?.steht ? cssVars.colors.scoreboardHighlight : uhr?.ton === 'ok' ? cssVars.colors.scoreboardOk : null;
  const uhrFarbe = uhr?.schlussphase ? cssVars.colors.scoreboardFinalPhase : uhr?.ton === 'ok' ? cssVars.colors.scoreboardOk : uhr?.ton === 'gedaempft' ? cssVars.colors.scoreboardTextMuted : cssVars.colors.scoreboardText;
  // Gleiche Rahmenbreite beider Kästen (Entscheidung Daniel 15.10.)
  const pairFrame = model.links.kasten && model.rechts.kasten
    ? pairFrameStrength({ fill: model.links.kasten.fill }, { fill: model.rechts.kasten.fill }, tafelFarben.scoreboardBg)
    : undefined;

  const seite = (s: ScoreboardSeite, wo: 'links' | 'rechts'): ReactElement => (
    <div className={desktop.seite}>
      {nurLabel
        ? <div className={desktop.label} data-testid={id(`label-${wo}`)}>{s.label}</div>
        : <p className={desktop.name} data-teamname="" data-testid={id(`name-${wo}`)}>{s.name}</p>}
      <div aria-hidden="true" style={{ width: '100%' }}>
        {s.kasten ? (
          <ScoreBox
            score={s.tore} fill={s.kasten.fill} size="cockpit" background={tafelFarben.scoreboardBg} textColor={tafelFarben.scoreboardText}
            bib={s.kasten.bib} frameStrength={pairFrame} ariaLabel={`${s.name}: ${String(s.tore)}`} testId={id(`box-${wo}`) ?? `box-${wo}`}
          />
        ) : <div style={neutralerKasten} data-testid={id(`box-${wo}`)} data-trikot="neutral" data-ziffern="stand">{s.tore}</div>}
      </div>
    </div>
  );

  return (
    <section data-testid={testId} data-size="wide" data-stufe={stufe} className={`${styles.tafel} ${desktop.tafel}`}>
      <div className={desktop.kopf}>
        <span aria-live="polite" data-testid={id('state')} style={{ display: 'inline-flex', minWidth: 0 }}>
          {model.ueberfaelligText
            ? <span style={{ fontSize: cssVars.fontSizes.sm, fontWeight: cssVars.fontWeights.bold, color: cssVars.colors.scoreboardHighlight, whiteSpace: 'nowrap' }} data-testid={id('ueberfaellig')}>{model.ueberfaelligText}</span>
            : <MatchStatusBadge model={model.badge} size="tafel" surface="scoreboardFlach" testId={id('abzeichen')} />}
        </span>
        <span className={desktop.kopfText} data-testid={id('kopf-text')}>{model.kopfText ?? model.abschnittText}</span>
        <span className={desktop.abzeichen}>
          {kopfRechts}
          {tonHinweis && <Abzeichen hoehe={hoehe} label={tonHinweis.label} kurz={tonHinweis.kurz} icon={<TafelIcons.VolumeOff size={icon} />} onAntippen={tonHinweis.onAntippen} testId={id('ton')} />}
          {wachhaltenHinweis && <Abzeichen hoehe={hoehe} label={wachhaltenHinweis.label} kurz={wachhaltenHinweis.kurz} icon={<TafelIcons.Lock size={icon} />} onAntippen={wachhaltenHinweis.onAntippen} testId={id('wachhalten')} />}
          {model.eintraegeWartenText && <Abzeichen hoehe={hoehe} label={model.eintraegeWartenText} kurz={tonHinweis ? (model.eintraegeWartenKurz ?? undefined) : undefined} icon={<Icons.Upload size={icon} />} testId={id('eintraege-warten')} />}
          {model.helferAnfragenText && <Abzeichen hoehe={hoehe} label={model.helferAnfragenText} icon={<Icons.Users size={icon} />} onAntippen={onHelferAnfragen} testId={id('helfer-anfragen')} />}
        </span>
      </div>
      <div className={desktop.einblendung}>{meldezeile}</div>

      {model.leerAnzeige ? (
        <div style={{ textAlign: 'center', minWidth: 0 }} data-testid={id('empty')}>
          <p className={desktop.name} data-teamname="">{model.leerAnzeige.titel}</p>
          {model.leerAnzeige.untertitel && <div className={desktop.unterzeile}>{model.leerAnzeige.untertitel}</div>}
        </div>
      ) : (
        <>
          <div className={desktop.kaesten}>
            {seite(model.links, 'links')}
            <span className={desktop.doppelpunkt} aria-hidden="true" data-testid={id('colon')}>:</span>
            {seite(model.rechts, 'rechts')}
          </div>
          {uhr && (
            <div
              className={desktop.uhr} data-testid={id('clock')} data-schlussphase={String(uhr.schlussphase)} data-steht={String(uhr.steht)}
              style={markierung ? { outline: `calc(${cssVars.borderWidth.thin} * 2) dashed ${markierung}`, outlineOffset: cssVars.spacing.xs } : undefined}
            >
              {uhr.label && <div className={desktop.etikett}>{uhr.steht && <TafelIcons.Pause size={icon} />}{uhr.label}</div>}
              <ClockDigits text={uhr.rest} style={uhrZahl(uhrFarbe)} testId={id('clock-rest')} />
              {uhr.balken && <ZeitBalken anteil={uhr.balken.anteil} ton={uhr.balken.ton} testId={id('zeitbalken')} />}
              {/* Die gespielte Zeit steht in der Kopfzeile; die Zeile unter der Uhr nur dort, wo sie etwas anderes sagt (Pause, Endstand) */}
              {uhr.gespielt === null && <div className={desktop.unterzeile} data-testid={id('clock-sub')}>{uhr.unterzeile}</div>}
            </div>
          )}
        </>
      )}
      {!model.leerAnzeige && (
        <div style={nurVorlesen} role="group" aria-live="polite" aria-label={model.ariaStand} data-testid={id('score')}>{model.links.tore}:{model.rechts.tore}</div>
      )}
      {((model.quittungText ?? '') !== '' || model.hinweise.length > 0) && (
        <div className={desktop.meldungen}>
          {model.quittungText && (
            <div className={desktop.zeile} role="status" data-testid={id('quittung')}>
              <span style={{ color: cssVars.colors.scoreboardOk, display: 'flex' }} aria-hidden="true"><Icons.Check size={icon} /></span>{model.quittungText}
            </div>
          )}
          {model.hinweise.map((text, index) => (
            <div key={`${index}-${text}`} className={desktop.zeile}><span style={{ color: cssVars.colors.scoreboardHighlight, display: 'flex' }} aria-hidden="true"><Icons.Info size={icon} /></span>{text}</div>
          ))}
        </div>
      )}
    </section>
  );
}
