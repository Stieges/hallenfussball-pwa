/**
 * MonitorEditor - Detaillierte Monitor-Konfiguration
 *
 * MON-KONF-01: Ermöglicht die Konfiguration einer Monitor-Diashow.
 * M1b: Änderungen gelten erst mit „Speichern“ (@ME-071); die Arbeit liegt in MonitorEditorDialog.
 *
 * @see MONITOR-KONFIGURATOR-UMSETZUNGSPLAN-v2.md P1-05
 */

import { useTranslation } from 'react-i18next';
import { dialogWidths } from '../../design-tokens';
import type { Tournament } from '../../types/tournament';
import { DialogSurface } from '../../components/ui/molecules/DialogSurface';
import { MonitorEditorDialog } from './components/monitor-editor/MonitorEditorDialog';
import { closeButtonStyle, contentStyle, headerStyle, titleStyle } from './components/monitor-editor/monitorEditorStyles';

interface MonitorEditorProps {
  tournament: Tournament;
  monitorId: string;
  onTournamentUpdate: (tournament: Tournament) => Promise<void>;
  onClose: () => void;
}

export function MonitorEditor({ tournament, monitorId, onTournamentUpdate, onClose }: MonitorEditorProps) {
  const { t } = useTranslation('tournament');
  const stored = (tournament.monitors ?? []).find(m => m.id === monitorId);

  if (!stored) {
    return (
      <DialogSurface isOpen onClose={onClose} maxWidth={dialogWidths.lg} ariaLabel={t('monitorEditor.notFound')}>
        <div style={headerStyle}>
          <h2 style={titleStyle}>{t('monitorEditor.notFound')}</h2>
          <button style={closeButtonStyle} onClick={onClose} aria-label={t('monitorEditor.close')}>✕</button>
        </div>
        <div style={contentStyle}>
          <p>{t('monitorEditor.notFoundMessage', { id: monitorId })}</p>
        </div>
      </DialogSurface>
    );
  }

  return <MonitorEditorDialog tournament={tournament} stored={stored} onTournamentUpdate={onTournamentUpdate} onClose={onClose} />;
}

export default MonitorEditor;
