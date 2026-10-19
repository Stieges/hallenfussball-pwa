/**
 * Bereich „Anzeige für Zuschauer“ (Spielanzeige 2.3, @ZM-152, @ZM-153, @ZM-154, @ZM-019; Mockup `einstellungen.html`).
 *
 * Eine Einstellung je Turnier für Hallenmonitor, Zuschauer-Seite und Spielkarten: „Teamfarben in den Ergebniskästen“ (Vorgabe an),
 * „Standardfarbe Heim“ (Blau) und „Standardfarbe Gast“ (Rot), mit Vorschau zweier Kästen. Sind die Standardfarben zu ähnlich
 * (`standardColorsTooSimilar`, ΔE2000 < 30, wie @SL-139), steht ein Hinweis – gespeichert werden darf trotzdem (@ZM-153); die
 * Anzeige weicht dann aus (Gast Weiß oder Schwarz, `resolveBoxColors`). Die Vorschau zeigt die gewählten Farben.
 * Ohne das Recht `tournamentSettings` (`canEdit` false, @ZM-019) gibt es keine Eingaben, nur Vorschau und Hinweis.
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { CollapsibleSection } from '../shared';
import { ColorPicker } from '../../../../components/ui/ColorPicker';
import { ScoreBox } from '../../../../components/ui/molecules/ScoreBox';
import { InlineNotice } from '../../../../components/ui/molecules/InlineNotice';
import { LeadOnlyHint } from '../../../../components/ui/molecules/LeadOnlyHint';
import { useBreakpoint } from '../../../../hooks/useBreakpoint';
import { useTheme } from '../../../../hooks/useTheme';
import { getColorsByTheme } from '../../../../design-tokens/colors';
import { borderWidths, cssVars, zIndex } from '../../../../design-tokens';
import {
  BOX_COLOR_PRESETS,
  DEFAULT_SPECTATOR_DISPLAY,
  boxColorPresetKey,
  parseSpectatorDisplay,
  standardColorsTooSimilar,
  type SpectatorDisplaySettings,
} from '../../../../core/models/spectatorDisplay';
import type { Tournament } from '../../../../types/tournament';

export interface SpectatorDisplaySectionProps {
  tournament: Tournament;
  onTournamentUpdate: (tournament: Tournament) => void;
  /** `useCan('tournamentSettings')` (@ZM-019): Olli und Maria ja, Tom (Helfer) nein */
  canEdit: boolean;
}

/** Beispielstände der Vorschau (Mockup): 2 : 1 */
const PREVIEW_SCORES = { home: 2, away: 1 } as const;
const PICKER_PRESETS = BOX_COLOR_PRESETS.map((preset) => preset.hex);
const SAVED_VISIBLE_MS = 2000;
/** Höhe der Fußleiste: Primär-Touchgröße des Knopfes plus oben und unten Rand */
const FOOTER_HEIGHT = `calc(${cssVars.touchTargets.primary} + ${cssVars.spacing.md} * 2)`;

