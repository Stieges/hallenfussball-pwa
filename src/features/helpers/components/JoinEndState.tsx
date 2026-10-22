/**
 * Endzustände der Helfer-Seite (A-17b, Mockup M2, Tabelle § 3.2): eine Aussage, eine Taste. Die Zuordnung Server → Anzeige
 * steht in `END_STATES` (Ansicht → Ton, Symbol, Text, Taste); `JoinEndState` rendert nur. „Zur Startseite“ bleibt auf allen
 * Endzuständen (Entscheid Daniel 21.10.). Ohne Netz (`offline`) und die Weiterleitung `openField` sind keine Karten.
 */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/Button';
import { Icons } from '../../../components/ui/Icons';
import { MatchIcons } from '../../../components/ui/IconsMatch';
import { TafelIcons } from '../../../components/ui/IconsTafel';
import { EndStateCard, type EndStateTone } from '../../../components/ui/molecules/EndStateCard';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import type { HelperAccessView } from '../../../core/repositories/helperAccessRpc';
import type { JoinTournament } from '../joinFlow';
import { helperSchedulePath, helperStandingsPath, helperTournamentPath } from '../joinPaths';
import { JoinNotice } from './JoinNotice';

/** Zusätzlicher Satz oder Zielseite, die nicht jede Karte hat. */
type EndKey =
  | 'invalidCode' | 'codeRotated' | 'codeExpired' | 'tournamentClosed' | 'declined' | 'requestExpired' | 'noAccess'
  | 'watchOnly' | 'finalStandings' | 'noRequest' | 'busy' | 'retryScan' | 'unexpected' | 'oldInvite';

type TextKey = `join.end.${Exclude<EndKey, 'tournamentClosed' | 'busy' | 'oldInvite'>}.text`;

interface EndSpec {
  tone: EndStateTone;
  icon: ReactNode;
  text: TextKey | null;
  hint?: boolean;
}

const ICON = iconSizeValues.md;
const END_STATES: Record<EndKey, EndSpec> = {
  invalidCode: { tone: 'error', icon: <Icons.X size={ICON} />, text: 'join.end.invalidCode.text' },
  codeRotated: { tone: 'neutral', icon: <Icons.Refresh size={ICON} />, text: 'join.end.codeRotated.text' },
  codeExpired: { tone: 'neutral', icon: <Icons.Calendar size={ICON} />, text: 'join.end.codeExpired.text' },
  tournamentClosed: { tone: 'neutral', icon: <TafelIcons.Lock size={ICON} />, text: null },
  declined: { tone: 'error', icon: <Icons.X size={ICON} />, text: 'join.end.declined.text', hint: true },
  requestExpired: { tone: 'neutral', icon: <Icons.Calendar size={ICON} />, text: 'join.end.requestExpired.text' },
  noAccess: { tone: 'error', icon: <TafelIcons.Lock size={ICON} />, text: 'join.end.noAccess.text' },
  watchOnly: { tone: 'info', icon: <Icons.Eye size={ICON} />, text: 'join.end.watchOnly.text' },
  finalStandings: { tone: 'neutral', icon: <MatchIcons.Flag size={ICON} />, text: 'join.end.finalStandings.text' },
  noRequest: { tone: 'info', icon: <Icons.Info size={ICON} />, text: 'join.end.noRequest.text' },
  busy: { tone: 'warn', icon: <Icons.Users size={ICON} />, text: null },
  retryScan: { tone: 'warn', icon: <Icons.AlertTriangle size={ICON} />, text: 'join.end.retryScan.text' },
  unexpected: { tone: 'warn', icon: <Icons.AlertTriangle size={ICON} />, text: 'join.end.unexpected.text' },
  oldInvite: { tone: 'info', icon: <Icons.ExternalLink size={ICON} />, text: null },
};

