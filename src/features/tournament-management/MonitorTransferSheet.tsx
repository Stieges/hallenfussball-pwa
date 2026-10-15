/**
 * MonitorTransferSheet - „Monitore übernehmen“ (B-22, H1.4 @ME-039 bis @ME-043, @ME-058)
 *
 * Quellen: anderes eigenes Turnier · Vorlage „Hallen-Standard“ · Datei.
 * Übernehmen legt neue Monitore an. Teams, Spiele und Tabellen kommen aus diesem Turnier;
 * kein Bildschirm wird umgestellt (@ME-045).
 */

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../design-tokens';
import {
  actionsStyle,
  alertStyle,
  bodyStyle,
  fileInputStyle,
  introStyle,
  mutedStyle,
  optionStyle,
  sectionStyle,
  sectionTitleStyle,
} from './components/monitorTransferStyles';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import type { Tournament } from '../../types/tournament';
import type { TournamentMonitor } from '../../types/monitor';
import { useTournaments } from '../../hooks/useTournaments';
import {
  exportMonitorConfig, HALLEN_STANDARD, importMonitorConfig, instantiateMonitorConfig, MONITOR_CONFIG_MAX_BYTES,
} from '../../core/services/monitorConfigTransfer';
import type { MonitorConfigPayload } from '../../core/services/monitorConfigTransfer';
import { importErrorMessage, newId } from './components/monitorTransferHelpers';
import { applySlideFixes, findReferenceIssues, sanitizeCustomQr, tournamentSlotTargets } from '../../core/services/monitorConfigTransferChecks';
import type { CustomQrSkipped, ReferenceIssue, SlideFix } from '../../core/services/monitorConfigTransferChecks';
import { MonitorTransferIssues, MonitorTransferResultNotes } from './components/MonitorTransferNotes';

// =============================================================================
// TYPES & HELPERS
// =============================================================================

type TransferChoice =
  | { kind: 'tournament'; tournamentId: string }
  | { kind: 'template' }
  | { kind: 'file'; fileName: string; payload: MonitorConfigPayload };

interface TransferResult {
  count: number;
  skippedSponsors: string[];
  renamed: { from: string; to: string }[];
  customQrSkipped: CustomQrSkipped;
}

/** Entscheidungen je Folie gelten nur für die Auswahl, zu der sie getroffen wurden */
interface FixState {
  choice: TransferChoice;
  fixes: Record<string, SlideFix>;
}

