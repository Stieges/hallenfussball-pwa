/**
 * useEntryFlows – die Eintrags-Abläufe des Cockpits (Spec § 4.3, § 5.1, § 5.2).
 *
 * Stufe 2 (Aufgabe 3.4): Das Tor zählt schon mit dem ersten Tipp (@SL-019, @SL-083); die Rückennummer kommt danach als
 * Nachtrag an DASSELBE Tor (Ereignis-ID aus dem ersten Tipp, RF3), auch wenn sie erst nach dem Speichern oder gar nicht
 * gewählt wird (@SL-020). Ein zweiter Tipp im selben Durchlauf zählt kein zweites Tor (Wache per `useRef`, RF1, @SL-021).
 * Eigentor: das gezählte Tor wird zurückgenommen und als OWN_GOAL des Gegners mit der Spielzeit des ersten Tipps neu erfasst
 * (@SL-022, @SL-084). Reset NUR an der Spiel-ID (C1, RC13/PC20).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { NumberPickerSchliessGrund } from '../../ui/molecules/NumberPicker';
import type { CockpitZustand } from '../model/cockpitPhase';
import type { CardKind, OffenerEintrag, Side, Uebersetzer } from '../model/cockpitTypes';
import type { NoticeStufe } from './useCockpitNotices';

export interface EntryCommands {
  tor: (teamId: string) => Promise<string | null>;
  nummer: (eventId: string, nummer: number) => Promise<void>;
  eigentor: (args: { torEventId: string; gegnerTeamId: string; clockMs: number }) => Promise<string | null>;
  foul: (teamId: string) => Promise<void>;
  karte: (teamId: string, art: CardKind, args: { nummer: number | null; clockMs: number }) => Promise<void>;
  zeitstrafe: (teamId: string, args: { nummer: number | null; clockMs: number }) => Promise<void>;
}

interface TeamRef { id: string; name: string }

export interface EntryFlowsParams {
  matchId: string | undefined;
  teams: { home: TeamRef; away: TeamRef };
  commands: EntryCommands;
  /** Spielzeit dieses Moments in ms (Engine-Serverzeit). */
  spielzeitJetzt: () => number;
  zustand: CockpitZustand;
  melde: (stufe: NoticeStufe, text: string) => void;
  t: Uebersetzer;
  /** Hat die Nummer in diesem Spiel schon eine Gelbe Karte (Aufgabe 3.5, @SL-088)? */
  hatSchonGelb: (teamId: string, nummer: number) => boolean;
}

export interface UseEntryFlowsReturn {
  offen: OffenerEintrag | null;
  oeffne: (eintrag: OffenerEintrag) => void;
  schliesse: () => void;
  tippeTor: (seite: Side) => void;
  waehleNummer: (nummer: number) => Promise<void>;
  schliesseAuswahl: (grund: NumberPickerSchliessGrund) => Promise<void>;
  waehleEigentor: () => Promise<void>;
}

interface LaufendesTor { id: Promise<string | null>; seite: Side; ersterTippMs: number }

export function useEntryFlows(p: EntryFlowsParams): UseEntryFlowsReturn {
  const [offen, setOffen] = useState<OffenerEintrag | null>(null);
  const wache = useRef(false); // RF1: synchron, nicht State
  const eigentorWache = useRef(false);
  const torRef = useRef<LaufendesTor | null>(null);
  const commandsRef = useRef(p.commands); // immer die jüngsten commands (keine veraltete Closure)
  commandsRef.current = p.commands;
  const paramsRef = useRef(p);
  paramsRef.current = p;

  const reset = useCallback(() => {
    wache.current = false;
    eigentorWache.current = false;
    torRef.current = null;
    setOffen(null);
  }, []);
  const matchId = p.matchId;
  useEffect(() => { reset(); }, [matchId, reset]);

  const tippeTor = useCallback((seite: Side) => {
    if (wache.current) { return; }
    wache.current = true;
    const { teams, spielzeitJetzt, melde, t } = paramsRef.current;
    const team = seite === 'home' ? teams.home : teams.away;
    const ersterTippMs = spielzeitJetzt();
    torRef.current = { id: Promise.resolve(commandsRef.current.tor(team.id)).catch(() => null), seite, ersterTippMs };
    setOffen({ art: 'tor', seite, ersterTippMs });
    melde(3, t('meldung.tor', { team: team.name }));
  }, []);

  const waehleEigentor = useCallback(async () => {
    const tor = torRef.current;
    if (!tor || eigentorWache.current) { return; }
    eigentorWache.current = true;
    const torEventId = await tor.id;
    if (!torEventId) { eigentorWache.current = false; return; }
    const { teams } = paramsRef.current;
    const gegner = tor.seite === 'home' ? teams.away : teams.home;
    const eigentorId = Promise.resolve(commandsRef.current.eigentor({ torEventId, gegnerTeamId: gegner.id, clockMs: tor.ersterTippMs })).catch(() => null);
    torRef.current = { ...tor, id: eigentorId };
    setOffen((o) => (o ? { ...o, eigentor: true } : o));
  }, []);

  const waehleNummer = useCallback(async (nummer: number) => {
    const tor = torRef.current;
    if (tor) {
      reset();
      const id = await tor.id;
      if (id) { await commandsRef.current.nummer(id, nummer); }
    }
    // Karte, Zeitstrafe und Nummer aus der Liste: Aufgabe 3.5 bzw. 4.1
  }, [reset]);

  const schliesseAuswahl = useCallback(async (_grund: NumberPickerSchliessGrund) => { reset(); }, [reset]);

  return { offen, oeffne: setOffen, schliesse: reset, tippeTor, waehleNummer, schliesseAuswahl, waehleEigentor };
}
