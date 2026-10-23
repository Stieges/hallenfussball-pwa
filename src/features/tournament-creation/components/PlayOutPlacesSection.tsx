/**
 * Abschnitt „Diese Plätze müssen bei Gleichstand ausgespielt werden“ im Assistenten, Schritt „Tabellenregeln“ (Paket TB-B,
 * TB-6d'; Mockup v3; @W2A-066, @W2A-073). Ein Chip je angebotenem Platz (1 bis Teamzahl der größten Gruppe), vorbelegt nur
 * Platz 1, jeder Platz an- und abhakbar. Darunter eine Zeile, was die Einstellung bedeutet. Die Einstellung bleibt später
 * jederzeit änderbar (Einstellungen der Turnierverwaltung, dort derselbe Baustein `PlayOutPlacesField`). Speicherwert und
 * Kappung: `playOutPlaces.ts`.
 */
import { useMemo, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import { InlineNotice } from '../../../components/ui/molecules/InlineNotice';
import { PlacesToPlayOutPicker } from '../../../components/ui/molecules/PlacesToPlayOutPicker';
import { DEFAULT_PLACEMENTS_TO_PLAY_OUT, offeredPlacesForSetup, parsePlacementsToPlayOut } from '../../../core/standings/playOutPlaces';
import { placesListText, type PlaceTexts } from '../../tournament-management/standings/tieFormat';
import type { Tournament } from '../../../types/tournament';

const heading: CSSProperties = { color: cssVars.colors.primary, fontSize: cssVars.fontSizes.lg, margin: `0 0 ${cssVars.spacing.sm}` };
const help: CSSProperties = { margin: `0 0 ${cssVars.spacing.md}`, color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.md, lineHeight: cssVars.lineHeights.bodyMd };

export interface PlayOutPlacesFieldProps {
  /** Angebotene Plätze (1 bis Teamzahl der größten Gruppe). */
  offered: readonly number[];
  /** Gespeicherte Einstellung (fehlend = Voreinstellung, nur Platz 1). */
  value: readonly number[] | undefined;
  onChange: (next: number[]) => void;
  disabled?: boolean;
}

/** Überschrift, Erklärung, Auswahl und Wirkungszeile – im Assistenten und in den Einstellungen derselbe Baustein. */
export const PlayOutPlacesField = ({ offered, value, onChange, disabled = false }: PlayOutPlacesFieldProps) => {
  const { t, i18n } = useTranslation('wizard');
  const selected = useMemo(
    () => parsePlacementsToPlayOut(value ?? [...DEFAULT_PLACEMENTS_TO_PLAY_OUT]).filter((p) => offered.includes(p)),
    [value, offered],
  );
  const texts = useMemo<PlaceTexts>(() => ({
    one: (from) => t('playOut.places.one', { from }),
    two: (from, to) => t('playOut.places.two', { from, to }),
    range: (from, to) => t('playOut.places.range', { from, to }),
  }), [t]);
  const others = offered.filter((p) => !selected.includes(p));
  const summary = selected.length === 0
    ? t('playOut.summaryNone')
    : others.length === 0
      ? t('playOut.summaryAll', { selected: placesListText(texts, selected, i18n.language) })
      : t('playOut.summary', { selected: placesListText(texts, selected, i18n.language), others: placesListText(texts, others, i18n.language) });

  return (
    <div data-testid="playout-section">
      <h3 style={heading}>{t('playOut.title')}</h3>
      <p style={help}>{t('playOut.help')}</p>
      <PlacesToPlayOutPicker
        places={offered}
        selected={selected}
        onChange={onChange}
        placeLabel={(place) => t('playOut.place', { place })}
        legend={t('playOut.legend')}
        disabled={disabled}
      />
      <p style={{ ...help, margin: `${cssVars.spacing.sm} 0 ${cssVars.spacing.md}`, fontSize: cssVars.fontSizes.sm }}>{t('playOut.followUpNote')}</p>
      <InlineNotice tone="info" data-testid="playout-summary"><span>{summary}</span></InlineNotice>
    </div>
  );
};

export interface PlayOutPlacesSectionProps {
  formData: Partial<Tournament>;
  onUpdate: <K extends keyof Tournament>(field: K, value: Tournament[K]) => void;
}

/** Abschnitt im Assistenten: angebotene Plätze aus Teamzahl und Gruppenzahl der Einrichtung (@W2A-073). */
export const PlayOutPlacesSection = ({ formData, onUpdate }: PlayOutPlacesSectionProps) => {
  const offered = useMemo(() => offeredPlacesForSetup(formData), [formData]);
  return (
    <div style={{ marginTop: cssVars.spacing.lg }}>
      <PlayOutPlacesField offered={offered} value={formData.placementsToPlayOut} onChange={(next) => onUpdate('placementsToPlayOut', next)} />
    </div>
  );
};