/** Ansicht → Karte. Alles, was nur die Leitung sieht oder was keine Karte ist, fällt auf „unexpected“. */
function endKeyForView(view: HelperAccessView): EndKey {
  switch (view.view) {
    case 'invalidCode': case 'codeRotated': case 'codeExpired': case 'tournamentClosed': case 'declined':
    case 'requestExpired': case 'noAccess': case 'watchOnly': case 'finalStandings': case 'noRequest': case 'busy': case 'retryScan':
      return view.view;
    default:
      return 'unexpected';
  }
}

export interface JoinEndStateProps {
  view: HelperAccessView | { view: 'oldInvite' };
  tournament?: JoinTournament | null;
  /** Anzeigename eines angemeldeten Kontos (nur für „Du bleibst als … angemeldet“). */
  accountName?: string | null;
  onNavigate: (path: string) => void;
  onHome: () => void;
  onRecheck: () => void;
}

const bigButton = { minHeight: cssVars.touchTargets.primary, fontSize: cssVars.fontSizes.lg } as const;

export const JoinEndState = ({ view, tournament, accountName, onNavigate, onHome, onRecheck }: JoinEndStateProps) => {
  const { t } = useTranslation('helpers');
  if (view.view === 'offline') {
    return (
      <>
        <JoinNotice tone="warn" icon={<Icons.WifiOff size={iconSizeValues.sm} />} title={t('join.end.offline.title')} text={t('join.end.offline.text')} data-testid="join-offline" />
        {accountName ? <p data-testid="join-offline-account" style={{ margin: 0, fontWeight: cssVars.fontWeights.semibold }}>{t('join.end.offline.stayAccount', { name: accountName })}</p> : null}
        <Button variant="primary" fullWidth onClick={onRecheck} icon={<Icons.Refresh size={iconSizeValues.sm} />} style={bigButton} data-primary data-testid="join-retry">{t('join.retry')}</Button>
      </>
    );
  }
  if (view.view === 'leader') {
    const open = tournament ? t('join.leader.open', { title: tournament.title }) : t('join.leader.openNoTitle');
    return (
      <>
        <JoinNotice
          tone="info"
          icon={<Icons.Check size={iconSizeValues.sm} />}
          title={t('join.leader.title')}
          text={accountName ? t('join.leader.text', { name: accountName }) : t('join.leader.textNoName')}
          data-testid="join-leader"
        />
        <Button variant="primary" fullWidth onClick={() => onNavigate(helperTournamentPath(view.tournamentId))} style={bigButton} data-primary data-testid="join-open-tournament">{open}</Button>
      </>
    );
  }
  const key = view.view === 'oldInvite' ? 'oldInvite' : endKeyForView(view);
  const spec = END_STATES[key];
  const ownAction: { label: string; path: string; testId: string } | null =
    view.view === 'watchOnly' ? { label: t('join.end.watchOnly.open'), path: helperSchedulePath(view.tournamentId), testId: 'helper-viewer-open' }
      : view.view === 'finalStandings' ? { label: t('join.end.finalStandings.open'), path: helperStandingsPath(view.tournamentId), testId: 'helper-final-open' }
        : null;
  return (
    <EndStateCard
      tone={spec.tone}
      icon={spec.icon}
      title={t(`join.end.${key}.title`)}
      text={spec.text ? t(spec.text) : undefined}
      extra={spec.hint ? <p style={{ margin: 0, color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.xs }}>{t(view.view === 'declined' && view.codeOpen ? 'join.end.declined.hint' : 'join.end.declined.hintRotated')}</p> : undefined}
      action={ownAction ? (
        <Button variant="primary" fullWidth onClick={() => onNavigate(ownAction.path)} style={bigButton} data-primary data-testid={ownAction.testId}>{ownAction.label}</Button>
      ) : (
        <Button variant="primary" fullWidth onClick={onHome} style={bigButton} data-primary data-testid="join-home">{t('join.home')}</Button>
      )}
      data-testid="join-end-state"
    />
  );
};
