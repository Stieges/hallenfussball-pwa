/**
 * useLeibchenKarte – verbindet die Leibchen-Karte (`LeibchenKarte`) mit dem Turnier und der Warteschlange der Wahl (Leibchen 2b-2).
 *
 * - Ziel der Karte: im Cockpit vor dem Anpfiff das Spiel selbst (@SL-206), im Endstand (`abgepfiffen`) das nächste Spiel des Felds (@SL-215); im
 *   laufenden Spiel erscheint keine Karte (@SL-215), ein ausgefallenes Spiel weder Karte noch Zeile (@SL-232).
 * - Ohne Farbgleichheit keine Karte, nur die kleine Taste „Leibchen festlegen“ (@SL-138, @SL-148), im Endstand gar nichts.
 * - Die Wahl geht über `useKitChoices().choose` (Warteschlange, `match_kit_set`, mit der Epoche der Feldsteuerung, @SL-202); „wird gesendet“ und
 *   „gesendet“ stammen aus dem Eintrag (@SL-230). Abweisungen und fremde Änderungen werden als Meldungen der Meldezeile gezeigt (@SL-228, @SL-229).
 */
import { useEffect, useMemo } from 'react';
import { useKitChoices } from '../../../hooks/useKitChoices';
import { bibRuleOf, hallenFarbenOf, type KitSide } from '../../../core/models/kit';
import { karteNoetig, kitProposal, type KitProposal } from '../../../core/models/kitProposal';
import { trikotFarben, type TrikotFarben } from '../../../core/models/kitChoice';
import { slotTeamId } from '../../../core/models/matchSlot';
import { nextMatchOnField } from '../../../core/models/nextMatch';
import type { LeibchenAuswahl } from '../../ui/molecules/LeibchenKarte';
import type { KitChoiceNotice } from '../../../core/match/client/kitChoiceQueue';
import type { Match, Tournament } from '../../../types/tournament';
import type { CockpitZustand } from '../model/cockpitPhase';

export interface LeibchenKarteDaten {
  matchId: string;
  teams: { a: string; b: string };
  trikot: TrikotFarben;
  hallenFarben: string[];
  gewaehlt: LeibchenAuswahl | null;
  vorschlag: KitProposal;
  nurFestlegen: boolean;
  senden: 'pending' | 'sent' | null;
  onBestaetigen: (seite: KitSide, farbe: string) => void;
  onKeine: () => void;
}

export interface LeibchenKarteArgs {
  tournament: Tournament | undefined;
  matchId: string | undefined;
  zustand: CockpitZustand;
  /** Meldezeile des Cockpits (Stufe, Text). */
  melde: (stufe: 1 | 2 | 3, text: string) => void;
  /** Texte der Meldungen (i18n, `cockpit:leibchenKarte.meldung.*`). */
  meldungText: (notice: KitChoiceNotice) => string;
  epoche?: number | null | undefined;
}

const teamName = (t: Tournament, slot: Match['slotA']): string | null => {
  const id = slotTeamId(slot);
  return id === undefined ? null : t.teams.find((team) => team.id === id)?.name ?? null;
};

export function leibchenZiel(tournament: Tournament | undefined, matchId: string | undefined, zustand: CockpitZustand): Match | null {
  if (tournament === undefined || matchId === undefined) { return null; }
  const aktuell = tournament.matches.find((m) => m.id === matchId);
  if (aktuell === undefined) { return null; }
  const ziel = zustand === 'vorAnpfiff' ? aktuell : zustand === 'abgepfiffen' ? nextMatchOnField(tournament.matches, aktuell.field) : undefined;
  if (ziel === undefined || ziel.id === aktuell.id && zustand === 'abgepfiffen') { return null; }
  return ziel.matchStatus === 'skipped' ? null : ziel;
}

export function useLeibchenKarte({ tournament, matchId, zustand, melde, meldungText, epoche }: LeibchenKarteArgs): LeibchenKarteDaten | null {
  const { entries, notices, choose, dismissNotice } = useKitChoices();
  const ziel = useMemo(() => leibchenZiel(tournament, matchId, zustand), [tournament, matchId, zustand]);

  // Meldungen zu diesem Ziel: einmal in die Meldezeile, dann aus der Warteschlange nehmen
  useEffect(() => {
    if (ziel === null) { return; }
    for (const notice of notices.filter((n) => n.matchId === ziel.id)) {
      melde(2, meldungText(notice));
      dismissNotice(notice.id);
    }
  }, [notices, ziel, melde, meldungText, dismissNotice]);

  return useMemo(() => {
    if (ziel === null || tournament === undefined) { return null; }
    const a = teamName(tournament, ziel.slotA);
    const b = teamName(tournament, ziel.slotB);
    if (a === null || b === null) { return null; } // Teams noch offen: keine Karte (@SL-215)
    const trikot = trikotFarben(ziel, tournament.teams);
    const seite = ziel.kit?.bibSide;
    const farbe = seite === undefined ? undefined : ziel.kit?.[seite];
    const gewaehlt: LeibchenAuswahl | null = ziel.kitDecision === 'bib' && seite !== undefined && farbe !== undefined
      ? { art: 'bestaetigt', seite, farbe }
      : ziel.kitDecision === 'none' ? { art: 'keine' } : null;
    const noetig = karteNoetig(trikot);
    if (zustand === 'abgepfiffen' && !noetig && gewaehlt === null) { return null; } // im Endstand kein Leibchen-Teil (@SL-215)
    const eintrag = entries.find((e) => e.matchId === ziel.id);
    const hallenFarben = hallenFarbenOf(tournament);
    return {
      matchId: ziel.id, teams: { a, b }, trikot, hallenFarben, gewaehlt,
      vorschlag: kitProposal(trikot, hallenFarben, bibRuleOf(tournament)),
      nurFestlegen: !noetig, senden: eintrag?.status ?? null,
      onBestaetigen: (s, f) => { choose({ matchId: ziel.id, decision: 'bib', bibSide: s, bibColor: f, controlEpoch: epoche }, tournament); },
      onKeine: () => { choose({ matchId: ziel.id, decision: 'none', controlEpoch: epoche }, tournament); },
    };
  }, [ziel, tournament, zustand, entries, choose, epoche]);
}
