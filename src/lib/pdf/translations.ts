/**
 * Texte des Spielplan-PDFs (B-28a2). Alle Wörter kommen aus `tournament:pdf.*` (DE und EN).
 *
 * Der Übersetzer ist austauschbar: die App reicht i18next durch, Tests reichen die echte Ressource durch
 * (`__tests__/pdfText.ts`). Datum und Uhrzeit laufen über `Intl.DateTimeFormat(locale)`.
 */

import type { KoKey } from './koSlots';
import type { OriginKind, OriginRound } from './origin';

export type PdfLocale = 'de' | 'en';

/** Übersetzt einen Schlüssel unter `tournament` (z. B. `pdf.nr`) mit optionalen Werten. */
export type PdfTranslator = (key: string, values?: Record<string, string | number>) => string;

export interface PdfTexts {
  organizer: string;
  hall: string;
  matchDuration: string;
  mode: string;
  /** Kopfzeile „Termin“ (B-28a3-4F, N2: eine Zeile wie v7.2). */
  appointment: string;
  /** Wert der Terminzeile: Tag, Beginn, Ende voraussichtlich, Felder. */
  appointmentLine: (parts: { day: string; start: string; end: string; fields: string }) => string;
  /** Anzahl der Felder: „1 Feld“, „2 Felder“. */
  fields: (count: number) => string;
  participants: string;
  groupStage: string;
  /** Abschnitt der Spiele bei „Jeder gegen jeden“ (statt „Gruppenphase“). */
  matches: string;
  finalRanking: string;
  /** Satz über den Schreiblinien der offenen Platzierung (@DR-009): mit Finalrunde „nach dem Finale“, sonst „nach dem letzten Spiel“. */
  placementPending: { afterFinal: string; afterLast: string };
  nr: string;
  timeHeader: string;
  field: string;
  group: string;
  home: string;
  result: string;
  away: string;
  /** Spaltenkopf „SR“ (@DR-025). */
  referee: string;
  /** Kennzeichen unter dem Ergebnis eines laufenden Spiels (@BM-012) und im Kasten eines ausgefallenen (@BM-013). */
  live: string;
  skipped: string;
  /** „korrigiert 14:52“ (@BM-013); `time` kommt aus `formatClock`. */
  corrected: (time: string) => string;
  /** Beschriftung der kleinen Felder in K.-o.-Spielen (@DR-019). */
  afterOvertime: string;
  shootout: string;
  pos: string;
  team: string;
  played: string;
  won: string;
  drawn: string;
  lost: string;
  goals: string;
  diff: string;
  points: string;
  thirdPlace: string;
  fifthSixth: string;
  seventhEighth: string;
  /** Kicker im Kopf: „Spielplan“ mit Ergebnissen, „Spielplan zum Ausfüllen“ ohne (@BM-052). */
  kicker: { plan: string; blank: string };
  /** Abschnitte, die keinen eigenen Titel tragen, im Untertitel des Kurzkopfs (G8): „Tabellen“, „Finalrunde“. */
  sectionTables: string;
  sectionFinals: string;
  /** Hinweis hinter den Runden-Überschriften der Finalrunde, solange die Gruppenphase läuft (W7). */
  timesTentative: string;
  /** Ansprechpartner: Feldname in Hinweisen und Zeile „Kontakt: …“ in der Fußzeile (nur mit Häkchen, @W1-031). */
  contact: string;
  contactLine: (contact: string) => string;
  /** Hinweis, wenn die eingebettete Schrift nicht lädt und die Standardschrift druckt (B6). */
  fontFallbackNote: string;
  noDate: string;
  /** Titel der Gruppentabelle nach dem Abschluss bei Jeder gegen jeden in einer Gruppe ohne Finalrunde (@DR-009). */
  finalTable: string;
  /** Beschriftung unter dem Zuschauer-QR (@DR-010): mit sichtbaren Ergebnissen „Live-Ergebnisse“, sonst „Spielplan aufs Handy“. */
  qrCaption: { results: string; plan: string };
  /** Hinweis, wenn eine Kopfgrafik nicht verwendet werden konnte (@DR-023). */
  logoUnusable: (side: 'left' | 'right') => string;
  /** Herkunft offener Plätze im Klartext (`origin.ts`): „Zweiter Gruppe A“, „Sieger Halbfinale 1“. */
  origin: {
    groupPlace: (place: number, group: string) => string;
    fromRound: (kind: OriginKind, round: OriginRound, n: number) => string;
    /** Gruppen-Herkunft, solange die Tabellen ausgeblendet sind (@BM-032). */
    undecided: string;
  };
  modeGroupsAndFinals: string;
  modeRoundRobin: string;
  standingsOfGroup: (group: string) => string;
  durationMinutes: (minutes: number) => string;
  tournamentTitle: string;
  ageClass: string;
  unrenderableName: (name: string) => string;
  /** Feldname mit Text, der nicht darstellbar ist (z. B. Turniername, Halle, Veranstalter). */
  unrenderableField: (field: string, text: string) => string;
  /** Titel der Finalphase. Unbekannte Phasen bleiben beim Namen aus dem Plan. */
  phaseTitle: (name: string, fallback: string) => string;
  /** Gruppenname. Der generische Name „Gruppe X“ wird übersetzt, ein eigener Name bleibt. */
  groupLabel: (id: string, displayName: string) => string;
  /** Spieltag aus `JJJJ-MM-TT` in der Sprache des Dokuments; anderes Format bleibt unverändert. */
  formatDate: (isoDate: string) => string;
  /** Wochentag aus `JJJJ-MM-TT` in der Sprache des Dokuments; anderes Format ergibt leer. */
  formatWeekday: (isoDate: string) => string;
  /** Uhrzeit `HH:mm` in der Sprache des Dokuments. */
  formatClock: (date: Date) => string;
  /** Texte der Regelzeilen im Kopf und der K.-o.-Zeilen (`pdf.rules.*`, B-28a3-3a). */
  rules: PdfRuleTexts;
}

