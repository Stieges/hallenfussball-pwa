/**
 * Anzeige der beiden Spielseiten im Spielplan (A-04a, @TM-015; A-36c: aus der gemeinsamen Ansicht).
 *
 * Eine Funktion für alle Spielplan-Karten: Mit einer Ansicht (`SideSource.view`) kommt der Text aus `MatchView`
 * (Zuschauer-Seite, Verwaltung); ohne Ansicht (Spielplan-Editor, Vorschau) berechnet `sideView` aus `core/view` ihn
 * mit den Regeln der Leitung. Ein im Spiel gespeicherter Anzeigetext (`ScheduledMatch.homeTeam/awayTeam`) wird nie gelesen –
 * nach dem Umbenennen eines Teams zeigt der Spielplan sofort den neuen Namen.
 */
import i18next from 'i18next';
import { sideView, type MatchView, type SideView, type TournamentView, type ViewLocale } from '../../core/view';
import { matchLabelText, type SlotLabelMatch } from '../../core/view/originText';
import { slotTeamId } from '../../core/models/matchSlot';
import type { ScheduledMatch } from '../../core/generators';
import type { Team, TournamentGroup } from '../../types/tournament';
import type { TeamForDisplay } from '../../utils/teamHelpers';

type SideTeam = Pick<Team, 'id' | 'name'> & Partial<Pick<Team, 'logo' | 'colors'>>;

/** Alles, was die Anzeige einer Spielseite braucht. */
export interface SideContext {
  teams: readonly SideTeam[];
  matches: readonly SlotLabelMatch[];
  groups?: readonly TournamentGroup[];
  /** Die gemeinsame Ansicht (Status, Seiten, Endstand, Regeln); ohne sie gilt die Sicht der Leitung. */
  view?: TournamentView;
  /** Sprache der Seitentexte; ohne Angabe die Sprache der App */
  locale?: ViewLocale;
}

export interface SideDisplay extends TeamForDisplay {
  /** Die Seite ist noch nicht besetzt (zeigt ihre Herkunft). */
  pending: boolean;
}

type SideMatch = Pick<ScheduledMatch, 'id' | 'slotA' | 'slotB' | 'originA' | 'originB' | 'isFinal'>;

/** Quelle der Anzeige-Daten: ein `Tournament` oder ein Teil davon (z. B. der Stand-in in `ScheduleDisplay`). */
export interface SideSource {
  teams?: readonly SideTeam[];
  groups?: readonly TournamentGroup[];
  matches?: readonly SlotLabelMatch[];
  view?: TournamentView;
  /** Sprache der Seitentexte; ohne Angabe die Sprache der App (Verwaltung). */
  locale?: ViewLocale;
}

/** Sprache der App, wenn die Oberfläche keine eigene festlegt (Verwaltung folgt der App-Sprache). */
function appLocale(): ViewLocale {
  return (i18next.language ?? 'de').startsWith('en') ? 'en' : 'de';
}

/** Kontext aus dem Turnier und den angezeigten Spielen (Vorgängerspiele stehen oft nur im Angezeigten). */
export function buildSideContext(
  tournament: SideSource | undefined,
  shownMatches: readonly SlotLabelMatch[] = [],
): SideContext {
  const known = new Set(shownMatches.map((match) => match.id));
  const persisted = (tournament?.matches ?? []).filter((match) => !known.has(match.id));
  return {
    teams: tournament?.teams ?? [],
    matches: [...shownMatches, ...persisted],
    groups: tournament?.groups,
    ...(tournament?.view === undefined ? {} : { view: tournament.view }),
    ...(tournament?.locale === undefined ? {} : { locale: tournament.locale }),
  };
}

/** Die Ansicht eines Spiels (Status, Endstand, Bezeichnung); `undefined` ohne Ansicht. */
export function matchViewOf(ctx: Pick<SideContext, 'view'>, matchId: string): MatchView | undefined {
  return ctx.view?.byId.get(matchId);
}

function sideOf(match: SideMatch, side: 'A' | 'B', ctx: SideContext): SideView {
  const fromView = matchViewOf(ctx, match.id);
  if (fromView !== undefined) {
    return side === 'A' ? fromView.home : fromView.away;
  }
  const locale = ctx.locale ?? appLocale();
  return sideView(match, side, {
    audience: 'organizer',
    labels: { teams: ctx.teams, matches: ctx.matches, groups: ctx.groups, locale },
    locale,
    // Kennt die Ansicht das Spiel nicht, gelten trotzdem ihre Regeln (kein Gruppenrang für Zuschauer, @ZM-102);
    // ohne Ansicht gilt die Sicht der Leitung.
    rules: { groupOrigin: ctx.view?.rules.groupOrigin ?? true },
    edition: 'plan',
  });
}

/** Anzeige einer Seite (`'A'` = Heim). Ein gespeicherter Anzeigename wird nie gelesen. */
export function sideDisplay(match: SideMatch, side: 'A' | 'B', ctx: SideContext): SideDisplay {
  const slot = side === 'A' ? match.slotA : match.slotB;
  const teamId = slotTeamId(slot);
  const team = teamId === undefined ? undefined : ctx.teams.find((candidate) => candidate.id === teamId);
  return {
    id: teamId ?? `${match.id}:${side}`,
    name: sideOf(match, side, ctx).label,
    logo: team?.logo,
    colors: team?.colors,
    pending: teamId === undefined,
  };
}

/** Nur der Text einer Seite. */
export function sideName(match: SideMatch, side: 'A' | 'B', ctx: SideContext): string {
  return sideDisplay(match, side, ctx).name;
}

/** Bezeichnung des Spiels (Halbfinale 1, Finale …) aus der Ansicht; ohne Ansicht aus der gespeicherten Bezeichnung. */
export function matchHeading(match: Pick<ScheduledMatch, 'id' | 'label'>, ctx: SideContext): string | undefined {
  const fromView = matchViewOf(ctx, match.id)?.labelText;
  if (fromView !== undefined) {
    return fromView;
  }
  return match.label === undefined ? undefined : matchLabelText(match.label, ctx.locale ?? appLocale());
}
