/**
 * Hinweise beim Übernehmen (B-22b): Folien mit fehlendem Feld/Gruppe (@ME-061),
 * Umbenennung (@ME-062), eigener QR-Link aus Datei oder mit ungültiger Adresse (@ME-063).
 */

import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import { Button } from '../../../components/ui/Button';
import type { CustomQrSkipped, FileCustomQrLink, ReferenceIssue, SlideFix } from '../../../core/services/monitorConfigTransferChecks';
import { alertStyle, mutedStyle, sectionStyle } from './monitorTransferStyles';

const issueRowStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: cssVars.spacing.xs,
  padding: cssVars.spacing.sm,
  borderRadius: cssVars.borderRadius.sm,
  border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.warning}`,
  background: cssVars.colors.warningSubtle,
};

const issueTextStyle: CSSProperties = {
  margin: 0,
  fontSize: cssVars.fontSizes.sm,
  color: cssVars.colors.textPrimary,
};

const choiceRowStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: cssVars.spacing.sm };

const FIX_LABEL_KEY = {
  'reassign-field': 'monitors.transfer.issues.reassignField',
  'all-groups': 'monitors.transfer.issues.allGroups',
  remove: 'monitors.transfer.issues.removeSlide',
} as const satisfies Record<SlideFix, string>;

function numberFromId(id: string): string {
  const match = /^field-(\d+)$/.exec(id);
  return match ? match[1] : id;
}

export interface MonitorTransferIssuesProps {
  issues: ReferenceIssue[];
  /** Getroffene Entscheidungen je Folie (Schlüssel „Monitor:Folie“) */
  fixes: Readonly<Record<string, SlideFix>>;
  onFix: (key: string, fix: SlideFix | null) => void;
  /** Eigene Links aus der Datei, die zum Prüfen angezeigt werden (@ME-063) */
  fileLinks: FileCustomQrLink[];
  /** „Link entfernen“ gewählt (Schlüssel „Monitor:Folie“) */
  qrRemoved: Readonly<Record<string, boolean>>;
  onQrRemove: (key: string) => void;
}

/** Je fehlender Referenz eine Folie mit den Entscheidungen; ohne Wahl bleibt die Folie */
export function MonitorTransferIssues({ issues, fixes, onFix, fileLinks, qrRemoved, onQrRemove }: MonitorTransferIssuesProps) {
  const { t } = useTranslation('tournament');
  if (issues.length === 0 && fileLinks.length === 0) {return null;}

  return (
    <section style={sectionStyle} aria-label={t('monitors.transfer.issues.title')} data-testid="transfer-issues">
      {fileLinks.map(link => {
        const removed = qrRemoved[link.key];
        return (
          <div key={`qr-${link.key}`} style={issueRowStyle} data-testid={`transfer-file-link-${link.key}`}>
            <p role="status" style={issueTextStyle}>
              {removed
                ? t('monitors.transfer.customQrRemoved')
                : t('monitors.transfer.customQrCheck', { url: link.url })}
            </p>
            <div style={choiceRowStyle}>
              <Button
                variant="ghost"
                size="sm"
                aria-pressed={removed}
                data-testid={`transfer-file-link-${link.key}-remove`}
                onClick={() => onQrRemove(link.key)}
              >
                {removed ? t('monitors.transfer.customQrKeep') : t('monitors.transfer.customQrRemove')}
              </Button>
            </div>
          </div>
        );
      })}
      {issues.map(issue => {
        const isField = issue.problem === 'field';
        const ref = isField
          ? t('monitors.transfer.issues.fieldName', { number: numberFromId(issue.missingId) })
          : t('monitors.transfer.issues.groupName', { letter: issue.missingId });
        const slideTitle = issue.slideType === 'standings'
          ? t('monitors.transfer.issues.slideTable', { ref })
          : issue.slideType === 'schedule-group' || issue.slideType === 'schedule-field'
            ? t('monitors.transfer.issues.slideSchedule', { ref })
            : t('monitors.transfer.issues.slideLive', { ref });
        const text = isField
          ? t('monitors.transfer.issues.fieldMissing', { slide: slideTitle, field: ref })
          : t('monitors.transfer.issues.groupMissing', { slide: slideTitle, group: ref });
        const active = fixes[issue.key];

        return (
          <div key={issue.key} style={issueRowStyle} data-testid={`transfer-issue-${issue.key}`}>
            <p role="status" style={issueTextStyle}>{text}</p>
            <div style={choiceRowStyle}>
              {issue.fixes.map(fix => (
                <Button
                  key={fix}
                  variant={fix === 'remove' ? 'ghost' : 'secondary'}
                  size="sm"
                  aria-pressed={active === fix}
                  data-testid={`transfer-issue-${issue.key}-${fix}`}
                  onClick={() => onFix(issue.key, active === fix ? null : fix)}
                >
                  {t(FIX_LABEL_KEY[fix])}
                </Button>
              ))}
            </div>
          </div>
        );
      })}
      {issues.length > 0 && <p style={mutedStyle}>{t('monitors.transfer.issues.keepHint')}</p>}
    </section>
  );
}

export interface MonitorTransferResultNotesProps {
  renamed: { from: string; to: string }[];
  customQrSkipped: CustomQrSkipped;
  skippedSponsors: string[];
}

/** Rückmeldung nach dem Übernehmen: Sponsor fehlt, Umbenennung, eigener Link nicht übernommen */
export function MonitorTransferResultNotes({ renamed, customQrSkipped, skippedSponsors }: MonitorTransferResultNotesProps) {
  const { t } = useTranslation('tournament');
  return (
    <>
      {skippedSponsors.map((name, index) => (
        <p key={`${name}-${index}`} data-testid="transfer-skipped-sponsor" role="status" style={mutedStyle}>
          {t('monitors.transfer.skippedSponsor', { name })}
        </p>
      ))}
      {renamed.map(entry => (
        <p key={entry.to} data-testid="transfer-renamed" role="status" style={mutedStyle}>
          {t('monitors.transfer.renamed', { name: entry.to })}
        </p>
      ))}
      {customQrSkipped.invalidUrl > 0 && (
        <p data-testid="transfer-custom-qr-invalid" role="alert" style={alertStyle}>
          {t('monitors.transfer.customQrInvalid')}
        </p>
      )}
    </>
  );
}

