/**
 * Scoreboard – Tafel-Block des Live-Cockpits (Cockpit-Spec § 4.1, § 6, § 8.2).
 *
 * Oben Zustands-Abzeichen, Abschnitt und die Abzeichen (Einträge warten, Helfer-Anfrage, Ton, Wachhalten), in der
 * Mitte Stand-Kasten | Uhr | Stand-Kasten (ab `regular` mit Teamnamen), darunter stehende Zeilen und die Meldezeile
 * (`NoticeLine`) im selben Block. Texte kommen fertig im Modell (kein i18n im Baustein), Farben und Maße nur aus
 * Tokens. Die Uhr ist reine Anzeige und wird nicht sekündlich vorgelesen; Stand und Zustand sind `aria-live="polite"`.
 * Die Tafel ist in beiden Themes dunkel (Tokens `scoreboard*`).
 */
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { animations, cssVars, iconSizeValues } from '../../../design-tokens';
import { Icons } from '../Icons';
import { TafelIcons } from '../IconsTafel';

export type ScoreboardTon = 'neutral' | 'live' | 'pause' | 'ende' | 'info';
export interface ScoreboardSeite { name: string; tore: number; /** Trikotfarbe des Stand-Kastens (Mockup-Freigabe 16.10.); fehlt sie, bleibt der Kasten neutral. */ trikot?: string | null }
/**
 * `schlussphase`: nur Uhr-Art „durchlaufend, letzte Minute angehalten“ in ihrer Schlussphase (@SL-003, @SL-136) → Uhr in
 * `scoreboardFinalPhase` (Violett). `ton`: gedämpft (Pause, Endstand) oder grün (Pause vorbei, Wiederanpfiff).
 */
export interface ScoreboardUhr {
  rest: string; gespielt: string | null; hervorgehoben: boolean; steht: boolean; schlussphase: boolean;
  /** Zeile über der Uhr („Restzeit“, „angehalten“, „Pause“, „Anstoß“). */
  label?: string | null;
  /** Zeile unter der Uhr („Spielzeit 3:12“); fehlt sie, steht `gespielt`. */
  unterzeile?: string | null;
  ton?: 'gedaempft' | 'ok';
}
export interface ScoreboardModel {
  zustandText: string; ton: ScoreboardTon;
  links: ScoreboardSeite; rechts: ScoreboardSeite;
  uhr: ScoreboardUhr | null;
  /** Text in der Kopfzeile neben dem Zustand: Abschnitt, vor dem Spiel der Turniername. */
  abschnittText: string | null;
  hinweise: string[];
  eintraegeWartenText: string | null;
  helferAnfragenText: string | null;
  ariaStand: string;
  /** Statt Stand und Uhr: „wartet auf Teams“ und „kein Spiel mehr“ (Aufgabe 2.5). */
  leerAnzeige?: { titel: string; untertitel: string | null } | null;
}
/** `label` ist der zugängliche Name; `kurz` der sichtbare Text (fehlt er, steht `label`). */
export interface ScoreboardAbzeichenKnopf { label: string; kurz?: string; onAntippen: () => void }
export interface ScoreboardProps {
  model: ScoreboardModel;
  size: 'compact' | 'regular' | 'wide';
  meldezeile: ReactNode;
  onHelferAnfragen?: () => void;
  testId?: string;
  /** Stehende Anzeige (Spec § 7 Nr. 1): Wachhalten-Symbol, bis es angetippt wird (Aufgabe 4.2). */
  wachhaltenHinweis?: ScoreboardAbzeichenKnopf | null;
  /** Der Ton für den Abpfiff ist (noch) nicht freigegeben: Abzeichen statt schwebendem Hinweis (C-COCKPIT-SOUNDHINWEIS-VERDECKT). */
  tonHinweis?: ScoreboardAbzeichenKnopf | null;
  /** Übergang bis zum schmalen Kopf (Aufgabe 3.8): Verbindungsanzeige in der Kopfzeile. */
  kopfRechts?: ReactNode;
}

