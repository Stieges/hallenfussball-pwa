/**
 * Vorschlag „Gruppe abschließen“ und „Besetzung prüfen“ (GA4 A-13c; Mockup Zustände 1 bis 4, 24, 25). Der Baustein steht oben in
 * „Tabellen“ und „Spielplan“ (Einbau per Import, nicht im Verwaltungskopf) und nur für Turnierleitung und Co-Admin; der Helfer
 * sieht nie Banner oder Taste (@TM-044 Gegenbeispiel). Das letzte Gruppenspiel besetzt nichts – der Banner schlägt nur vor
 * (@TM-044). Eine Haupttaste je Ansicht: bei mehreren fertigen Gruppen ein Banner, die zuerst fertige hat die Haupttaste, jede
 * weitere eine Zweittaste; keine Sammeltaste. Test-IDs über `groupTestId()` (`''` → `all`).
 */
import { useTranslation } from 'react-i18next';
import type { CSSProperties, ReactElement } from 'react';
import { cssVars } from '../../../design-tokens';
import { Button } from '../../../components/ui/Button';
import { InlineNotice } from '../../../components/ui/molecules/InlineNotice';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { everCompleted } from '../../../core/standings/groupCompletions';
import { groupMatches } from '../../../core/services/GroupCompletionService';
import { listText } from '../standings/tieFormat';
import { groupNameOf, withGroup } from './completionTexts';
import { lastGroupLog } from './completionLog';
import { useGroupCompletionUi } from './groupCompletionContext';
import { groupTestId } from './groupTestId';
import { timeText } from '../standings/tieFormat';

const stack: CSSProperties = { display: 'grid', gap: cssVars.spacing.md };
const title: CSSProperties = { fontWeight: cssVars.fontWeights.semibold, fontSize: cssVars.fontSizes.md };
const line: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.md, lineHeight: cssVars.lineHeights.bodyMd };
const primaryStyle: CSSProperties = { minHeight: cssVars.touchTargets.primary };
const secondaryStyle: CSSProperties = { minHeight: cssVars.touchTargets.primary };

export const GroupCompletionBanner = () => {
  const { t, i18n } = useTranslation('tournament');
  const api = useGroupCompletionUi();
  const mobile = useIsMobile();
  if (api === null || !api.canManage || (api.proposals.length === 0 && api.staleGroups.length === 0)) {
    return null;
  }
  const { tournament, proposals, staleGroups } = api;
  const nameOf = (groupId: string): string | undefined => groupNameOf(tournament, groupId);
  // Eine Haupttaste je Ansicht (VISUAL-DESIGN § 8): die erste Taste des ersten Banners, alle weiteren sind Zweittasten
  const primaryGroup = proposals[0] ?? staleGroups[0];
  const closeButton = (groupId: string, label: string, primary: boolean) => (
    <Button
      key={groupId}
      variant={primary ? 'primary' : 'secondary'}
      size="lg"
      fullWidth={mobile}
      style={{ ...(primary ? primaryStyle : secondaryStyle), ...(mobile ? {} : { alignSelf: 'flex-start', padding: `0 ${cssVars.spacing.xl}` }) }}
      onClick={() => { api.begin(groupId); }}
      {...(primary ? { 'data-primary': true } : {})}
      data-testid={`group-close-button-${groupTestId(groupId)}`}
    >
      {label}
    </Button>
  );

  const suggestion = (): ReactElement | null => {
    if (proposals.length === 0) {
      return null;
    }
    if (proposals.length > 1) {
      const names = listText(proposals.map((g) => nameOf(g) ?? ''), i18n.language);
      return (
        <InlineNotice
          tone="info"
          data-testid="group-close-suggestion"
          footer={proposals.map((g) => closeButton(g, t('groupCompletion.button.closeGroup', { name: nameOf(g) ?? '' }), g === primaryGroup))}
        >
          <span style={title}>{t('groupCompletion.banner.many', { groups: names })}</span>
          <p style={line}>{t('groupCompletion.banner.manyBody')}</p>
        </InlineNotice>
      );
    }
    const groupId = proposals[0];
    const name = nameOf(groupId);
    const again = everCompleted(tournament, groupId);
    const hasFinals = tournament.matches.some((m) => m.isFinal === true);
    const reopened = again ? lastGroupLog(tournament, 'reopen_group', groupId) : undefined;
    const count = groupMatches(tournament, groupId).length;
    return (
      <InlineNotice
        tone="info"
        data-testid="group-close-suggestion"
        footer={closeButton(groupId, t(again ? 'groupCompletion.button.again' : 'groupCompletion.button.close'), groupId === primaryGroup)}
      >
        <span style={title}>{t(again ? 'groupCompletion.banner.reopenedTitle' : 'groupCompletion.banner.title', withGroup(name))}</span>
        {again && reopened?.reason !== undefined ? (
          <p style={line} data-testid="group-reopened-by">
            {reopened.name !== undefined
              ? t('groupCompletion.banner.reopenedBy', { name: reopened.name, time: timeText(reopened.at, i18n.language), reason: reopened.reason })
              : t('groupCompletion.banner.reopenedByUnknown', { reason: reopened.reason })}
          </p>
        ) : null}
        <p style={line}>
          {again
            ? t('groupCompletion.banner.reopenedBody', withGroup(name))
            : t(name !== undefined && !hasFinals ? 'groupCompletion.banner.bodyNoFinals' : 'groupCompletion.banner.body', withGroup(name, { count }))}
        </p>
      </InlineNotice>
    );
  };

  return (
    <div style={stack} data-testid="group-completion-banner">
      {suggestion()}
      {staleGroups.map((groupId) => {
        const name = nameOf(groupId);
        return (
          <InlineNotice
            key={groupId}
            tone="warn"
            data-testid={`group-stale-${groupTestId(groupId)}`}
            footer={closeButton(groupId, t('groupCompletion.button.again'), groupId === primaryGroup)}
          >
            <span style={title}>{t('groupCompletion.stale.title', withGroup(name))}</span>
            <p style={line}>{t('groupCompletion.stale.body', withGroup(name))}</p>
          </InlineNotice>
        );
      })}
    </div>
  );
};
