/**
 * Turnierlogo und zweite Grafik im Assistenten, Schritt 1 „Stammdaten“ (@W3-030, @W3-040, @DR-040, @DR-041, PDF-Paket T5).
 *
 * Die Grafiken liegen nur auf diesem Gerät (`useTournamentGraphics`, getrennt vom Turnier) unter der ID des Entwurfs; sie
 * erscheinen hier und in den Ausdrucken, die dieses Gerät erzeugt. Eine Datei wird beim Hochladen geprüft und aufbereitet
 * (`prepareTournamentGraphic`); eine abgelehnte Datei lässt Logo, Tupfer und gespeicherten Stand unverändert. Der Tupfer
 * zeigt die Akzentfarbe aus dem Logo links, sonst das Grün der App; er ist nur Anzeige. Die zweite Grafik ändert ihn nie.
 */
import { useState, type CSSProperties, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { GraphicUploadField } from '../../../components/ui/molecules/GraphicUploadField';
import { ColorDot } from '../../../components/ui/atoms/ColorDot';
import { cssVars } from '../../../design-tokens';
import { printAccent } from '../../../design-tokens/print';
import { printHeader } from '../../../design-tokens/print-header';
import { requestPersistentStorage } from '../../../core/storage/requestPersistentStorage';
import { tournamentGraphicsStore, type StoredGraphic, type TournamentGraphics } from '../../../core/storage/tournamentGraphicsStore';
import { useTournamentGraphics } from '../../../hooks/useTournamentGraphics';
import { accentNameKey } from '../../../lib/color/accentName';
import { isLowRes, type RejectReason } from '../../../lib/images/graphicRules';
import { prepareTournamentGraphic } from '../../../lib/images/prepareTournamentGraphic';

type Slot = 'left' | 'right';
type Problem = { slot: Slot; kind: RejectReason | 'save' | 'load' };

const BYTES_PER_MB = 1024 * 1024;
const accentRowStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: cssVars.spacing.md, marginTop: cssVars.spacing.md };
const accentTextStyle: CSSProperties = { minWidth: 0, fontSize: cssVars.fontSizes.md, color: cssVars.colors.textPrimary };
const accentNameStyle: CSSProperties = { display: 'block', fontSize: cssVars.fontSizes.md, color: cssVars.colors.textSecondary };

export interface TournamentGraphicsFieldsProps {
  /** ID des Entwurfs; ohne sie lässt sich nichts speichern. */
  tournamentId: string | undefined;
}