/** Ziffernfarbe auf der Trikotfarbe: Schwarz oder Weiß, je nachdem was mehr Kontrast gibt (≥ 4,5 : 1). */
function ziffernFarbe(trikot: string): string | null {
  const treffer = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(trikot);
  if (treffer === null) { return null; }
  const hex = treffer[1].length === 3 ? treffer[1].replace(/./g, '$&$&') : treffer[1];
  const linear = [0, 2, 4].map((i) => {
    const kanal = parseInt(hex.slice(i, i + 2), 16) / 255;
    return kanal <= 0.03928 ? kanal / 12.92 : ((kanal + 0.055) / 1.055) ** 2.4;
  });
  const leuchtdichte = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  // Kontrast gegen Weiß (1,05 / (L + 0,05)) gegen Kontrast gegen Schwarz ((L + 0,05) / 0,05)
  return 1.05 / (leuchtdichte + 0.05) >= (leuchtdichte + 0.05) / 0.05 ? cssVars.colors.scoreboardOnLive : cssVars.colors.scoreboardOnHighlight;
}

const BADGE: Record<ScoreboardTon, { bg: string; fg: string }> = {
  neutral: { bg: cssVars.colors.scoreboardSurface, fg: cssVars.colors.scoreboardText },
  live: { bg: cssVars.colors.scoreboardLive, fg: cssVars.colors.scoreboardOnLive },
  pause: { bg: cssVars.colors.scoreboardHighlight, fg: cssVars.colors.scoreboardOnHighlight },
  ende: { bg: cssVars.colors.scoreboardNeutral, fg: cssVars.colors.scoreboardOnLive },
  info: { bg: cssVars.colors.scoreboardInfo, fg: cssVars.colors.scoreboardOnHighlight },
};

/** Höhe der Kopfzeile; die Tippfläche der Abzeichen (44 px) ragt darüber hinaus (`ueberstand`) und braucht dort Platz. */
const zeileHoehe = (gross: boolean): string => (gross ? cssVars.spacing.xl : cssVars.spacing.lg);
const ueberstandVon = (hoehe: string): string => `max(0px, calc((${cssVars.touchTargets.minimum} - ${hoehe}) / 2))`;

