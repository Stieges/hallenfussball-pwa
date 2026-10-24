/**
 * useEntryFlows – die Eintrags-Abläufe des Cockpits (Spec § 4.3, § 5.1, § 5.2).
 *
 * Stufe 2 (Aufgabe 3.4): Das Tor zählt schon mit dem ersten Tipp (@SL-019, @SL-083); die Rückennummer kommt danach als
 * Nachtrag an DASSELBE Tor (Ereignis-ID aus dem ersten Tipp, RF3), auch wenn sie erst nach dem Speichern oder gar nicht
 * gewählt wird (@SL-020). Ein zweiter Tipp im selben Durchlauf zählt kein zweites Tor (Wache per `useRef`, RF1, @SL-021).
 * Eigentor: das gezählte Tor wird zurückgenommen und als OWN_GOAL des Gegners mit der Spielzeit des ersten Tipps neu erfasst
 * (@SL-022, @SL-084). Reset NUR an der Spiel-ID (C1, RC13/PC20).
 *
 * Aufgabe 3.5: Foul zählt mit einem Tipp. Karte (Art, dann Nummer) und Zeitstrafe (Nummer) tragen die Spielzeit des ersten
 * Tipps (@SL-084); die Zeitstrafe wählt keine Dauer (@SL-029). Eine zweite Gelbe für dieselbe Nummer fragt vorher nach
 * (@SL-088). Wechselt der Zustand bei offener Karten- oder Zeitstrafen-Auswahl in einen, der sie nicht erlaubt (Abpfiff),
 * schließt die Auswahl ohne Befehl und die Meldezeile sagt es (RF5); eine offene Tor-Auswahl bleibt (@SL-113).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { NumberPickerSchliessGrund } from '../../ui/molecules/NumberPicker';
import type { CockpitZustand } from '../model/cockpitPhase';
import { AKTION_ZEITSTRAFE, darfImZustand } from '../model/darf';
import { EINTRAG_ZEITSTRAFE, type CardKind, type OffenerEintrag, type Side, type Uebersetzer } from '../model/cockpitTypes';
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
  /** `perTaste`: per Tastenkürzel geöffnet → Nummernauswahl im Tastatur-Modus (@SL-153, auch ohne feinen Zeiger). */
  tippeTor: (seite: Side, optionen?: { perTaste?: boolean }) => void;
  waehleNummer: (nummer: number) => Promise<void>;
  schliesseAuswahl: (grund: NumberPickerSchliessGrund) => Promise<void>;
  waehleEigentor: () => Promise<void>;
  tippeFoul: (seite: Side) => void;
  tippeZeitstrafe: (seite: Side) => void;
  tippeKarte: (seite: Side) => void;
  waehleKartenArt: (art: CardKind) => void;
  /** Offene Rückfrage „Nr. 7 hat schon Gelb“ (@SL-088), sonst `null`. */
  rueckfrageZweiteGelbe: { nummer: number } | null;
  antworteZweiteGelbe: (wahl: 'gelbRot' | 'trotzdemGelb') => Promise<void>;
}

const MELDUNG_KARTE: Record<CardKind, string> = { YELLOW: 'meldung.karteGelb', YELLOW_RED: 'meldung.karteGelbRot', RED: 'meldung.karteRot' };

interface LaufendesTor { id: Promise<string | null>; seite: Side; ersterTippMs: number }

