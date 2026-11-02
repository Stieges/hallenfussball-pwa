/**
 * useMatchActionMenu (@SL-193): die EINE Tippfläche je Spiel im Spielplan der Turnierleitung. Der Tipp öffnet eine Auswahl mit
 * beschrifteten Aktionen – in Gruppenphase und Finalrunde gleich. Welche Aktionen gelten, steht rein in `matchActionsFor`; hier
 * stehen nur Zustand, Beschriftung und die Verdrahtung mit den vorhandenen Wegen:
 * - Ergebnis eintragen / Spiel beenden und Ergebnis eintragen: `onEnterResult` der Ansicht (Eintrage-Weg, @FU-112)
 * - Im Cockpit anpfeifen / Zum Cockpit: `onNavigateToCockpit` (Rückfrage beim Wechsel @SL-194 liegt im Spielplan-Reiter)
 * - Ab hier verschieben: Dialog der Zeitverschiebung (über `MatchTimeShiftContext`)
 * - Schiedsrichter / Feld ändern: Auswahl direkt am Spiel (`MatchChoiceDialog`)
 * - Nicht angetreten / Wertung zurücknehmen: `forfeit`
 * - Ergebnis korrigieren: `onCorrect` – derselbe Dialog wie im Cockpit (@EK-063)
 * - Protokoll ansehen: `MatchProtocolSheet` (@FU-080, @FU-082)
 * Ohne `rights` ist die Auswahl aus (Zuschauer, Vorschau): `open` tut nichts.
 */
import { useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ScheduledMatch } from '../../../core/generators';
import type { LiveMatch } from '../../live-cockpit/types';
import { ActionSheet, type ActionSheetItem } from '../../ui/molecules/ActionSheet';
import { MatchTimeShiftContext } from '../matchTimeShiftContext';
import type { MatchForfeitActions } from '../MatchForfeitAction';
import { matchViewOf, sideDisplay, type SideContext } from '../matchSides';
import type { RefereeChoice } from '../refereeChoices';
import { MatchChoiceDialog, type MatchChoiceKind } from './MatchChoiceDialog';
import { MatchProtocolSheet } from './MatchProtocolSheet';
import { useOptionalToast } from '../../ui/Toast';
import { actionPhaseOf, matchActionsFor, NEEDS_BOTH_TEAMS, type MatchActionId, type MatchActionRights } from './matchActions';

export interface UseMatchActionMenuArgs {
  /** Rechte (`useCan`); fehlt = Auswahl aus */
  rights: MatchActionRights | undefined;
  /** Live-Daten des Spielplans (schon abonniert); das Protokoll liest daraus */
  liveMatches: ReadonlyMap<string, LiveMatch>;
  matches: readonly ScheduledMatch[];
  sides: SideContext;
  numberOfFields: number;
  refereeChoices: readonly RefereeChoice[];
  /** Die Ansicht trägt das Ergebnis ein (Schnelleingabe bzw. das Eingabefeld der Zeile) */
  onEnterResult?: (matchId: string) => void;
  onNavigateToCockpit?: (matchId: string) => void;
  onCorrect?: (matchId: string) => void;
  onRefereeChange?: (matchId: string, refereeNumber: number | null) => void;
  onFieldChange?: (matchId: string, fieldNumber: number) => void;
  forfeit?: MatchForfeitActions;
}

export interface MatchActionMenu {
  enabled: boolean;
  /** Öffnet die Auswahl des Spiels; ohne Aktion (kein Recht) geschieht nichts */
  open: (matchId: string) => void;
  /** Auswahl und ihre Folge-Fenster; in die Ansicht einhängen */
  element: ReactNode;
}

type Follow = { kind: MatchChoiceKind | 'protocol'; matchId: string } | null;