/** Texte der Regelzeilen (`pdf.rules.*`). Die Kriterien tragen die Wortlaute aus @DR-020. */
export interface PdfRuleTexts {
  /** Zeilenbeschriftungen vor dem Doppelpunkt. */
  label: { mode: string; placement: string; duration: string; rulebook: string; ko: string };
  modeRoundRobin: string;
  /** Beschriftung eines Platzierungskriteriums; unbekannte IDs bleiben beim Rückfall. */
  criterion: (id: string, fallback: string) => string;
  /** Trenner zwischen Kriterien („Punkte – Tordifferenz“). */
  criteriaJoin: string;
  /** Trenner zwischen Angaben in einer Zeile („Spielzeit: 10 Min. · Zeitstrafe 2 Min.“). */
  join: string;
  /** Punkte-Zusatz bei abweichendem Punktsystem, z. B. „Sieg 2, Unentschieden 1 Punkt“. */
  pointsLine: (win: number, draw: number) => string;
  /** Niederlagen-Zusatz, nur bei Niederlagenpunkten ungleich 0. */
  pointsLoss: (loss: number) => string;
  groupDuration: (duration: string) => string;
  finalDuration: (duration: string) => string;
  penalty: (duration: string) => string;
  seconds: (seconds: number) => string;
  /** Rundenname; `placement` steht für die Platzierungsspiele (3, 5, 7), `thirdPlace` für das Spiel um Platz 3. */
  round: (key: KoKey) => string;
  /** Aufzählung von Rundennamen nach der Sprache („Halbfinale, Platzierungsspiele und Finale“). */
  joinList: (items: string[]) => string;
  /** Großschreibung des ersten Buchstabens einer Zeile (EN-Rundennamen stehen klein in der Aufzählung). */
  startUpper: (text: string) => string;
  koAll: (rule: string) => string;
  koRound: (round: string, rule: string) => string;
  ruleShootout: (shooters: string) => string;
  ruleOvertimeThenShootout: (shooters: string) => string;
  ruleGoldenGoal: string;
  shooters: (count: number) => string;
}

const PLACE_WORDS = ['first', 'second', 'third', 'fourth'] as const;
const FINAL_PHASES = ['roundOf16', 'quarterfinal', 'semifinal', 'final'] as const;
const PLACEMENT_CRITERIA = ['points', 'goalDifference', 'goalsFor', 'directComparison'] as const;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Baut die Texte der Regelzeilen über den Übersetzer (`pdf.rules.*`). */
function buildRuleTexts(translate: PdfTranslator, s: (key: string) => string, locale: PdfLocale): PdfRuleTexts {
  const r = (key: string): string => s(`rules.${key}`);
  const unit = (n: number): string => (n === 1 ? r('pointOne') : r('pointMany'));
  return {
    label: {
      mode: r('label.mode'),
      placement: r('label.placement'),
      duration: r('label.duration'),
      rulebook: r('label.rulebook'),
      ko: r('label.ko'),
    },
    modeRoundRobin: r('modeRoundRobin'),
    criterion: (id, fallback) =>
      (PLACEMENT_CRITERIA as readonly string[]).includes(id) ? r(`criterion.${id}`) : fallback,
    criteriaJoin: r('criteriaJoin'),
    join: r('join'),
    pointsLine: (win, draw) => translate('pdf.rules.pointsLine', { win, draw, unit: unit(draw) }),
    pointsLoss: loss => translate('pdf.rules.pointsLoss', { loss, unit: unit(loss) }),
    groupDuration: duration => translate('pdf.rules.groupDuration', { duration }),
    finalDuration: duration => translate('pdf.rules.finalDuration', { duration }),
    penalty: duration => translate('pdf.rules.penalty', { duration }),
    seconds: seconds => translate('pdf.rules.seconds', { seconds }),
    round: key => r(`round.${key}`),
    joinList: items => new Intl.ListFormat(locale, { type: 'conjunction' }).format(items),
    startUpper: text => text.charAt(0).toLocaleUpperCase(locale) + text.slice(1),
    koAll: rule => translate('pdf.rules.koAll', { label: r('label.ko'), rule }),
    koRound: (round, rule) => translate('pdf.rules.koRound', { round, rule }),
    ruleShootout: shooters => translate('pdf.rules.ruleShootout', { shooters }),
    ruleOvertimeThenShootout: shooters => translate('pdf.rules.ruleOvertimeThenShootout', { shooters }),
    ruleGoldenGoal: r('ruleGoldenGoal'),
    shooters: n => (n === 1 ? r('shootersOne') : translate('pdf.rules.shooters', { n })),
  };
}