export function TournamentGraphicsFields({ tournamentId }: TournamentGraphicsFieldsProps): ReactElement {
  const { t } = useTranslation('wizard');
  const { graphics, loading, error: storeError, save } = useTournamentGraphics(tournamentId);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [preparing, setPreparing] = useState(false);
  const busy = preparing || loading;

  /**
   * Der Stand, auf dem eine Änderung aufbaut. Nach einem Ladefehler ist `graphics` leer, obwohl auf dem Gerät etwas stehen kann:
   * dann wird vor dem Speichern neu gelesen, damit eine vorhandene Grafik nicht still überschrieben wird. Lässt sich der Stand
   * auch jetzt nicht lesen, wird nichts gespeichert und der Ladefehler steht am Feld (@DR-024).
   */
  const baseGraphics = async (slot: Slot): Promise<TournamentGraphics | null> => {
    if (storeError === null || tournamentId === undefined) { return graphics; }
    try {
      return await tournamentGraphicsStore.load(tournamentId);
    } catch {
      setProblem({ slot, kind: 'load' });
      return null;
    }
  };

  const persist = async (next: TournamentGraphics, slot: Slot, base: TournamentGraphics): Promise<void> => {
    const firstGraphic = base.left === undefined && base.right === undefined;
    if (!(await save(next))) { setProblem({ slot, kind: 'save' }); return; }
    if (firstGraphic && (next.left !== undefined || next.right !== undefined)) { void requestPersistentStorage(); } // R8: ohne Garantie
  };

  const handleSelect = async (slot: Slot, file: File): Promise<void> => {
    setProblem(null);
    setPreparing(true);
    try {
      const base = await baseGraphics(slot);
      if (base === null) { return; }
      const result = await prepareTournamentGraphic(file, { computeAccent: slot === 'left' }); // der Akzent kommt nur vom Logo links
      if (!result.ok) { setProblem({ slot, kind: result.reason }); return; }
      await persist(slot === 'left'
        ? { right: base.right, left: result.graphic, ...(result.accent === undefined ? {} : { accent: result.accent }) }
        : { ...base, right: result.graphic }, slot, base);
    } finally {
      setPreparing(false);
    }
  };

  const handleRemove = async (slot: Slot): Promise<void> => {
    setProblem(null);
    setPreparing(true);
    try {
      const base = await baseGraphics(slot);
      if (base === null) { return; }
      await persist(slot === 'left' ? { right: base.right } : { left: base.left, ...(base.accent === undefined ? {} : { accent: base.accent }) }, slot, base);
    } finally {
      setPreparing(false);
    }
  };

  const ownKey = (slot: Slot): 'logo' | 'second' => (slot === 'left' ? 'logo' : 'second');
  const warning = (slot: Slot, graphic: StoredGraphic | undefined): string | undefined => (graphic !== undefined && isLowRes(graphic.originalHeightPx)
    ? t(`step3.graphics.${ownKey(slot)}.lowRes`, { height: graphic.originalHeightPx, min: printHeader.logoWarnBelowHeightPx })
    : undefined);
  const errorText = (slot: Slot, graphic: StoredGraphic | undefined): string | undefined => {
    if (problem === null) { return slot === 'left' && storeError !== null ? t('step3.graphics.loadFailed') : undefined; }
    if (problem.slot !== slot) { return undefined; }
    if (problem.kind === 'load') { return t('step3.graphics.loadFailed'); }
    if (problem.kind === 'save') { return t(`step3.graphics.${ownKey(slot)}.saveFailed`); }
    const keeps = graphic === undefined ? '' : ` ${t(`step3.graphics.${ownKey(slot)}.keeps`)}`;
    return `${t(`step3.graphics.error.${problem.kind}`, { maxMb: printHeader.logoMaxBytes / BYTES_PER_MB, maxSide: printHeader.logoMaxSidePx })}${keeps}`;
  };

  const accent = graphics.left !== undefined && graphics.accent !== undefined ? graphics.accent : printAccent.fallback;
  const accentName = graphics.left !== undefined && graphics.accent !== undefined
    ? t(`step3.graphics.accent.names.${accentNameKey(graphics.accent)}`)
    : t('step3.graphics.accent.appGreen');
  const common = { formatHint: t('step3.graphics.format', { maxMb: printHeader.logoMaxBytes / BYTES_PER_MB }), busy } as const;

  return (
    <>
      <GraphicUploadField
        {...common}
        testIdPrefix="turnierlogo"
        label={t('step3.graphics.logo.label')}
        optionalHint={t('step3.graphics.logo.optional')}
        src={graphics.left?.dataUrl}
        previewAlt={t('step3.graphics.logo.previewAlt')}
        uploadLabel={t('step3.graphics.logo.upload')}
        changeLabel={t('step3.graphics.logo.change')}
        removeLabel={t('step3.graphics.logo.remove')}
        warning={warning('left', graphics.left)}
        error={errorText('left', graphics.left)}
        deviceHint={t('step3.graphics.logo.device')}
        onSelect={(file) => void handleSelect('left', file)}
        onRemove={() => void handleRemove('left')}
      >
        <div style={accentRowStyle}>
          <ColorDot color={accent} label={`${t('step3.graphics.accent.label')}: ${accentName}`} testId="akzent-tupfer" />
          <span style={accentTextStyle}>
            {t('step3.graphics.accent.label')}
            <small style={accentNameStyle} data-testid="akzent-name">{accentName}</small>
          </span>
        </div>
      </GraphicUploadField>
      <GraphicUploadField
        {...common}
        testIdPrefix="zweite-grafik"
        label={t('step3.graphics.second.label')}
        optionalHint={t('step3.graphics.second.optional')}
        src={graphics.right?.dataUrl}
        previewAlt={t('step3.graphics.second.previewAlt')}
        uploadLabel={t('step3.graphics.second.upload')}
        changeLabel={t('step3.graphics.second.change')}
        removeLabel={t('step3.graphics.second.remove')}
        warning={warning('right', graphics.right)}
        error={errorText('right', graphics.right)}
        onSelect={(file) => void handleSelect('right', file)}
        onRemove={() => void handleRemove('right')}
      />
    </>
  );
}