const S = {
  lead: { margin: 0, marginBottom: cssVars.spacing.md, color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.bodySm },
  preview: {
    border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    padding: cssVars.spacing.md,
    marginBottom: cssVars.spacing.md,
    background: cssVars.colors.background,
  },
  eyebrow: {
    margin: 0,
    marginBottom: cssVars.spacing.md,
    fontSize: cssVars.fontSizes.labelMd,
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.textSecondary,
    textTransform: 'uppercase',
  },
  pair: { display: 'grid', gridTemplateColumns: `minmax(0, 1fr) ${cssVars.spacing.lg} minmax(0, 1fr)`, alignItems: 'start', justifyItems: 'center' },
  column: { display: 'grid', justifyItems: 'center', gap: cssVars.spacing.sm, minWidth: 0 },
  // 112 × 84 (Mockup `.sb.v`), Token aus der Primär-Touchgröße abgeleitet
  box: { width: cssVars.sizing.scorePreviewWidth, height: cssVars.sizing.scorePreviewHeight },
  separator: { fontSize: cssVars.fontSizes.xxl, lineHeight: `calc(${cssVars.touchTargets.primary} * 1.5)`, fontWeight: cssVars.fontWeights.bold, color: cssVars.colors.textSecondary },
  caption: { textAlign: 'center', fontSize: cssVars.fontSizes.labelMd, color: cssVars.colors.textSecondary },
  captionName: { display: 'block', fontSize: cssVars.fontSizes.bodySm, fontWeight: cssVars.fontWeights.semibold, color: cssVars.colors.textPrimary },
  switchRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: cssVars.spacing.md,
    width: '100%', minHeight: cssVars.touchTargets.comfortable, padding: `${cssVars.spacing.sm} 0`,
    background: 'none', border: 0, color: cssVars.colors.textPrimary, textAlign: 'left', cursor: 'pointer',
    fontSize: cssVars.fontSizes.bodyMd, fontWeight: cssVars.fontWeights.semibold,
  },
  switchLabel: { flex: '1 1 auto', minWidth: 0 },
  note: { display: 'block', fontSize: cssVars.fontSizes.labelMd, fontWeight: cssVars.fontWeights.normal, color: cssVars.colors.textSecondary },
  track: {
    flex: 'none', position: 'relative', width: `calc(${cssVars.touchTargets.minimum} + ${cssVars.spacing.sm})`, height: cssVars.spacing.xl,
    borderRadius: cssVars.borderRadius.full, border: `${borderWidths.medium} solid`, boxSizing: 'border-box',
  },
  knob: {
    position: 'absolute', top: borderWidths.medium, width: cssVars.spacing.lg, height: cssVars.spacing.lg,
    borderRadius: cssVars.borderRadius.full,
  },
  word: { flex: 'none', minWidth: cssVars.spacing.xl, textAlign: 'right', fontSize: cssVars.fontSizes.labelMd, fontWeight: cssVars.fontWeights.bold },
  label: { display: 'block', margin: `${cssVars.spacing.md} 0 ${cssVars.spacing.xs}`, fontSize: cssVars.fontSizes.bodyMd, fontWeight: cssVars.fontWeights.semibold, color: cssVars.colors.textPrimary },
  // Fußleiste (Mockup `.foot2`): am unteren Fensterrand fest, damit „Speichern“ am Handy ohne Scrollen erreichbar ist. Damit sie
  // am Seitenende die Fußzeile der App nicht verdeckt, hält die Seite solange `FOOTER_HEIGHT` Platz unten frei (Effekt unten)
  footer: { position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: zIndex.sticky },
  footerInner: {
    boxSizing: 'border-box', padding: cssVars.spacing.md,
    background: cssVars.colors.background, borderTop: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`,
  },
  save: {
    width: '100%', minHeight: cssVars.touchTargets.primary, border: 0,
    borderRadius: cssVars.borderRadius.md, background: cssVars.colors.primary, color: cssVars.colors.onPrimary,
    fontSize: cssVars.fontSizes.bodyLg, fontWeight: cssVars.fontWeights.bold, cursor: 'pointer',
  },
  saved: { margin: `0 0 ${cssVars.spacing.sm}`, textAlign: 'center', fontSize: cssVars.fontSizes.labelMd, color: cssVars.colors.success },
} satisfies Record<string, CSSProperties>;

export function SpectatorDisplaySection({ tournament, onTournamentUpdate, canEdit }: SpectatorDisplaySectionProps): ReactElement {
  const { t } = useTranslation('admin');
  const { resolvedTheme } = useTheme();
  // Ab Tablet-Breite hat die Seite eine Inhaltsspalte: die Leiste ist dann so breit und so ausgerichtet wie die Karte
  const { isMobile } = useBreakpoint();
  // Hintergrund und Textfarbe des Themas als Hex (der Kasten rechnet Kontrast und Rahmen daraus); Kontrast-Thema zählt als dunkel
  const colors = getColorsByTheme(resolvedTheme === 'light' ? 'light' : 'dark');
  const stored = parseSpectatorDisplay(tournament.spectatorDisplay ?? DEFAULT_SPECTATOR_DISPLAY);
  const [draft, setDraft] = useState<SpectatorDisplaySettings>(stored);
  const [saved, setSaved] = useState(false);
  // Platz am Seitenende für die feste Fußleiste, solange sie steht (nur mit Recht)
  useEffect(() => {
    if (!canEdit) {
      return undefined;
    }
    const vorher = document.body.style.paddingBottom;
    document.body.style.paddingBottom = FOOTER_HEIGHT;
    return () => { document.body.style.paddingBottom = vorher; };
  }, [canEdit]);
  // Leiste bündig mit der Karte: Lage und Breite der Karte messen (Fenstergröße und Spalte ändern sich)
  const cardRef = useRef<HTMLDivElement>(null);
  const [column, setColumn] = useState<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) {
      return undefined;
    }
    const measure = () => {
      const r = card.getBoundingClientRect();
      const next = !isMobile && r.width > 0 ? { left: r.left, width: r.width } : null;
      setColumn((cur) => (cur?.left === next?.left && cur?.width === next?.width ? cur : next));
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
    observer?.observe(card);
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, [canEdit, isMobile]);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // A5: der Timer der Meldung „Gespeichert“ läuft nicht über den Abbau hinaus
  useEffect(() => () => clearTimeout(savedTimer.current), []);

  // Eine Änderung von außen (anderes Gerät, Rückgängig) ersetzt den Entwurf
  useEffect(() => {
    setDraft({ teamColors: stored.teamColors, homeColor: stored.homeColor, awayColor: stored.awayColor });
  }, [stored.teamColors, stored.homeColor, stored.awayColor]);

  const colorName = (hex: string): string => {
    const key = boxColorPresetKey(hex);
    return key === undefined ? hex : t(`spectatorDisplay.colors.${key}`);
  };
  const patch = (changes: Partial<SpectatorDisplaySettings>) => { setSaved(false); setDraft((current) => ({ ...current, ...changes })); };

  const handleSave = () => {
    onTournamentUpdate({ ...tournament, spectatorDisplay: parseSpectatorDisplay(draft), updatedAt: new Date().toISOString() });
    setSaved(true);
    clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), SAVED_VISIBLE_MS);
  };

  const side = (which: 'home' | 'away', hex: string) => (
    <div style={S.column}>
      <div style={S.box}>
        <ScoreBox
          score={PREVIEW_SCORES[which]}
          fill={{ kind: 'solid', color: hex }}
          size="display"
          background={colors.background}
          textColor={colors.textPrimary}
          ariaLabel={t('spectatorDisplay.boxAria', { side: t(`spectatorDisplay.${which}`), color: colorName(hex) })}
          testId={`preview-${which}`}
        />
      </div>
      <div style={S.caption}>
        <span style={S.captionName}>{t(`spectatorDisplay.${which}`)}</span>
        {colorName(hex)}
      </div>
    </div>
  );

  const picker = (which: 'home' | 'away', hex: string) => (
    <div role="group" aria-labelledby={`spectator-display-${which}-label`} data-testid={`spectator-display-${which}-color`}>
      <span id={`spectator-display-${which}-label`} style={S.label}>
        {t(`spectatorDisplay.${which}Color`)}
        <span style={S.note}>{t('spectatorDisplay.colorNote')}</span>
      </span>
      <ColorPicker
        value={hex}
        valueLabel={colorName(hex)}
        presets={PICKER_PRESETS}
        onChange={(color) => patch(which === 'home' ? { homeColor: color } : { awayColor: color })}
      />
    </div>
  );

  const on = draft.teamColors;
  return (
    <>
    <div ref={cardRef} data-testid="spectator-display-section">
      <CollapsibleSection icon="🎨" title={t('spectatorDisplay.title')} defaultOpen>
        <p style={S.lead}>{t('spectatorDisplay.description')}</p>

        <div style={S.preview} data-testid="spectator-display-preview">
          <p style={S.eyebrow}>{t('spectatorDisplay.preview')}</p>
          <div style={S.pair}>
            {side('home', draft.homeColor)}
            <span style={S.separator} aria-hidden="true">:</span>
            {side('away', draft.awayColor)}
          </div>
        </div>

        {standardColorsTooSimilar(draft) && (
          <div style={{ marginBottom: cssVars.spacing.md }}>
            <InlineNotice tone="warn" data-testid="spectator-display-similar-hint">
              <strong>{t('spectatorDisplay.similarTitle')}</strong>
              <span>{t('spectatorDisplay.similarText')}</span>
            </InlineNotice>
          </div>
        )}

        {canEdit ? (
          <>
            <div data-testid="spectator-display-team-colors">
              <button type="button" role="switch" aria-checked={on} style={S.switchRow} onClick={() => patch({ teamColors: !on })}>
                <span style={S.switchLabel}>
                  {t('spectatorDisplay.teamColors')}
                  <span style={S.note}>{t('spectatorDisplay.teamColorsNote')}</span>
                </span>
                <span style={{ ...S.track, borderColor: on ? cssVars.colors.primary : cssVars.colors.borderControl, background: on ? cssVars.colors.primary : cssVars.colors.background }} aria-hidden="true">
                  <span style={{ ...S.knob, ...(on ? { right: borderWidths.medium } : { left: borderWidths.medium }), background: on ? cssVars.colors.onPrimary : cssVars.colors.borderControl }} />
                </span>
                <span style={S.word} aria-hidden="true">{on ? t('spectatorDisplay.on') : t('spectatorDisplay.off')}</span>
              </button>
            </div>
            {picker('home', draft.homeColor)}
            {picker('away', draft.awayColor)}
          </>
        ) : (
          <div data-testid="spectator-display-lead-only"><LeadOnlyHint /></div>
        )}
      </CollapsibleSection>
    </div>
      {canEdit && (
        <div style={column === null ? S.footer : { ...S.footer, left: column.left, right: 'auto', width: column.width }} data-testid="spectator-display-footer">
          <div style={column === null ? S.footerInner : { ...S.footerInner, paddingLeft: 0, paddingRight: 0 }}>
            {saved && <p role="status" style={S.saved}>{t('spectatorDisplay.saved')}</p>}
            <button type="button" style={S.save} onClick={handleSave} data-primary data-testid="spectator-display-save">{t('spectatorDisplay.save')}</button>
          </div>
        </div>
      )}
    </>
  );
}
