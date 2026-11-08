/**
 * Texte des Spielplan-PDFs (B-28a2). Alle Wörter kommen aus `tournament:pdf.*` (DE und EN).
 *
 * Der Übersetzer ist austauschbar: die App reicht i18next durch, Tests reichen die echte Ressource durch
 * (`__tests__/pdfText.ts`). Datum und Uhrzeit laufen über `Intl.DateTimeFormat(locale)`.
 */

import type { KoKey } from './koSlots';
import type { OriginKind, OriginRound } from './origin';

export type PdfLocale = 'de' | 'en';

/** Übersetzt einen Schlüssel unter `tournament` (z. B. `pdf.group`) oder mit Namensraum davor (`short:tabellenkopf.rank`) mit optionalen Werten. */
export type PdfTranslator = (key: string, values?: Record<string, string | number>) => string;

/** Texte des Handzettels (Eckdaten im Kopf, Titel der Datei; `pdf.sheet.*`, @DR-031, @DR-039). */
export interface PdfSheetTexts {
  when: string;
  where: string;
  duration: string;
  flow: string;
  /** „Beginn 10:00“ und „Ende ca. 15:45“ (die Zeit ist schon auf 5 Minuten gerundet). */
  begin: (clock: string) => string;
  endApprox: (clock: string) => string;
  /** „28 Spiele, davon 8 Finalspiele“ (Gesamtzahl, davon Finalspiele; @DR-031). */
  flowWithFinals: (total: number, finals: number) => string;
  flowMatches: (count: number) => string;
  /** Zusatz im Titel der Datei: „Hallencup Nord – Spielplan“ (en: „Schedule“). */
  titleSuffix: string;
  /** Zusatz der Fassung ohne Ergebnisse im Dateinamen („ohne-Ergebnisse“, @BM-052). */
  fileWithoutResults: string;
  /** Art im Dateinamen des Endstand-PDFs („Endstand“, en: „Final-standings“; @DR-011). */
  fileFinal: string;
  /** Adresse der Zuschauer-Seite in der Fußzeile, davor ein Satz („Live-Ergebnisse und aktuelle Zeiten:“). */
  footerLink: string;
}

export interface PdfTexts {
  organizer: string;
  hall: string;
  matchDuration: string;
  mode: string;
  /** Anzahl der Felder: „1 Feld“, „2 Felder“. */
  fields: (count: number) => string;
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
  /** Spaltenkopf „Schiedsrichter“ (@DR-025, @OB-075: ausgeschrieben). */
  referee: string;
  /** Text für ein ausgefallenes Spiel (@BM-013); ein laufendes Spiel trägt keinen Text, nur Linien (@DR-019). */
  skipped: string;
  /** „korrigiert 14:52“ (@BM-013); `time` kommt aus `formatClock`. Gewertet (Nichtantritt): „gewertet“ (@DR-001). */
  corrected: (time: string) => string;
  awarded: string;
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
  /** Kicker im Kopf: „Spielplan“, in beiden Fassungen (@BM-052, Daniel 16.10.). */
  kicker: { plan: string };
  /** Abschnitte, die keinen eigenen Titel tragen, im Untertitel des Kurzkopfs (G8): „Tabellen“, „Finalrunde“. */
  sectionTables: string;
  sectionFinals: string;
  /** Ansprechpartner: Feldname in Hinweisen und Zeile „Ansprechpartner: …“ in der Fußzeile (nur mit Häkchen, @W1-031). */
  contact: string;
  contactLine: (contact: string) => string;
  /** Hinweis, wenn die eingebettete Schrift nicht lädt und die Standardschrift druckt (B6). */
  fontFallbackNote: string;
  noDate: string;
  /** Titel der Gruppentabelle nach dem Abschluss bei Jeder gegen jeden in einer Gruppe ohne Finalrunde (@DR-009). */
  finalTable: string;
  /** Wort der Zusatzzeile in der Finalrunde des Endstands („Verlängerung 1 : 0“, @DR-054); „Strafstoßschießen“ steht in `shootout`. */
  overtimeWord: string;
  /** Untertitel des Kurzkopfs der Seite „Siegerehrung“ (@DR-052). */
  sectionCeremony: string;
  /** Zeile „Wertung: Punkte · Tordifferenz · Tore“ unter den Tabellen des Endstands (@DR-051); `criteria` ist die fertige Aufzählung. */
  tiebreakHint: (criteria: string) => string;
  /** Torschützenliste auf der Seite „Siegerehrung“ (@DR-052): Überschrift, Spaltenköpfe, Fußnote „Außerdem: 2 Tore ohne Rückennummer · 1 Eigentor“. */
  ceremony: { scorers: string; rank: string; club: string; also: (noNumber: number, ownGoals: number) => string };
  /** Beschriftung unter dem Zuschauer-QR (@DR-010): mit sichtbaren Ergebnissen „Live-Ergebnisse“, sonst „Spielplan aufs Handy“. */
  qrCaption: { results: string; plan: string };
  /** Hinweis, wenn eine Kopfgrafik nicht verwendet werden konnte (@DR-023). */
  logoUnusable: (side: 'left' | 'right') => string;
  /** Herkunft offener Plätze im Klartext (`origin.ts`): „Zweiter Gruppe A“, „Sieger Halbfinale 1“. */
  origin: {
    groupPlace: (place: number, group: string) => string;
    fromRound: (kind: OriginKind, round: OriginRound, n: number) => string;
    /** „Sieger Spiel 25“ über die Spielnummer des Vorgängers (@DR-037). */
    fromMatch: (kind: OriginKind, number: number) => string;
    /** Gruppen-Herkunft, solange die Tabellen ausgeblendet sind (@BM-032). */
    undecided: string;
  };
  /** „2 Gruppen + Finalrunde“ (@DR-020): die Zahl der Gruppen als Ziffer. */
  modeGroupsAndFinals: (groups: number) => string;
  /** Strafstoßschießen um Platz 1 (@DR-036): Überschrift und Beschriftung der Trefferlinien. */
  shootoutLine: { title: string; hits: string };
  modeRoundRobin: string;
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
  /** Spieltag aus `JJJJ-MM-TT` als `TT.MM.JJJJ` in jeder Sprache; anderes Format bleibt unverändert. */
  formatDate: (isoDate: string) => string;
  /** Wochentag aus `JJJJ-MM-TT` in der Sprache des Dokuments; anderes Format ergibt leer. */
  formatWeekday: (isoDate: string) => string;
  /** Uhrzeit `HH:mm` in der Sprache des Dokuments. */
  formatClock: (date: Date) => string;
  /** Texte der Regelzeilen im Kopf und der K.-o.-Zeilen (`pdf.rules.*`, B-28a3-3a). */
  rules: PdfRuleTexts;
  sheet: PdfSheetTexts;
}

