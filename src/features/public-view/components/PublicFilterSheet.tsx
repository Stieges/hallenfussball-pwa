/**
 * Filter-Blatt der Zuschauer-Seite (@ZM-196 „Filter als Blatt von unten“): Phase (nur wenn es eine Finalrunde gibt) und Status.
 * Die Wahl gilt sofort und verschiebt den Spielplan dahinter nicht; „Zurücksetzen“ nimmt beides zurück, „Fertig“ (Haupttaste,
 * 56 Bildpunkte, zuletzt) schließt. Auswahlfelder mindestens 44 Bildpunkte (@OB-022). Baustein `BottomSheet`.
 */
import type { CSSProperties, ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import { BottomSheet } from '../../../components/ui/BottomSheet';
import { DialogActions } from '../../../components/ui/molecules/DialogActions';
import type { PhaseFilter, StatusFilter } from '../publicScheduleFilters';

export interface PublicFilterSheetProps {
  isOpen: boolean;
  showPhase: boolean;
  selectedPhase: PhaseFilter;
  selectedStatus: StatusFilter;
  onPhaseChange: (phase: PhaseFilter) => void;
  onStatusChange: (status: StatusFilter) => void;
  onReset: () => void;
  onClose: () => void;
}

const groupStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: cssVars.spacing.sm, marginBottom: cssVars.spacing.md };
const headingStyle: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.sm, fontWeight: cssVars.fontWeights.semibold, color: cssVars.colors.textSecondary };
const optionsStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: cssVars.spacing.sm };
const optionStyle = (active: boolean): CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: cssVars.spacing.xs,
  minHeight: cssVars.touchTargets.minimum, padding: `0 ${cssVars.spacing.md}`,
  borderRadius: cssVars.borderRadius.full,
  border: `${active ? cssVars.borderWidth.medium : cssVars.borderWidth.thin} solid ${active ? cssVars.colors.primary : cssVars.colors.borderControl}`,
  background: active ? cssVars.colors.primaryLight : cssVars.colors.background,
  color: cssVars.colors.textPrimary,
  fontSize: cssVars.fontSizes.md,
  fontWeight: active ? cssVars.fontWeights.bold : cssVars.fontWeights.normal,
  cursor: 'pointer',
});
const liveDotStyle: CSSProperties = { width: cssVars.spacing.sm, height: cssVars.spacing.sm, borderRadius: cssVars.borderRadius.full, background: cssVars.colors.statusLive, flex: 'none' };

/** Häkchen vor dem Wort der gewählten Option: die Wahl steht nie nur in der Farbe. */
function Check(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

interface OptionGroupProps<V extends string> {
  title: string;
  name: string;
  options: ReadonlyArray<{ value: V; label: string; live?: boolean }>;
  selected: V;
  onSelect: (value: V) => void;
}

function OptionGroup<V extends string>({ title, name, options, selected, onSelect }: OptionGroupProps<V>): ReactElement {
  return (
    <div style={groupStyle} role="group" aria-label={title} data-testid={`public-filter-group-${name}`}>
      <h3 style={headingStyle}>{title}</h3>
      <div style={optionsStyle}>
        {options.map((o) => (
          <button key={o.value} type="button" style={optionStyle(selected === o.value)} aria-pressed={selected === o.value} onClick={() => onSelect(o.value)} data-testid={`public-filter-opt-${name}-${o.value}`}>
            {selected === o.value && <Check />}
            {o.live === true && <span style={liveDotStyle} aria-hidden="true" />}
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function PublicFilterSheet({ isOpen, showPhase, selectedPhase, selectedStatus, onPhaseChange, onStatusChange, onReset, onClose }: PublicFilterSheetProps): ReactElement {
  const { t } = useTranslation('publicView');
  const { t: tSport } = useTranslation('sport');
  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={t('filter.sheetTitle')}
      testId="public-filter-sheet"
      footer={<DialogActions primary={{ label: t('filter.done'), onClick: onClose, 'data-testid': 'public-filter-done' }} secondary={[{ label: t('filter.reset'), onClick: onReset, 'data-testid': 'public-filter-reset' }]} />}
    >
      {showPhase && (
        <OptionGroup<PhaseFilter>
          title={t('filter.phaseTitle')}
          name="phase"
          selected={selectedPhase}
          onSelect={onPhaseChange}
          options={[
            { value: 'all', label: t('filter.all') },
            { value: 'groupStage', label: tSport('tournament.groupStage') },
            { value: 'final', label: tSport('tournament.finals') },
          ]}
        />
      )}
      <OptionGroup<StatusFilter>
        title={t('filter.statusTitle')}
        name="status"
        selected={selectedStatus}
        onSelect={onStatusChange}
        options={[
          { value: 'all', label: t('filter.all') },
          { value: 'scheduled', label: tSport('status.scheduled') },
          { value: 'live', label: t('filter.liveWord'), live: true },
          { value: 'finished', label: tSport('status.finished') },
        ]}
      />
    </BottomSheet>
  );
}