export function useEntryFlows(p: EntryFlowsParams): UseEntryFlowsReturn {
  const [offen, setOffen] = useState<OffenerEintrag | null>(null);
  const [rueckfrage, setRueckfrage] = useState<{ nummer: number } | null>(null);
  const wache = useRef(false); // RF1: synchron, nicht State
  const eigentorWache = useRef(false);
  const torRef = useRef<LaufendesTor | null>(null);
  const commandsRef = useRef(p.commands); // immer die jüngsten commands (keine veraltete Closure)
  commandsRef.current = p.commands;
  const paramsRef = useRef(p);
  paramsRef.current = p;
  const offenRef = useRef(offen);
  offenRef.current = offen;
  const rueckfrageRef = useRef(rueckfrage);
  rueckfrageRef.current = rueckfrage;

  const reset = useCallback(() => {
    wache.current = false;
    eigentorWache.current = false;
    torRef.current = null;
    setRueckfrage(null);
    setOffen(null);
  }, []);
  const matchId = p.matchId;
  useEffect(() => { reset(); }, [matchId, reset]);

  const teamVon = (seite: Side): { id: string; name: string } => (seite === 'home' ? paramsRef.current.teams.home : paramsRef.current.teams.away);

  const tippeTor = useCallback((seite: Side, optionen?: { perTaste?: boolean }) => {
    if (wache.current) { return; }
    wache.current = true;
    const { spielzeitJetzt, melde, t } = paramsRef.current;
    const team = teamVon(seite);
    const ersterTippMs = spielzeitJetzt();
    torRef.current = { id: Promise.resolve(commandsRef.current.tor(team.id)).catch(() => null), seite, ersterTippMs };
    setOffen({ art: 'tor', seite, ersterTippMs, ...(optionen?.perTaste === true ? { perTaste: true } : {}) });
    melde(3, t('meldung.tor', { team: team.name }));
  }, []);

  const waehleEigentor = useCallback(async () => {
    const tor = torRef.current;
    if (!tor || eigentorWache.current) { return; }
    eigentorWache.current = true;
    const torEventId = await tor.id;
    if (!torEventId) { eigentorWache.current = false; return; }
    const gegner = teamVon(tor.seite === 'home' ? 'away' : 'home');
    const eigentorId = Promise.resolve(commandsRef.current.eigentor({ torEventId, gegnerTeamId: gegner.id, clockMs: tor.ersterTippMs })).catch(() => null);
    torRef.current = { ...tor, id: eigentorId };
    setOffen((o) => (o ? { ...o, eigentor: true } : o));
  }, []);

  const tippeFoul = useCallback((seite: Side) => {
    const { melde, t } = paramsRef.current;
    const team = teamVon(seite);
    void commandsRef.current.foul(team.id);
    melde(3, t('meldung.foul', { team: team.name }));
  }, []);
  const tippeZeitstrafe = useCallback((seite: Side) => {
    setOffen({ art: EINTRAG_ZEITSTRAFE, seite, ersterTippMs: paramsRef.current.spielzeitJetzt() });
  }, []);
  const tippeKarte = useCallback((seite: Side) => {
    setOffen({ art: 'karte', seite, ersterTippMs: paramsRef.current.spielzeitJetzt() });
  }, []);
  const waehleKartenArt = useCallback((art: CardKind) => {
    setOffen((o) => (o?.art === 'karte' ? { ...o, kartenArt: art } : o));
  }, []);

  const sendeKarte = useCallback(async (o: OffenerEintrag, art: CardKind, nummer: number | null) => {
    reset();
    const { melde, t, spielzeitJetzt } = paramsRef.current;
    const team = teamVon(o.seite ?? 'home');
    melde(3, t(MELDUNG_KARTE[art], { team: team.name }));
    await commandsRef.current.karte(team.id, art, { nummer, clockMs: o.ersterTippMs ?? spielzeitJetzt() });
  }, [reset]);
  const sendeZeitstrafe = useCallback(async (o: OffenerEintrag, nummer: number | null) => {
    reset();
    const { melde, t, spielzeitJetzt } = paramsRef.current;
    const team = teamVon(o.seite ?? 'home');
    melde(3, t('meldung.strafeErfasst', { team: team.name }));
    await commandsRef.current.zeitstrafe(team.id, { nummer, clockMs: o.ersterTippMs ?? spielzeitJetzt() });
  }, [reset]);

  const waehleNummer = useCallback(async (nummer: number) => {
    const tor = torRef.current;
    const o = offenRef.current;
    if (tor) {
      reset();
      const id = await tor.id;
      if (id) { await commandsRef.current.nummer(id, nummer); }
      return;
    }
    if (o?.art === 'karte' && o.kartenArt && o.seite) {
      // @SL-088: die zweite Gelbe fragt nach, die Auswahl ruht darunter
      if (o.kartenArt === 'YELLOW' && paramsRef.current.hatSchonGelb(teamVon(o.seite).id, nummer)) {
        setRueckfrage({ nummer });
        return;
      }
      await sendeKarte(o, o.kartenArt, nummer);
      return;
    }
    if (o?.art === EINTRAG_ZEITSTRAFE && o.seite) { await sendeZeitstrafe(o, nummer); }
    // Nummer ändern aus der Liste: Aufgabe 4.1
  }, [reset, sendeKarte, sendeZeitstrafe]);

  const antworteZweiteGelbe = useCallback(async (wahl: 'gelbRot' | 'trotzdemGelb') => {
    const o = offenRef.current;
    const frage = rueckfrageRef.current;
    if (o?.art !== 'karte' || !frage) { return; }
    await sendeKarte(o, wahl === 'gelbRot' ? 'YELLOW_RED' : 'YELLOW', frage.nummer);
  }, [sendeKarte]);

  const schliesseAuswahl = useCallback(async (grund: NumberPickerSchliessGrund) => {
    const o = offenRef.current;
    // „ohne Nummer“ erfasst Karte und Zeitstrafe ohne Nummer; jeder andere Weg verwirft sie. Das Tor bleibt in jedem Fall stehen (@SL-083).
    if (grund === 'ohneNummer' && o?.art === 'karte' && o.kartenArt && o.seite) { await sendeKarte(o, o.kartenArt, null); return; }
    if (grund === 'ohneNummer' && o?.art === EINTRAG_ZEITSTRAFE && o.seite) { await sendeZeitstrafe(o, null); return; }
    reset();
  }, [reset, sendeKarte, sendeZeitstrafe]);

  // RF5: Zustandswechsel bei offener Karten-/Zeitstrafen-Auswahl. Nur die Art der Auswahl und der Zustand lösen es aus.
  const offeneArt = offen?.art;
  const zustand = p.zustand;
  useEffect(() => {
    if (offeneArt !== 'karte' && offeneArt !== EINTRAG_ZEITSTRAFE) { return; }
    if (!darfImZustand(zustand, true, offeneArt === 'karte' ? 'karte' : AKTION_ZEITSTRAFE)) {
      reset();
      paramsRef.current.melde(3, paramsRef.current.t('meldung.nichtErfasst'));
    }
  }, [offeneArt, zustand, reset]);

  return {
    offen, oeffne: setOffen, schliesse: reset, tippeTor, waehleNummer, schliesseAuswahl, waehleEigentor,
    tippeFoul, tippeZeitstrafe, tippeKarte, waehleKartenArt, rueckfrageZweiteGelbe: rueckfrage, antworteZweiteGelbe,
  };
}
