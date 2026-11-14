/**
 * Monitor-Editor mit Entwurf (M1b, @ME-071, @ME-072): Eingaben ändern nur den Entwurf, gespeichert wird erst mit
 * „Speichern“; Schließen mit Änderungen fragt „Änderungen verwerfen?“.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { dialogWidths } from '../../../../design-tokens';
import type { Tournament } from '../../../../types/tournament';
import type { SlideType, TournamentMonitor } from '../../../../types/monitor';
import { useMonitors, useSponsors } from '../../../../hooks';
import { DialogSurface } from '../../../../components/ui/molecules/DialogSurface';
import { DialogActions } from '../../../../components/ui/molecules/DialogActions';
import { InlineNotice } from '../../../../components/ui/molecules/InlineNotice';
import { ConfirmDialog } from '../../../../components/ui/ConfirmDialog';
import { useOptionalToast } from '../../../../components/ui/Toast';
import { useSlotFields } from '../../hooks/useSlotFields';
import { useMonitorEditorDraft } from '../../hooks/useMonitorEditorDraft';
import { buildEditorGroups, slideSetupProblem } from './monitorEditorHelpers';
import { validateMonitorName } from './validateMonitorName';
import { UnreadySlidesDialog, type UnreadySlide } from './UnreadySlidesDialog';
import { MonitorSettingsSection } from './MonitorSettingsSection';
import { MonitorSlideList } from './MonitorSlideList';
import type { SlideActions, SlideContext } from './monitorEditorTypes';
import { closeButtonStyle, contentStyle, footerStackStyle, headerStyle, titleStyle } from './monitorEditorStyles';

interface MonitorEditorDialogProps {
  tournament: Tournament;
  stored: TournamentMonitor;
  onTournamentUpdate: (tournament: Tournament) => Promise<void>;
  onClose: () => void;
}

export function MonitorEditorDialog({ tournament, stored, onTournamentUpdate, onClose }: MonitorEditorDialogProps) {
  const { t } = useTranslation('tournament');
  const toast = useOptionalToast();
  const { saveMonitor } = useMonitors(tournament, onTournamentUpdate);
  const { sponsors } = useSponsors(tournament, onTournamentUpdate);
  // Felder wie die Übernahme-Prüfung; slotTargets für den Warnhinweis an Folien (K4, @ME-061)
  const { fields, getFieldDisplayName, slotTargets } = useSlotFields(tournament, onTournamentUpdate);

  const otherNames = useMemo(
    () => (tournament.monitors ?? []).filter(m => m.id !== stored.id).map(m => m.name),
    [tournament.monitors, stored.id]
  );
  const editor = useMonitorEditorDraft(stored, otherNames, saveMonitor);
  const { draft, isDirty, isSaving, nameError, saveError } = editor;

  const [editingSlideId, setEditingSlideId] = useState<string | null>(null);
  const [isAddingSlide, setIsAddingSlide] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [unreadyOpen, setUnreadyOpen] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [scrollToId, setScrollToId] = useState<string | null>(null);
  const clickGuard = useRef(false);

  const titleId = `monitor-editor-title-${stored.id}`;
  const groups = useMemo(() => buildEditorGroups(tournament, t), [tournament, t]);

  const requestClose = useCallback(() => {
    if (isDirty) {
      setConfirmOpen(true);
    } else {
      onClose();
    }
  }, [isDirty, onClose]);

  // Folien, die noch nicht eingerichtet sind und am Monitor nicht erscheinen (@ME-076)
  const unready = useMemo<UnreadySlide[]>(
    () => draft.slides.flatMap(slide => {
      const problem = slideSetupProblem(slide, sponsors);
      return problem ? [{ slide, problem }] : [];
    }),
    [draft.slides, sponsors]
  );

  const doSave = useCallback(async () => {
    if (clickGuard.current) {return;}
    clickGuard.current = true;
    try {
      const result = await editor.save();
      if (result === 'saved') {
        toast?.showSuccess(t('monitorEditor.saved'));
        onClose();
      } else if (result === 'unchanged') {
        onClose();
      }
      // 'busy': ein Speichern läuft schon, nichts tun
    } finally {
      clickGuard.current = false;
    }
  }, [editor, toast, t, onClose]);

  // „Speichern“: mit nicht eingerichteten Folien erst fragen; bei ungültigem Namen zeigt `save()` den Hinweis am Feld
  const handleSave = useCallback(() => {
    setShowErrors(true);
    if (isDirty && unready.length > 0 && validateMonitorName(draft.name, otherNames) === null) {
      setUnreadyOpen(true);
      return;
    }
    void doSave();
  }, [isDirty, unready.length, draft.name, otherNames, doSave]);

  const handleBackToEditor = useCallback(() => {
    setUnreadyOpen(false);
    if (unready[0]) {
      setEditingSlideId(unready[0].slide.id);
      setScrollToId(unready[0].slide.id);
    }
  }, [unready]);

  useEffect(() => {
    if (!scrollToId) {return;}
    const row = document.querySelector(`[data-testid="monitor-slide-row-${scrollToId}"]`);
    if (row && typeof row.scrollIntoView === 'function') {row.scrollIntoView({ block: 'center' });}
    setScrollToId(null);
  }, [scrollToId]);

  const handleAddSlide = useCallback((type: SlideType) => {
    // Feld vorbelegen: erstes Feld für jede Folie mit Feld (@ME-066, @ME-075)
    const hasField = type === 'live' || type === 'schedule-field';
    const slide = editor.addSlide(type, hasField && fields[0] ? { fieldId: fields[0].id } : undefined);
    setEditingSlideId(slide.id);
    setIsAddingSlide(false);
  }, [editor, fields]);

  const slideContext: SlideContext = { tournament, fields, groups, sponsors, slotTargets, getFieldDisplayName, showErrors };
  const slideActions: SlideActions = {
    onMoveSlide: editor.moveSlide,
    onRemoveSlide: (slideId) => {
      editor.removeSlide(slideId);
      setEditingSlideId(current => (current === slideId ? null : current));
    },
    onUpdateSlide: editor.updateSlide,
    onToggleEditSlide: (slideId) => setEditingSlideId(current => (current === slideId ? null : slideId)),
  };

  return (
    <>
      <DialogSurface
        isOpen
        onClose={requestClose}
        dismissible={!confirmOpen && !unreadyOpen}
        maxWidth={dialogWidths.lg}
        labelledBy={titleId}
        header={
          <div style={headerStyle}>
            <h2 id={titleId} style={titleStyle}>{stored.name}</h2>
            <button style={closeButtonStyle} onClick={requestClose} aria-label={t('monitorEditor.close')} data-testid="monitor-editor-close">✕</button>
          </div>
        }
        footer={
          <div style={footerStackStyle}>
            {saveError && (
              <InlineNotice tone="error" data-testid="monitor-editor-save-error">{t('monitorEditor.errors.saveFailed')}</InlineNotice>
            )}
            <DialogActions
              secondary={[{ label: t('monitorEditor.cancel'), onClick: onClose, disabled: isSaving, 'data-testid': 'monitor-editor-cancel' }]}
              primary={{ label: t('monitorEditor.save'), onClick: handleSave, disabled: isSaving, 'data-testid': 'monitor-editor-save' }}
            />
          </div>
        }
      >
        <div style={contentStyle}>
          <MonitorSettingsSection monitor={draft} nameError={nameError} onUpdateSettings={editor.updateSettings} />
          <MonitorSlideList
            monitor={draft}
            editingSlideId={editingSlideId}
            isAddingSlide={isAddingSlide}
            slideContext={slideContext}
            slideActions={slideActions}
            onAddSlide={handleAddSlide}
            onToggleAddSlide={() => setIsAddingSlide(open => !open)}
          />
        </div>
      </DialogSurface>
      <UnreadySlidesDialog
        isOpen={unreadyOpen}
        slides={unready}
        onBack={handleBackToEditor}
        onSaveAnyway={() => { setUnreadyOpen(false); void doSave(); }}
      />
      <ConfirmDialog
        isOpen={confirmOpen}
        variant="danger"
        title={t('monitorEditor.discard.title')}
        message={t('monitorEditor.discard.message')}
        confirmText={t('monitorEditor.discard.confirm')}
        cancelText={t('monitorEditor.discard.keepEditing')}
        onConfirm={onClose}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
