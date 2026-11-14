/**
 * LeibchenNachtragen – Blatt „Leibchen im laufenden Spiel“ unter „Mehr“ (@SL-150): nur Turnierleitung und Co-Admin tragen im laufenden Spiel ein
 * Leibchen nach, entfernen es oder wechseln die Seite. Die Anzeige stellt sofort um. Dieselben Felder wie die Karte (Team, Farbe, Warnungen).
 */
import { useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import type { KitSide } from '../../../core/models/kit';
import { Icons } from '../../ui/Icons';
import { DialogActions } from '../../ui/molecules/DialogActions';
import { DialogSurface } from '../../ui/molecules/DialogSurface';
import { LeibchenWahlFelder } from '../../ui/molecules/LeibchenWahlFelder';
import type { LeibchenNachtragDaten } from '../hooks/useLeibchenKarte';

export interface LeibchenNachtragenProps {
  isOpen: boolean;
  onClose: () => void;
  daten: LeibchenNachtragDaten;
}

/** „X“ oben rechts wie im Aktionsblatt: die Zweittaste „Schließen“ unten entfällt, das Blatt hat dort Platz für „Speichern“ und „Leibchen entfernen“ ohne zu rollen. */
const schliessenStil = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: cssVars.touchTargets.minimum, height: cssVars.touchTargets.minimum, flex: 'none',
  background: 'transparent', color: cssVars.colors.textPrimary, border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderControl}`, borderRadius: cssVars.borderRadius.md, cursor: 'pointer',
} as const;

export function LeibchenNachtragen({ isOpen, onClose, daten }: LeibchenNachtragenProps): ReactElement | null {
  const { t } = useTranslation('cockpit');
  const [seite, setSeite] = useState<KitSide>(daten.aktuell?.seite ?? 'a');
  const [farbe, setFarbe] = useState<string>(daten.aktuell?.farbe ?? '');
  return (
    <DialogSurface
      isOpen={isOpen} onClose={onClose} placement="sheet" ariaLabel={t('leibchenKarte.nachtragenTitel')} testId="leibchen-nachtragen"
      header={(
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: cssVars.spacing.sm, padding: `${cssVars.spacing.md} ${cssVars.spacing.md} 0` }}>
          <h2 style={{ fontSize: cssVars.fontSizes.lg, margin: 0 }}>{t('leibchenKarte.nachtragenTitel')}</h2>
          <button type="button" style={schliessenStil} onClick={onClose} aria-label={t('leibchenKarte.schliessen')} data-testid="nachtrag-schliessen"><Icons.X size={iconSizeValues.md} /></button>
        </div>
      )}
      footer={(
        <DialogActions
          primary={{ label: t('leibchenKarte.speichern'), onClick: () => { daten.onSpeichern(seite, farbe); onClose(); }, disabled: farbe === '', 'data-testid': 'nachtrag-speichern' }}
          secondary={[
            ...(daten.aktuell === null ? [] : [{ label: t('leibchenKarte.entfernen'), onClick: () => { daten.onEntfernen(); onClose(); }, 'data-testid': 'nachtrag-entfernen' }]),
          ]}
        />
      )}
    >
      {/* Kopf und Tasten stehen fest, die Wahl dazwischen rollt nötigenfalls: „Speichern“ ist immer erreichbar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: cssVars.spacing.sm, padding: `${cssVars.spacing.xs} ${cssVars.spacing.md}` }}>
        <LeibchenWahlFelder teams={daten.teams} seite={seite} farbe={farbe} hallenFarben={daten.hallenFarben} trikot={daten.trikot}
          onSeite={setSeite} onFarbe={setFarbe} andereAlsBlatt testIdPrefix="nachtrag" />
      </div>
    </DialogSurface>
  );
}