export interface MonitorTransferSheetProps {
  tournament: Tournament;
  onClose: () => void;
  /** Speichert die neuen Monitore (ändert keine bestehenden Monitore) */
  onApply: (monitors: TournamentMonitor[]) => Promise<void>;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function MonitorTransferSheet({ tournament, onClose, onApply }: MonitorTransferSheetProps) {
  const { t } = useTranslation('tournament');
  const { activeTournaments, loading } = useTournaments();

  const [choice, setChoice] = useState<TransferChoice | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [result, setResult] = useState<TransferResult | null>(null);
  const [fixState, setFixState] = useState<FixState | null>(null);

  // Quellen: andere aktive Turniere mit Monitoren (@ME-043: nur die eigenen, die die Liste liefert)
  const sources = useMemo(
    () => activeTournaments.filter(s => s.id !== tournament.id && (s.monitors?.length ?? 0) > 0),
    [activeTournaments, tournament.id]
  );

  const rawPayload = useMemo<MonitorConfigPayload | null>(() => {
    if (!choice) {return null;}
    if (choice.kind === 'template') {
      // Der Monitorname ist in der Vorlage ein Schlüssel; die UI setzt den übersetzten Namen
      return {
        ...HALLEN_STANDARD,
        monitors: HALLEN_STANDARD.monitors.map(m => ({ ...m, name: t('monitors.transfer.templateMonitorName') })),
      };
    }
    if (choice.kind === 'file') {return choice.payload;}
    const source = sources.find(s => s.id === choice.tournamentId);
    return source ? exportMonitorConfig(source.monitors ?? [], source.sponsors ?? []) : null;
  }, [choice, sources, t]);

  // Eigener QR-Link: aus Datei verworfen, aus Turnier nur mit http/https (@ME-063)
  const prepared = useMemo(() => {
    if (!choice || !rawPayload) {return null;}
    return sanitizeCustomQr(rawPayload, choice.kind === 'file' ? 'file' : 'tournament');
  }, [choice, rawPayload]);
  const payload = prepared?.payload ?? null;
  const currentFixes = fixState?.choice === choice ? fixState.fixes : {};

  // Folien mit Feld/Gruppe, die dieses Turnier nicht hat (@ME-061)
  const issues = useMemo<ReferenceIssue[]>(
    () => (payload ? findReferenceIssues(payload, tournamentSlotTargets(tournament)) : []),
    [payload, tournament]
  );

  const slideCount = payload?.monitors.reduce((sum, m) => sum + m.slides.length, 0) ?? 0;
  const monitorCount = payload?.monitors.length ?? 0;

  const handleFix = (key: string, fix: SlideFix | null) => {
    if (!choice) {return;}
    const next: Record<string, SlideFix> = Object.fromEntries(Object.entries(currentFixes).filter(([k]) => k !== key));
    if (fix) {next[key] = fix;}
    setFixState({ choice, fixes: next });
  };

  const handleFile = async (file: File | undefined) => {
    setError(null);
    setResult(null);
    if (!file) {return;}

    // Größe vor dem Lesen prüfen; der Service prüft zusätzlich den Text
    if (file.size > MONITOR_CONFIG_MAX_BYTES) {
      setChoice(null);
      setFileError(importErrorMessage(t, 'too-large'));
      return;
    }

    let text: string;
    try {
      text = await file.text();
    } catch {
      setChoice(null);
      setFileError(t('monitors.transfer.errors.readFailed'));
      return;
    }

    const parsed = importMonitorConfig(text);
    if (!parsed.ok) {
      setChoice(null);
      setFileError(importErrorMessage(t, parsed.error));
      return;
    }

    setFileError(null);
    setChoice({ kind: 'file', fileName: file.name, payload: parsed.payload });
  };

  const handleApply = async () => {
    if (!payload) {return;}
    setIsApplying(true);
    setError(null);
    try {
      const resolved = applySlideFixes(payload, currentFixes);
      const { monitors, skippedSponsors, renamed } = instantiateMonitorConfig(resolved, {
        sponsors: tournament.sponsors ?? [],
        existingNames: (tournament.monitors ?? []).map(m => m.name),
        generateId: newId,
        now: new Date().toISOString(),
      });
      await onApply(monitors);
      setResult({ count: monitors.length, skippedSponsors, renamed, customQrSkipped: prepared?.skipped ?? { fromFile: 0, invalidUrl: 0 } });
    } catch {
      setError(t('monitors.transfer.errors.saveFailed'));
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <BottomSheet isOpen onClose={onClose} title={t('monitors.transfer.title')}>
      <div data-testid="monitor-transfer-sheet" style={bodyStyle}>
        {result ? (
          <>
            <p data-testid="transfer-done" style={{ margin: 0, color: cssVars.colors.textPrimary }}>
              {t('monitors.transfer.done', { count: result.count })}
            </p>
            <MonitorTransferResultNotes
              renamed={result.renamed}
              customQrSkipped={result.customQrSkipped}
              skippedSponsors={result.skippedSponsors}
            />
            <p style={mutedStyle}>{t('monitors.transfer.noScreenChange')}</p>
            <div style={actionsStyle}>
              <Button variant="primary" onClick={onClose} data-testid="transfer-close">
                {t('monitors.transfer.close')}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p style={introStyle}>{t('monitors.transfer.intro')}</p>

            <section style={sectionStyle} aria-label={t('monitors.transfer.fromTournament')}>
              <h4 style={sectionTitleStyle}>{t('monitors.transfer.fromTournament')}</h4>
              {loading && <p style={mutedStyle}>{t('monitors.transfer.loading')}</p>}
              {!loading && sources.length === 0 && <p style={mutedStyle}>{t('monitors.transfer.noSources')}</p>}
              {sources.map(source => {
                const active = choice?.kind === 'tournament' && choice.tournamentId === source.id;
                return (
                  <button
                    key={source.id}
                    type="button"
                    data-testid={`transfer-source-${source.id}`}
                    aria-pressed={active}
                    style={optionStyle(active)}
                    onClick={() => {
                      setFileError(null);
                      setChoice({ kind: 'tournament', tournamentId: source.id });
                    }}
                  >
                    <span>{source.title}</span>
                    <span style={mutedStyle}>
                      {t('monitors.transfer.sourceMeta', { count: source.monitors?.length ?? 0 })}
                    </span>
                  </button>
                );
              })}
            </section>

            <section style={sectionStyle} aria-label={t('monitors.transfer.fromTemplate')}>
              <h4 style={sectionTitleStyle}>{t('monitors.transfer.fromTemplate')}</h4>
              <button
                type="button"
                data-testid="transfer-template"
                aria-pressed={choice?.kind === 'template'}
                style={optionStyle(choice?.kind === 'template')}
                onClick={() => {
                  setFileError(null);
                  setChoice({ kind: 'template' });
                }}
              >
                <span>{t('monitors.transfer.templateButton')}</span>
              </button>
              <p style={mutedStyle}>{t('monitors.transfer.templateDescription')}</p>
            </section>

            <section style={sectionStyle} aria-label={t('monitors.transfer.fromFile')}>
              <h4 style={sectionTitleStyle}>{t('monitors.transfer.fromFile')}</h4>
              <input
                type="file"
                accept="application/json,.json"
                aria-label={t('monitors.transfer.chooseFile')}
                data-testid="transfer-file"
                style={fileInputStyle}
                onChange={(event) => {
                  void handleFile(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />
              {choice?.kind === 'file' && (
                <p style={mutedStyle} data-testid="transfer-file-name">
                  {t('monitors.transfer.fileChosen', { name: choice.fileName })}
                </p>
              )}
              {fileError && <p role="alert" data-testid="transfer-file-error" style={alertStyle}>{fileError}</p>}
            </section>

            {payload && (
              <p data-testid="transfer-summary" style={{ margin: 0, color: cssVars.colors.textPrimary }}>
                {t('monitors.transfer.summary', {
                  monitors: t('monitors.transfer.monitorsCount', { count: monitorCount }),
                  slides: t('monitors.transfer.slidesCount', { count: slideCount }),
                })}
              </p>
            )}
            <MonitorTransferIssues issues={issues} fixes={currentFixes} onFix={handleFix} />
            {error && <p role="alert" style={alertStyle}>{error}</p>}

            <div style={actionsStyle}>
              <Button variant="secondary" onClick={onClose}>
                {t('monitors.transfer.cancel')}
              </Button>
              <Button
                variant="primary"
                onClick={() => void handleApply()}
                disabled={!payload || isApplying}
                data-testid="transfer-confirm"
              >
                {t('monitors.transfer.confirm')}
              </Button>
            </div>
          </>
        )}
      </div>
    </BottomSheet>
  );
}

export default MonitorTransferSheet;