/** Texte der Regelzeilen (`pdf.rules.*`). Die Kriterien tragen die Wortlaute aus @DR-020. */
export interface PdfRuleTexts {
  /** Zeilenbeschriftungen vor dem Doppelpunkt. */
  label: { mode: string; tiebreak: string; duration: string; rulebook: string; ko: string };
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
  /** Zeile „Gleichstand auf Platz 1: Strafstoßschießen“ (@DR-020); mehrere Plätze als Aufzählung nach der Sprache. */
  playOut: (places: number[]) => string;
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
      tiebreak: r('label.tiebreak'),
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
    playOut: places =>
      translate(places.length === 1 ? 'pdf.rules.playOutOne' : 'pdf.rules.playOutMany', {
        places: new Intl.ListFormat(locale, { type: 'conjunction' }).format(places.map(String)),
      }),
    ruleOvertimeThenShootout: shooters => translate('pdf.rules.ruleOvertimeThenShootout', { shooters }),
    ruleGoldenGoal: r('ruleGoldenGoal'),
    shooters: n => (n === 1 ? r('shootersOne') : translate('pdf.rules.shooters', { n })),
  };
}

/** Sprache des Dokuments: Englisch, sonst Deutsch (Vorgabe). */
export function resolvePdfLocale(language: string | undefined): PdfLocale {
  return language?.startsWith('en') ? 'en' : 'de';
}

const zwei = (n: number): string => String(n).padStart(2, '0');

/** Datum `JJJJ-MM-TT` als UTC-Datum (zonenunabhängig). Anderes Format: `undefined`. */
function isoToUtc(isoDate: string): Date | undefined {
  const match = ISO_DATE.exec(isoDate);
  return match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : undefined;
}