export function useMatchActionMenu(args: UseMatchActionMenuArgs): MatchActionMenu {
  const { rights, liveMatches, matches, sides, numberOfFields, refereeChoices, onEnterResult, onNavigateToCockpit, onCorrect, onRefereeChange, onFieldChange, forfeit } = args;
  const { t } = useTranslation('tournament');
  const shiftFrom = useContext(MatchTimeShiftContext)?.shiftFrom;
  const [openId, setOpenId] = useState<string | null>(null);
  const [follow, setFollow] = useState<Follow>(null);

  const matchOf = useCallback((id: string) => matches.find((m) => m.id === id), [matches]);
  const actionsOf = useCallback((id: string): MatchActionId[] => {
    if (!rights) { return []; }
    return matchActionsFor({
      status: matchViewOf(sides, id)?.status,
      rights,
      wired: {
        enterResult: onEnterResult !== undefined,
        cockpit: onNavigateToCockpit !== undefined,
        shiftFrom: shiftFrom !== undefined,
        referee: onRefereeChange !== undefined && refereeChoices.length > 0,
        field: onFieldChange !== undefined && numberOfFields > 1,
        forfeit: forfeit !== undefined,
        correct: onCorrect !== undefined,
        endAndEnter: onEnterResult !== undefined,
      },
    });
  }, [rights, sides, onEnterResult, onNavigateToCockpit, shiftFrom, onRefereeChange, refereeChoices.length, onFieldChange, numberOfFields, forfeit, onCorrect]);

  // @SL-193: ein Helfer ohne Aktion bei einem gewerteten oder abgesetzten Spiel bekommt einen kurzen Hinweis statt einer leeren Auswahl
  const toast = useOptionalToast();
  const open = useCallback((id: string) => {
    if (actionsOf(id).length > 0) { setOpenId(id); return; }
    const phase = actionPhaseOf(matchViewOf(sides, id)?.status);
    if (rights && (phase === 'awarded' || phase === 'cancelled')) { toast?.showInfo(t(`actionMenu.noAction.${phase}`)); }
  }, [actionsOf, sides, rights, toast, t]);
  const close = useCallback(() => { setOpenId(null); }, []);

  const run = useCallback((action: MatchActionId, id: string) => {
    setOpenId(null);
    switch (action) {
      case 'enterResult':
      case 'endAndEnter': onEnterResult?.(id); break;
      case 'kickOff':
      case 'toCockpit': onNavigateToCockpit?.(id); break;
      case 'shiftFrom': shiftFrom?.(id); break;
      case 'changeReferee': setFollow({ kind: 'referee', matchId: id }); break;
      case 'changeField': setFollow({ kind: 'field', matchId: id }); break;
      case 'forfeit': forfeit?.mark(id); break;
      case 'revokeForfeit': forfeit?.revoke(id); break;
      case 'correct': onCorrect?.(id); break;
      case 'protocol': setFollow({ kind: 'protocol', matchId: id }); break;
    }
  }, [onEnterResult, onNavigateToCockpit, shiftFrom, forfeit, onCorrect]);

  const element = useMemo<ReactNode>(() => {
    const sheetMatch = openId === null ? undefined : matchOf(openId);
    const followMatch = follow === null ? undefined : matchOf(follow.matchId);
    const number = (m: ScheduledMatch | undefined) => m?.matchNumber ?? '?';
    return (
      <>
        {openId !== null && sheetMatch !== undefined && (
          <ActionSheet
            isOpen
            onClose={close}
            title={t('actionMenu.title', { number: number(sheetMatch) })}
            subtitle={t('actionMenu.pairing', { home: sideDisplay(sheetMatch, 'A', sides).name, away: sideDisplay(sheetMatch, 'B', sides).name })}
            closeLabel={t('actionMenu.close')}
            testId="match-action-menu"
            items={actionsOf(openId).map<ActionSheetItem>((action) => {
              const missing = NEEDS_BOTH_TEAMS.has(action) && (sideDisplay(sheetMatch, 'A', sides).pending || sideDisplay(sheetMatch, 'B', sides).pending);
              return {
                id: action,
                label: t(`actionMenu.actions.${action}`),
                disabled: missing,
                reason: missing ? t('actionMenu.teamsMissing') : undefined,
                testId: `match-action-${action}`,
                onSelect: () => { run(action, openId); },
              };
            })}
          />
        )}
        {follow?.kind === 'referee' && followMatch !== undefined && (
          <MatchChoiceDialog
            kind="referee"
            matchNumber={followMatch.matchNumber}
            current={followMatch.referee === undefined || followMatch.referee === null ? '' : String(followMatch.referee)}
            options={[{ value: '', label: t('matchCard.noReferee') }, ...refereeChoices.map((c) => ({ value: String(c.value), label: c.label }))]}
            onClose={() => { setFollow(null); }}
            onApply={(value) => { setFollow(null); onRefereeChange?.(follow.matchId, value === '' ? null : Number(value)); }}
          />
        )}
        {follow?.kind === 'field' && followMatch !== undefined && (
          <MatchChoiceDialog
            kind="field"
            matchNumber={followMatch.matchNumber}
            current={String(followMatch.field)}
            options={Array.from({ length: numberOfFields }, (_, i) => ({ value: String(i + 1), label: t('matchCard.field', { field: i + 1 }) }))}
            onClose={() => { setFollow(null); }}
            onApply={(value) => { setFollow(null); onFieldChange?.(follow.matchId, Number(value)); }}
          />
        )}
        {follow?.kind === 'protocol' && followMatch !== undefined && (
          <MatchProtocolSheet
            liveMatches={liveMatches}
            matchId={follow.matchId}
            home={sideDisplay(followMatch, 'A', sides)}
            away={sideDisplay(followMatch, 'B', sides)}
            onClose={() => { setFollow(null); }}
          />
        )}
      </>
    );
  }, [openId, follow, matchOf, close, t, sides, actionsOf, run, refereeChoices, numberOfFields, onRefereeChange, onFieldChange, liveMatches]);

  return { enabled: rights !== undefined, open, element };
}