/** Sprache des Dokuments: Englisch, sonst Deutsch (Vorgabe). */
export function resolvePdfLocale(language: string | undefined): PdfLocale {
  return language?.startsWith('en') ? 'en' : 'de';
}

/** Baut alle Texte über den Übersetzer. Schlüssel liegen unter `pdf.*`. */
/** Datum `JJJJ-MM-TT` als UTC-Datum (zonenunabhängig). Anderes Format: `undefined`. */
function isoToUtc(isoDate: string): Date | undefined {
  const match = ISO_DATE.exec(isoDate);
  return match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : undefined;
}

export function buildPdfTexts(translate: PdfTranslator, locale: PdfLocale): PdfTexts {
  const s = (key: string): string => translate(`pdf.${key}`);
  const clock = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const day = new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' });

  return {
    organizer: s('organizer'),
    hall: s('hall'),
    matchDuration: s('matchDuration'),
    mode: s('mode'),
    appointment: s('appointment'),
    appointmentLine: parts => translate('pdf.appointmentLine', parts),
    fields: count => (count === 1 ? s('fieldOne') : translate('pdf.fieldMany', { n: count })),
    participants: s('participants'),
    groupStage: s('groupStage'),
    matches: s('matches'),
    finalRanking: s('finalRanking'),
    placementPending: { afterFinal: s('placementPending.afterFinal'), afterLast: s('placementPending.afterLast') },
    nr: s('nr'),
    timeHeader: s('timeHeader'),
    field: s('field'),
    group: s('group'),
    home: s('home'),
    result: s('result'),
    away: s('away'),
    referee: s('referee'),
    live: s('live'),
    skipped: s('skipped'),
    corrected: time => translate('pdf.corrected', { time }),
    afterOvertime: s('afterOvertime'),
    shootout: s('shootout'),
    pos: s('pos'),
    team: s('team'),
    played: s('played'),
    won: s('won'),
    drawn: s('drawn'),
    lost: s('lost'),
    goals: s('goals'),
    diff: s('diff'),
    points: s('points'),
    thirdPlace: s('thirdPlace'),
    fifthSixth: s('fifthSixth'),
    seventhEighth: s('seventhEighth'),
    kicker: { plan: s('kicker.plan'), blank: s('kicker.blank') },
    sectionTables: s('sectionTables'),
    sectionFinals: s('sectionFinals'),
    timesTentative: s('timesTentative'),
    contact: s('contact'),
    contactLine: contact => translate('pdf.contactLine', { contact }),
    fontFallbackNote: s('fontFallbackNote'),
    noDate: s('noDate'),
    finalTable: s('finalTable'),
    qrCaption: { results: s('qrCaption.results'), plan: s('qrCaption.plan') },
    logoUnusable: side => s(side === 'left' ? 'logoUnusableLeft' : 'logoUnusableRight'),
    origin: {
      groupPlace: (place, group) => {
        const word = PLACE_WORDS[place - 1] as (typeof PLACE_WORDS)[number] | undefined;
        const ordinal = word === undefined ? translate('pdf.origin.placeNth', { n: place }) : s(`origin.place.${word}`);
        return translate('pdf.origin.groupPlace', { place: ordinal, group });
      },
      fromRound: (kind, round, n) => translate(`pdf.origin.${kind}`, { round: s(`origin.round.${round}`), n }),
      undecided: s('origin.undecided'),
    },
    modeGroupsAndFinals: s('modeGroupsAndFinals'),
    modeRoundRobin: s('modeRoundRobin'),
    standingsOfGroup: group => translate('pdf.standingsOfGroup', { group }),
    durationMinutes: minutes => translate('pdf.durationMinutes', { minutes }),
    tournamentTitle: s('tournamentTitle'),
    ageClass: s('ageClass'),
    unrenderableName: name => translate('pdf.unrenderableName', { name }),
    unrenderableField: (field, text) => translate('pdf.unrenderableField', { field, text }),
    phaseTitle: (name, fallback) =>
      (FINAL_PHASES as readonly string[]).includes(name) ? s(`phase.${name}`) : fallback,
    groupLabel: (id, displayName) =>
      displayName === `Gruppe ${id}` ? translate('pdf.groupName', { id }) : displayName,
    formatDate: isoDate => {
      const utc = isoToUtc(isoDate);
      return utc ? day.format(utc) : isoDate;
    },
    formatWeekday: isoDate => {
      const utc = isoToUtc(isoDate);
      return utc ? weekday.format(utc) : '';
    },
    formatClock: date => clock.format(date),
    rules: buildRuleTexts(translate, s, locale),
  };
}