/** Baut alle Texte über den Übersetzer. Schlüssel liegen unter `pdf.*`. */
export function buildPdfTexts(translate: PdfTranslator, locale: PdfLocale): PdfTexts {
  const s = (key: string): string => translate(`pdf.${key}`);
  // Kurzformen im Tabellenkopf (@OB-075) kommen aus dem Namensraum `short` (Glossar: short.context „tabellenkopf“).
  const head = (key: string): string => translate(`short:tabellenkopf.${key}`);
  const clock = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' });

  return {
    organizer: s('organizer'),
    hall: s('hall'),
    matchDuration: s('matchDuration'),
    mode: s('mode'),
    fields: count => (count === 1 ? s('fieldOne') : translate('pdf.fieldMany', { n: count })),
    groupStage: s('groupStage'),
    matches: s('matches'),
    finalRanking: s('finalRanking'),
    placementPending: { afterFinal: s('placementPending.afterFinal'), afterLast: s('placementPending.afterLast') },
    nr: head('number'),
    timeHeader: s('timeHeader'),
    field: s('field'),
    group: head('group'),
    home: s('home'),
    result: s('result'),
    away: s('away'),
    referee: head('referee'),
    skipped: s('skipped'),
    corrected: time => translate('pdf.corrected', { time }),
    awarded: s('awarded'),
    afterOvertime: s('afterOvertime'),
    shootout: s('shootout'),
    pos: head('rank'),
    team: s('team'),
    played: head('played'),
    won: head('won'),
    drawn: head('drawn'),
    lost: head('lost'),
    goals: s('goals'),
    diff: head('goalDifference'),
    points: head('points'),
    thirdPlace: s('thirdPlace'),
    fifthSixth: s('fifthSixth'),
    seventhEighth: s('seventhEighth'),
    kicker: { plan: s('kicker.plan') },
    sectionTables: s('sectionTables'),
    sectionFinals: s('sectionFinals'),
    contact: s('contact'),
    contactLine: contact => translate('pdf.contactLine', { contact }),
    fontFallbackNote: s('fontFallbackNote'),
    noDate: s('noDate'),
    finalTable: s('finalTable'),
    overtimeWord: s('overtimeWord'),
    sectionCeremony: s('sectionCeremony'),
    tiebreakHint: criteria => translate('pdf.tiebreakHint', { label: s('rules.label.tiebreak'), criteria }),
    ceremony: {
      scorers: s('ceremony.scorers'),
      rank: s('ceremony.rank'),
      club: s('ceremony.club'),
      also: (noNumber, ownGoals) => translate('pdf.ceremony.alsoLine', {
        parts: [
          ...(noNumber > 0 ? [translate('pdf.ceremony.noNumber', { count: noNumber })] : []),
          ...(ownGoals > 0 ? [translate('pdf.ceremony.ownGoals', { count: ownGoals })] : []),
        ].join(s('rules.join')),
      }),
    },
    qrCaption: { results: s('qrCaption.results'), plan: s('qrCaption.plan') },
    logoUnusable: side => s(side === 'left' ? 'logoUnusableLeft' : 'logoUnusableRight'),
    origin: {
      groupPlace: (place, group) => {
        const word = PLACE_WORDS[place - 1] as (typeof PLACE_WORDS)[number] | undefined;
        const ordinal = word === undefined ? translate('pdf.origin.placeNth', { n: place }) : s(`origin.place.${word}`);
        return translate('pdf.origin.groupPlace', { place: ordinal, group });
      },
      fromRound: (kind, round, n) => translate(`pdf.origin.${kind}`, { round: s(`origin.round.${round}`), n }),
      fromMatch: (kind, number) => translate(`pdf.origin.${kind}OfMatch`, { n: number }),
      undecided: s('origin.undecided'),
    },
    modeGroupsAndFinals: groups => translate('pdf.modeGroupsAndFinals', { count: groups }),
    shootoutLine: { title: s('shootoutLine.title'), hits: s('shootoutLine.hits') },
    modeRoundRobin: s('modeRoundRobin'),
    durationMinutes: minutes => translate('pdf.durationMinutes', { minutes }),
    tournamentTitle: s('tournamentTitle'),
    ageClass: s('ageClass'),
    unrenderableName: name => translate('pdf.unrenderableName', { name }),
    unrenderableField: (field, text) => translate('pdf.unrenderableField', { field, text }),
    phaseTitle: (name, fallback) =>
      (FINAL_PHASES as readonly string[]).includes(name) ? s(`phase.${name}`) : fallback,
    groupLabel: (id, displayName) =>
      displayName === `Gruppe ${id}` ? translate('pdf.groupName', { id }) : displayName,
    // Datum in beiden Sprachen als TT.MM.JJJJ, wie in der Fußzeile und im Record (@DR-011, G70): nie 11/14/2026
    formatDate: isoDate => {
      const utc = isoToUtc(isoDate);
      return utc ? `${zwei(utc.getUTCDate())}.${zwei(utc.getUTCMonth() + 1)}.${utc.getUTCFullYear()}` : isoDate;
    },
    formatWeekday: isoDate => {
      const utc = isoToUtc(isoDate);
      return utc ? weekday.format(utc) : '';
    },
    formatClock: date => clock.format(date),
    rules: buildRuleTexts(translate, s, locale),
    sheet: {
      when: s('sheet.when'),
      where: s('sheet.where'),
      duration: s('sheet.duration'),
      flow: s('sheet.flow'),
      begin: clock => translate('pdf.sheet.begin', { clock }),
      endApprox: clock => translate('pdf.sheet.endApprox', { clock }),
      flowWithFinals: (total, finals) => translate('pdf.sheet.flowWithFinals', { total, count: finals }),
      flowMatches: count => translate('pdf.sheet.flowMatches', { count }),
      titleSuffix: s('sheet.titleSuffix'),
      fileWithoutResults: s('sheet.fileWithoutResults'),
      fileFinal: s('sheet.fileFinal'),
      footerLink: s('sheet.footerLink'),
    },
  };
}