function Abzeichen({ label, kurz, icon, onAntippen, testId, hoehe }: { label: string; kurz?: string; icon: ReactNode; onAntippen?: () => void; testId?: string; hoehe: string }): ReactElement {
  const marke: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: cssVars.spacing.xs, padding: `0 ${cssVars.spacing.sm}`,
    border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.scoreboardBorder}`, borderRadius: cssVars.borderRadius.full,
    fontSize: cssVars.fontSizes.sm, lineHeight: cssVars.lineHeights.bodySm, fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.scoreboardText, whiteSpace: 'nowrap',
  };
  if (onAntippen === undefined) {
    return <span style={marke} data-testid={testId}>{icon}{kurz ?? label}</span>;
  }
  // Tippfläche 44 px; der negative Rand hält die Zeile in ihrer Höhe (wie das Kreuz der Meldezeile)
  const flaeche: CSSProperties = {
    minHeight: cssVars.touchTargets.minimum, minWidth: cssVars.touchTargets.minimum,
    margin: `calc(-1 * ${ueberstandVon(hoehe)}) 0`,
    padding: 0, background: 'none', border: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', color: 'inherit', fontFamily: 'inherit',
  };
  return (
    <button type="button" style={flaeche} aria-label={label} onClick={onAntippen} data-testid={testId}>
      <span style={marke}>{icon}{kurz ?? label}</span>
    </button>
  );
}

export function Scoreboard({ model, size, meldezeile, onHelferAnfragen, testId, wachhaltenHinweis, tonHinweis, kopfRechts }: ScoreboardProps): ReactElement {
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
  const kopf: CSSProperties = {
    display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: `${ueberstand} ${cssVars.spacing.sm}`,
    // Die Tippfläche der Abzeichen ragt unter die Zeile: so viel Luft darunter, dass sie keinen Text der nächsten Zeile schneidet
    minHeight: hoehe, minWidth: 0, marginBottom: `max(0px, calc(${ueberstand} - ${rasterAbstand}))`,
  };
  const badge: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: cssVars.spacing.xs, padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
    borderRadius: cssVars.borderRadius.sm, fontSize: cssVars.fontSizes.sm, lineHeight: cssVars.lineHeights.bodySm,
    fontWeight: cssVars.fontWeights.bold, whiteSpace: 'nowrap', background: BADGE[model.ton].bg, color: BADGE[model.ton].fg,
    border: model.ton === 'neutral' ? `${cssVars.borderWidth.thin} solid ${cssVars.colors.scoreboardDivider}` : undefined,
  };
  const punkt: CSSProperties = {
    width: cssVars.spacing.sm, height: cssVars.spacing.sm, borderRadius: cssVars.borderRadius.full,
    background: cssVars.colors.scoreboardOnLive, animation: animations.pulse,
  };
  const abschnitt: CSSProperties = {
    flex: '1 1 auto', minWidth: 'max-content', textAlign: 'center', color: cssVars.colors.scoreboardTextMuted,
    fontSize: cssVars.fontSizes.sm, lineHeight: cssVars.lineHeights.bodySm, fontWeight: cssVars.fontWeights.semibold,
  };
  const rechts: CSSProperties = { display: 'flex', alignItems: 'center', gap: cssVars.spacing.xs, minWidth: 0, marginLeft: 'auto' };

  const mitte: CSSProperties = {
    display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)', gap: cssVars.spacing.sm, alignItems: 'center', minWidth: 0,
  };
  const team: CSSProperties = { display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: cssVars.spacing.xs, minWidth: 0, alignSelf: 'end' };
  const name: CSSProperties = {
    width: '100%', textAlign: 'center', fontWeight: cssVars.fontWeights.bold, fontSize: cssVars.fontSizes.xl,
    lineHeight: cssVars.lineHeights.title, overflowWrap: 'break-word', hyphens: 'manual',
  };
  const kastenHoehe = size === 'compact' ? `calc(${cssVars.spacing.xxl} + ${cssVars.spacing.sm})` : size === 'regular' ? `calc(${cssVars.spacing.xxl} * 2)` : `calc(${cssVars.spacing.xxl} * 2 - ${cssVars.spacing.sm})`;
  const kasten = (seite: ScoreboardSeite): CSSProperties => {
    const farbe = seite.trikot ? ziffernFarbe(seite.trikot) : null;
    return {
      width: '100%', height: kastenHoehe, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: `calc(${cssVars.borderWidth.thin} * 2) solid ${cssVars.colors.scoreboardBorder}`, borderRadius: cssVars.borderRadius.md,
      fontSize: gross ? cssVars.sizing.scoreboardScoreRegular : cssVars.sizing.scoreboardScoreCompact, fontWeight: cssVars.fontWeights.bold,
      fontVariantNumeric: 'tabular-nums', lineHeight: 1,
      background: farbe && seite.trikot ? seite.trikot : 'transparent', color: farbe ?? cssVars.colors.scoreboardText,
    };
  };
  // Markierung ohne Layoutwirkung (B1: „die Tafel springt nicht“): Outline statt Rand und Innenabstand
  const markierung = uhr?.steht ? cssVars.colors.scoreboardHighlight : uhr?.ton === 'ok' ? cssVars.colors.scoreboardOk : null;
  const uhrFlaeche: CSSProperties = {
    textAlign: 'center', minWidth: 0, margin: '0 auto', borderRadius: cssVars.borderRadius.md,
    outline: markierung ? `calc(${cssVars.borderWidth.thin} * 2) dashed ${markierung}` : undefined,
    outlineOffset: markierung ? cssVars.spacing.xs : undefined,
  };
  const uhrGroesse = size === 'compact' ? cssVars.sizing.scoreboardClockCompact : size === 'regular' ? cssVars.sizing.scoreboardClockRegular : cssVars.sizing.scoreboardClockWide;
  const uhrFarbe = uhr?.schlussphase ? cssVars.colors.scoreboardFinalPhase : uhr?.ton === 'ok' ? cssVars.colors.scoreboardOk : uhr?.ton === 'gedaempft' ? cssVars.colors.scoreboardTextMuted : cssVars.colors.scoreboardText;
  const klein: CSSProperties = { color: cssVars.colors.scoreboardTextMuted, fontSize: gross ? cssVars.fontSizes.md : cssVars.fontSizes.sm, lineHeight: gross ? cssVars.lineHeights.bodyMd : cssVars.lineHeights.bodySm, fontVariantNumeric: 'tabular-nums' };
  const uhrZahl: CSSProperties = {
    color: uhrFarbe, fontSize: uhrGroesse, fontWeight: cssVars.fontWeights.bold, fontVariantNumeric: 'tabular-nums',
    lineHeight: size === 'compact' ? cssVars.lineHeights.displayMd : `calc(${cssVars.lineHeights.displayLg} + ${size === 'regular' ? cssVars.spacing.md : cssVars.spacing.sm})`,
    whiteSpace: 'nowrap', minWidth: '5ch',
  };
  // Der Stand als Text für Screenreader (die Kästen sind aria-hidden); außerhalb des Bildes wie die alte Statusmeldung
  const nurVorlesen: CSSProperties = { position: 'absolute', left: '-100vw', width: cssVars.sizing.hairline, height: cssVars.sizing.hairline, overflow: 'hidden' };
  const zeile: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: cssVars.spacing.xs, fontSize: cssVars.fontSizes.sm, lineHeight: cssVars.lineHeights.bodySm, textAlign: 'center' };

  const seite = (s: ScoreboardSeite, wo: 'links' | 'rechts'): ReactElement => (
    <div style={team}>
      {gross && <div style={name} data-teamname="" data-testid={id(`name-${wo}`)}>{s.name}</div>}
      <div style={kasten(s)} data-testid={id(`box-${wo}`)} data-trikot={s.trikot && ziffernFarbe(s.trikot) ? 'farbe' : 'neutral'} aria-hidden="true">{s.tore}</div>
    </div>
  );

  return (
    <section data-testid={testId} data-size={size} style={tafel}>
      <div style={kopf}>
        <span style={badge} aria-live="polite" data-testid={id('state')} data-ton={model.ton}>
          {model.ton === 'live' && <span style={punkt} aria-hidden="true" />}
          {model.zustandText}
        </span>
        <span style={abschnitt}>{model.abschnittText}</span>
        <span style={rechts}>
          {kopfRechts}
          {tonHinweis && <Abzeichen hoehe={hoehe} label={tonHinweis.label} kurz={tonHinweis.kurz} icon={<TafelIcons.VolumeOff size={icon} />} onAntippen={tonHinweis.onAntippen} testId={id('ton')} />}
          {wachhaltenHinweis && <Abzeichen hoehe={hoehe} label={wachhaltenHinweis.label} kurz={wachhaltenHinweis.kurz} icon={<TafelIcons.Lock size={icon} />} onAntippen={wachhaltenHinweis.onAntippen} testId={id('wachhalten')} />}
          {model.eintraegeWartenText && <Abzeichen hoehe={hoehe} label={model.eintraegeWartenText} icon={<Icons.Upload size={icon} />} testId={id('eintraege-warten')} />}
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
          <div style={uhrFlaeche} data-testid={id('clock')} data-schlussphase={String(uhr?.schlussphase ?? false)} data-steht={String(uhr?.steht ?? false)}>
            {uhr && (
              <>
                {uhr.label && <div style={{ ...klein, fontWeight: cssVars.fontWeights.bold, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: cssVars.spacing.xs }}>{uhr.steht && <TafelIcons.Pause size={iconSizeValues.xs} />}{uhr.label}</div>}
                <div style={uhrZahl} data-testid={id('clock-rest')}>{uhr.rest}</div>
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
