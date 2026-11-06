/**
 * Tafel vor dem Anpfiff, zwischen den Spielen und nach der Übernahme (Aufgabe 2.5; Spec § 6 „Vor Anpfiff“, „wartet“,
 * „kein Spiel“, „Nach Übernahme“). Rein, ohne React. Liefert die Teile, die `toScoreboardModel` zu den Teilen der
 * laufenden Zustände hinzufügt; Hinweise sperren nichts.
 */
import type { SperrHinweis } from '../../../core/match';
import type { ScoreboardModel, ScoreboardUhr } from '../../ui/molecules/Scoreboard';
import type { CockpitPhase, LeerGrund } from './cockpitPhase';
import type { MindestpauseHinweis, Uebersetzer } from './cockpitTypes';

export interface ScoreboardVorInput {
  /** Anstoßzeit des Spiels als `HH:MM` (Ortszeit). */
  anstoss: string;
  mindestpause: MindestpauseHinweis | null;
  sperrHinweise: readonly SperrHinweis[];
  leer: LeerGrund | null;
  /** Name des Geräts, von dem das Spiel übernommen wurde (@SL-015). */
  uebernahmeVon: string | null;
  /** Gleiche oder zu ähnliche Trikotfarbe vor dem Anpfiff (@SL-196), schon übersetzt; sonst `null`. */
  farbHinweis?: string | null;
  /** Spielzeit aus den Turnierregeln (@SL-197): Zahl der Abschnitte und Länge eines Abschnitts in Sekunden. */
  spielzeit?: { abschnitte: number; abschnittSekunden: number } | null;
}

interface VorMatch {
  number: number;
  scheduledKickoff: string;
  homeTeam: { id: string; name: string };
  awayTeam: { id: string; name: string };
}

export interface ScoreboardVorErgebnis {
  uhr: ScoreboardUhr | null;
  /** „überfällig N Min“ (@SL-118, @OB-068): steht im Platz des Abzeichens, nicht in den stehenden Zeilen. */
  ueberfaelligText: string | null;
  kopfText: string | null;
  hinweise: string[];
  leerAnzeige: ScoreboardModel['leerAnzeige'];
  farbHinweis: string | null;
}

interface VorEingang {
  match: VorMatch | null;
  phase: CockpitPhase;
  jetztMs: number;
  fieldName?: string;
  tournamentName?: string;
  vor?: ScoreboardVorInput;
}

/** Sekunden als `m:ss` (Spielzeit aus den Regeln). */
function formatMinuten(sekunden: number): string {
  return `${String(Math.floor(sekunden / 60))}:${String(sekunden % 60).padStart(2, '0')}`;
}

/** Minuten seit der angesetzten Anstoßzeit, ganz; `0`, wenn sie nicht lesbar ist oder noch bevorsteht. */
function ueberfaelligMinuten(kickoff: string, jetztMs: number): number {
  const angesetzt = Date.parse(kickoff);
  return Number.isFinite(angesetzt) ? Math.max(0, Math.floor((jetztMs - angesetzt) / 60000)) : 0;
}

export function scoreboardVor(input: VorEingang, t: Uebersetzer): ScoreboardVorErgebnis {
  const { match, phase, vor } = input;
  const leer: ScoreboardVorErgebnis = { uhr: null, ueberfaelligText: null, kopfText: null, hinweise: [], leerAnzeige: null, farbHinweis: null };
  if (!vor) { return leer; }
  const hinweise: string[] = [];
  const kopfText = input.tournamentName ?? null;
  let uhr: ScoreboardUhr | null = null;
  let leerAnzeige: ScoreboardVorErgebnis['leerAnzeige'] = null;
  let ueberfaelligText: string | null = null;

  if (phase.zustand === 'vorAnpfiff' && match) {
    // @SL-197: groß die Spielzeit aus den Regeln („9:00“, bei Abschnitten „2 × 4:00“), darunter „Anstoß 9:10 · Spiel 1 · Feld 1“; ohne Regeln die Anstoßzeit wie bisher
    const zeit = vor.spielzeit && vor.spielzeit.abschnittSekunden > 0 ? vor.spielzeit : null;
    const spielFeld = t('tafel.vor.spielFeld', { nummer: match.number, feld: input.fieldName ?? '' });
    uhr = zeit ? {
      rest: formatMinuten(zeit.abschnittSekunden), vorsatz: zeit.abschnitte > 1 ? t('tafel.vor.abschnitteMal', { anzahl: zeit.abschnitte }) : null,
      gespielt: null, schlussphase: false, steht: false, hervorgehoben: false, ton: 'gedaempft', label: t('tafel.uhr.spielzeit'),
      unterzeile: vor.anstoss ? t('tafel.vor.anstossSpielFeld', { zeit: vor.anstoss, spielFeld }) : spielFeld,
    } : {
      rest: vor.anstoss, gespielt: null, schlussphase: false, steht: false, hervorgehoben: false, ton: 'gedaempft',
      label: t('tafel.uhr.anstoss'), unterzeile: spielFeld,
    };
    if (vor.mindestpause) { hinweise.push(t('tafel.vor.mindestpause', { ...vor.mindestpause })); }
    const minuten = ueberfaelligMinuten(match.scheduledKickoff, input.jetztMs);
    if (minuten >= 1) { ueberfaelligText = t('tafel.vor.ueberfaellig', { minuten }); }
    for (const sperre of vor.sperrHinweise) {
      const team = [match.homeTeam, match.awayTeam].find((kandidat) => kandidat.id === sperre.teamId);
      if (team) { hinweise.push(t('tafel.vor.gesperrt', { nummer: sperre.playerNumber, team: team.name })); }
    }
  }
  const grund = vor.leer;
  if (phase.zustand === 'wartetAufHerkunft' && grund?.art === 'wartetAufHerkunft') {
    leerAnzeige = { titel: grund.paarung ?? t('tafel.zustand.wartet'), untertitel: grund.spielLabel ?? null };
    hinweise.push(...grund.gruende.map((g) => t('tafel.vor.wartetAuf', { grund: g })), t('tafel.vor.reihenfolgeNurLeitung'));
    if (grund.offline) { hinweise.push(t('tafel.vor.wartetOffline')); }
  }
  if (phase.zustand === 'keinSpiel' && grund?.art === 'keinSpiel') {
    leerAnzeige = { titel: t('tafel.keinWeiteresSpiel'), untertitel: grund.feldName };
    hinweise.push(t('tafel.vor.keinSpielMehr', { feld: grund.feldName }));
  }
  // @SL-015, @FU-111: nach der Übernahme Uhr prüfen; '' = Vorgänger ohne Namen (B-49)
  if (vor.uebernahmeVon !== null) {
    hinweise.push(vor.uebernahmeVon === '' ? t('tafel.uebernahmePruefenOhneName') : t('tafel.uebernahmePruefen', { name: vor.uebernahmeVon }));
  }

  const istVorZustand = phase.zustand === 'vorAnpfiff' || phase.zustand === 'wartetAufHerkunft' || phase.zustand === 'keinSpiel';
  const farbHinweis = phase.zustand === 'vorAnpfiff' ? vor.farbHinweis ?? null : null;
  return { uhr, ueberfaelligText, kopfText: istVorZustand ? kopfText : null, hinweise, leerAnzeige, farbHinweis };
}
