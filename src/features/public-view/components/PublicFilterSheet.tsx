/**
 * Filter-Blatt der Zuschauer-Seite (@ZM-196 „Filter als Blatt von unten“): Phase (nur wenn es eine Finalrunde gibt) und Status.
 * Die Wahl gilt sofort und verschiebt den Spielplan dahinter nicht; „Zurücksetzen“ nimmt beides zurück, „Fertig“ (Haupttaste,
 * 56 Bildpunkte, zuletzt) schließt. Auswahlfelder mindestens 44 Bildpunkte (@OB-022). Baustein `BottomSheet`.
 */
import type { CSSProperties, ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import { ChipButton } from '../../../components/ui/atoms/ChipButton';
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
/** Auswahlfelder im Blatt: Pille, gewählt getönt mit Häkchen und kräftigem Rand, mindestens 44 Bildpunkte (@OB-022). */
const OPTION = { look: 'tint', radius: 'full', size: 'minimum', borderSelected: 'medium', idleWeight: 'normal' } as const;
const liveDotStyle: CSSProperties = { width: cssVars.spacing.sm, height: cssVars.spacing.sm, borderRadius: cssVars.borderRadius.full, background: cssVars.colors.statusLive, flex: 'none' };

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
          <ChipButton key={o.value} {...OPTION} selected={selected === o.value} onClick={() => onSelect(o.value)} data-testid={`public-filter-opt-${name}-${o.value}`}>
            {o.live === true && <span style={liveDotStyle} aria-hidden="true" />}
            {o.label}
          </ChipButton>
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
