/**
 * LeibchenNachtragen – Blatt „Leibchen im laufenden Spiel“ unter „Mehr“ (@SL-150): nur Turnierleitung und Co-Admin tragen im laufenden Spiel ein
 * Leibchen nach, entfernen es oder wechseln die Seite. Die Anzeige stellt sofort um. Dieselben Felder wie die Karte (Team, Farbe, Warnungen).
 */
import { useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import type { KitSide } from '../../../core/models/kit';
import { DialogActions } from '../../ui/molecules/DialogActions';
import { DialogSurface } from '../../ui/molecules/DialogSurface';
import { LeibchenWahlFelder } from '../../ui/molecules/LeibchenWahlFelder';
import type { LeibchenNachtragDaten } from '../hooks/useLeibchenKarte';

export interface LeibchenNachtragenProps {
  isOpen: boolean;
  onClose: () => void;
  daten: LeibchenNachtragDaten;
}

export function LeibchenNachtragen({ isOpen, onClose, daten }: LeibchenNachtragenProps): ReactElement | null {
  const { t } = useTranslation('cockpit');
  const [seite, setSeite] = useState<KitSide>(daten.aktuell?.seite ?? 'a');
  const [farbe, setFarbe] = useState<string>(daten.aktuell?.farbe ?? '');
  return (
    <DialogSurface
      isOpen={isOpen} onClose={onClose} placement="sheet" ariaLabel={t('leibchenKarte.nachtragenTitel')} testId="leibchen-nachtragen"
      header={<h2 style={{ fontSize: cssVars.fontSizes.lg, margin: 0, padding: `${cssVars.spacing.md} ${cssVars.spacing.md} 0` }}>{t('leibchenKarte.nachtragenTitel')}</h2>}
      footer={(
        <DialogActions
          primary={{ label: t('leibchenKarte.speichern'), onClick: () => { daten.onSpeichern(seite, farbe); onClose(); }, disabled: farbe === '', 'data-testid': 'nachtrag-speichern' }}
          secondary={[
            { label: t('leibchenKarte.schliessen'), onClick: onClose, 'data-testid': 'nachtrag-schliessen' },
            ...(daten.aktuell === null ? [] : [{ label: t('leibchenKarte.entfernen'), onClick: () => { daten.onEntfernen(); onClose(); }, 'data-testid': 'nachtrag-entfernen' }]),
          ]}
        />
      )}
    >
      {/* Kopf und Tasten stehen fest, die Wahl dazwischen rollt nötigenfalls: „Speichern“ ist immer erreichbar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: cssVars.spacing.sm, padding: cssVars.spacing.md }}>
        <LeibchenWahlFelder teams={daten.teams} seite={seite} farbe={farbe} hallenFarben={daten.hallenFarben} trikot={daten.trikot}
          onSeite={setSeite} onFarbe={setFarbe} andereAlsBlatt testIdPrefix="nachtrag" />
      </div>
    </DialogSurface>
  );
}
