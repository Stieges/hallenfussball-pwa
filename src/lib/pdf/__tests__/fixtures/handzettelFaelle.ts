/**
 * Die vier Fälle der Mockup-Runde 2 (Handzettel, 30.10., `mockups/runde-2026-10-30/handzettel/build.mjs`) als Daten
 * (PDF-Paket, Vorlauf V1): a Nikolaus-Turnier (Hauptfall, 6 Teams, keine Spalte „SR“), b Franz Schützinger Cup (2 × 5,
 * Finalrunde), c Belastungsfall (lange Namen, Spalte „SR“), b-lang (b mit einem bzw. zwei langen Namen, Regel bei
 * Platzmangel @DR-033). Reine Testdaten; in Turnier und Plan übersetzt `handzettelTurnier.ts`.
 *
 * Abweichung vom Mockup nach Record: Spalte „SR“ in c zeigt Nummern statt Personennamen (@DR-025 Beispiel 3).
 */

import type { TiebreakerMode, TiebreakerRoundKey } from '../../../../types/tournament';

/** Ergebnis bzw. Zustand eines Spiels (@DR-019); fehlt er, ist das Spiel geplant. */
export type FallZustand =
  | { status: 'finished'; a: number; b: number; overtime?: readonly [number, number]; penalty?: readonly [number, number] }
  | { status: 'running'; a?: number; b?: number }
  | { status: 'paused'; a?: number; b?: number }
  | { status: 'skipped' };

export interface FallSpiel {
  nr: number;
  zeit: string;
  gruppe?: 'A' | 'B';
  heim: string;
  gast: string;
  /** Schiedsrichter-Nummer (@DR-025). */
  sr?: number;
  zustand?: FallZustand;
}

/** Herkunft eines offenen Finalplatzes (@DR-037): Gruppenplatz oder Sieger/Verlierer eines Spiels (Spielnummer). */
export type FallHerkunft = { rang: number; gruppe: 'A' | 'B' } | { sieger: number } | { verlierer: number };

export interface FallFinalSpiel {
  nr: number;
  zeit: string;
  runde: 'quarterfinal' | 'semifinal' | 'thirdPlace' | 'final';
  heim: FallHerkunft;
  gast: FallHerkunft;
  zustand?: FallZustand;
  /** Schiedsrichter-Nummer (@DR-025). */
  sr?: number;
}

export interface HandzettelFall {
  name: 'a' | 'b' | 'c' | 'b-lang';
  titel: string;
  altersklasse: string;
  veranstalter: string;
  /** ISO-Datum und Beginn (Ortszeit). */
  datum: string;
  beginn: string;
  halle: string;
  adresse?: { street: string; postalCode: string; city: string };
  spielMin: number;
  pauseMin: number;
  /** Teams mit Gruppe; `kurzname` nur als Datum für @DR-033 Beispiel 1 (das Team-Modell hat ihn noch nicht, L8). */
  teams: ReadonlyArray<{ name: string; gruppe?: 'A' | 'B'; kurzname?: string }>;
  spiele: readonly FallSpiel[];
  finale?: readonly FallFinalSpiel[];
  /** Entscheidung bei Gleichstand je Runde der Finalrunde (@DR-019, `finalsConfig.tiebreakerByRound`). */
  entscheidung?: Readonly<Partial<Record<TiebreakerRoundKey, TiebreakerMode>>>;
  /** Schiedsrichter-Modus Veranstalter mit eingetragenen Namen (Mockup c); im PDF stehen nur die Nummern. */
  schiedsrichterNamen?: readonly string[];
  /** Akzent des Mockups (aus dem Wappen bzw. App-Grün) und hinterlegte Grafiken. */
  akzent: string;
  logoLinks: boolean;
  grafikRechts: boolean;
  /** Regelwerk im Kopf (Mockup a, c: „BFV-Regelwerk für private Turniere“). */
  regelwerk?: string;
  /** Zeitstrafe in Sekunden; Mockup b hat keine (Spielzeit „10 Min. je Spiel“), sonst gilt die Vorgabe 120. */
  zeitstrafeSek?: number;
  /** Ansprechpartner der Fußzeile (@DR-044, nur mit Häkchen „öffentlich zeigen“): erfunden, kein Mockup-Fall. */
  kontakt?: string;
  /** Erwartungen aus dem Mockup (NOTIZ.md „Korrekturen nach Review“). */
  mockup: { endeCa: string; seiten: number; zeilenhoehe: number; ergebnisLinie: number };
}

/** Teilen-Code aller Fälle (Mockup): Zuschauer-Seite `…/#/live/K7M2QX`. */
export const FALL_SHARE_CODE = 'K7M2QX';

const NIKOLAUS_TEAMS = ['TSV Waging rot', 'TSV Waging blau', 'DJK Kammer', 'TSV Petting', 'DJK Otting', 'TSV 1921 Fridolfing'];
const LANGE_TEAMS = [
  'SpVgg Oberlangenbach-Unterhausen', 'FC Grün-Weiß Nordhausen/Süd', 'TSV 1860 Rosenheim-Westerndorf',
  'SG Kirchanschöring/Petting/Waging', 'DJK Otting', 'SV Surberg',
];

/** Paarungen von a und c (Kürzel wie im Mockup: R, B, K, P, O, F = Teams 1–6), Beginn 16:30, alle 10 Minuten. */
const NIKOLAUS_PAARE = 'KF PO BR OK FP BK OR PB RF KP BO RK OF RP FB'.split(' ');
const KUERZEL = 'RBKPOF';

function nikolausSpiele(teams: readonly string[], mitSr: boolean): FallSpiel[] {
  return NIKOLAUS_PAARE.map((paar, i) => {
    const minuten = 16 * 60 + 30 + i * 10;
    const zeit = `${String(Math.floor(minuten / 60)).padStart(2, '0')}:${String(minuten % 60).padStart(2, '0')}`;
    const team = (k: string): string => teams[KUERZEL.indexOf(k)] ?? '';
    return { nr: i + 1, zeit, heim: team(paar[0] ?? ''), gast: team(paar[1] ?? ''), ...(mitSr ? { sr: (i % 3) + 1 } : {}) };
  });
}

const NIKOLAUS_BASIS = {
  titel: 'Nikolaus-Turnier',
  altersklasse: 'D-Jugend',
  veranstalter: 'TSV Waging',
  datum: '2026-11-28',
  beginn: '16:30',
  halle: 'Bergader Arena',
  spielMin: 9,
  pauseMin: 1,
  akzent: '#30288C',
  logoLinks: true,
  grafikRechts: true,
} as const;

export const FALL_A: HandzettelFall = {
  ...NIKOLAUS_BASIS,
  name: 'a',
  regelwerk: 'BFV-Regelwerk für private Turniere',
  teams: NIKOLAUS_TEAMS.map(name => ({ name })),
  spiele: nikolausSpiele(NIKOLAUS_TEAMS, false),
  mockup: { endeCa: '19:00', seiten: 2, zeilenhoehe: 11, ergebnisLinie: 12 },
};

export const FALL_C: HandzettelFall = {
  ...NIKOLAUS_BASIS,
  name: 'c',
  regelwerk: 'BFV-Regelwerk für private Turniere',
  teams: LANGE_TEAMS.map(name => ({ name })),
  spiele: nikolausSpiele(LANGE_TEAMS, true),
  schiedsrichterNamen: ['Paul Schmidt', 'Aylin Yılmaz', 'Jonas Müller-Lüdenscheidt'],
  mockup: { endeCa: '19:00', seiten: 2, zeilenhoehe: 10.4, ergebnisLinie: 10 },
};

const GRUPPE_A = ['SV Kirchanschöring', 'TSV Traunwalchen', 'FA Trostberg', 'DJK Traunstein', 'SG Grabenstätt/Chieming'];
const GRUPPE_B = ['SV Seeon', 'TSV Palling', 'SG AlzTrauntal', 'TSV Waging', 'SV Surberg'];

/** Gruppenspiele von b (Mockup), Beginn 10:00, alle 12 Minuten. */
const B_SPIELE: FallSpiel[] = [
  'A SG Grabenstätt/Chieming|DJK Traunstein', 'B SV Seeon|SV Surberg', 'A SV Kirchanschöring|TSV Traunwalchen',
  'B TSV Palling|SG AlzTrauntal', 'A FA Trostberg|SG Grabenstätt/Chieming', 'B TSV Waging|SV Seeon',
  'A TSV Traunwalchen|DJK Traunstein', 'B SG AlzTrauntal|SV Surberg', 'A FA Trostberg|SV Kirchanschöring',
  'B TSV Waging|TSV Palling', 'A TSV Traunwalchen|SG Grabenstätt/Chieming', 'B SG AlzTrauntal|SV Seeon',
  'A DJK Traunstein|FA Trostberg', 'B SV Surberg|TSV Waging', 'A SG Grabenstätt/Chieming|SV Kirchanschöring',
  'B SV Seeon|TSV Palling', 'A FA Trostberg|TSV Traunwalchen', 'B TSV Waging|SG AlzTrauntal',
  'A SV Kirchanschöring|DJK Traunstein', 'B TSV Palling|SV Surberg',
].map((zeile, i) => {
  const [heim = '', gast = ''] = zeile.slice(2).split('|');
  const minuten = 10 * 60 + i * 12;
  const zeit = `${String(Math.floor(minuten / 60)).padStart(2, '0')}:${String(minuten % 60).padStart(2, '0')}`;
  return { nr: i + 1, zeit, gruppe: zeile.startsWith('A') ? 'A' : 'B', heim, gast };
});

/** Finalrunde von b (Mockup): Viertelfinale über Kreuz, Halbfinale, Spiel um Platz 3, Finale, alle 12 Minuten ab 14:08. */
export const B_FINALE: FallFinalSpiel[] = [
  { nr: 21, zeit: '14:08', runde: 'quarterfinal', heim: { rang: 1, gruppe: 'A' }, gast: { rang: 4, gruppe: 'B' } },
  { nr: 22, zeit: '14:20', runde: 'quarterfinal', heim: { rang: 2, gruppe: 'A' }, gast: { rang: 3, gruppe: 'B' } },
  { nr: 23, zeit: '14:32', runde: 'quarterfinal', heim: { rang: 3, gruppe: 'A' }, gast: { rang: 2, gruppe: 'B' } },
  { nr: 24, zeit: '14:44', runde: 'quarterfinal', heim: { rang: 4, gruppe: 'A' }, gast: { rang: 1, gruppe: 'B' } },
  { nr: 25, zeit: '14:56', runde: 'semifinal', heim: { sieger: 22 }, gast: { sieger: 21 } },
  { nr: 26, zeit: '15:08', runde: 'semifinal', heim: { sieger: 24 }, gast: { sieger: 23 } },
  { nr: 27, zeit: '15:20', runde: 'thirdPlace', heim: { verlierer: 26 }, gast: { verlierer: 25 } },
  { nr: 28, zeit: '15:32', runde: 'final', heim: { sieger: 26 }, gast: { sieger: 25 } },
];

export const FALL_B: HandzettelFall = {
  name: 'b',
  titel: 'U13 Qualiturnier für den U12 LV um den „Franz Schützinger Cup“',
  altersklasse: 'U13',
  veranstalter: 'TuS Traunreut',
  datum: '2026-11-15',
  beginn: '10:00',
  halle: 'TuS Halle',
  adresse: { street: 'Jahnstraße 13', postalCode: '83301', city: 'Traunreut' },
  spielMin: 10,
  pauseMin: 2,
  teams: [...GRUPPE_A.map(name => ({ name, gruppe: 'A' as const })), ...GRUPPE_B.map(name => ({ name, gruppe: 'B' as const }))],
  spiele: B_SPIELE,
  zeitstrafeSek: 0,
  finale: B_FINALE,
  entscheidung: { quarterfinal: 'shootout', semifinal: 'shootout', placement: 'shootout', final: 'shootout' },
  akzent: '#008F4C',
  logoLinks: false,
  grafikRechts: false,
  mockup: { endeCa: '15:45', seiten: 2, zeilenhoehe: 8.3, ergebnisLinie: 12 },
};

/** Lange Namen für b-lang: zweizeilig in der Spalte Heim/Gast von b (@DR-032), mit Kurzname für @DR-033 Beispiel 1. */
const LANG = [
  { aus: 'SG Grabenstätt/Chieming', name: 'SG Grabenstätt/Chieming/Übersee', kurzname: 'SG Grabenstätt' },
  { aus: 'SG AlzTrauntal', name: 'SG Alztal-Trauntal/Truchtlaching', kurzname: 'SG AlzTrauntal' },
] as const;

/**
 * b mit `anzahl` langen Namen (je 4 Spiele): 1 = Mockup b-lang (Stufe „eng“ reichte dort mit Zeilenabstand 1,05; mit
 * 1,15 nach @DR-033 ist es knapp, T6 rechnet es nach), 2 = Gegenbeispiel aus T6
 * (auch eng zu lang → Folgeseite mit mindestens 3 Spielen). `mitKurzname` hinterlegt Kurznamen (Beispiel 1).
 */
export function fallBLang(anzahl: 1 | 2, mitKurzname = false): HandzettelFall {
  const ersatz = LANG.slice(0, anzahl);
  const umbenennen = (name: string): string => ersatz.find(e => e.aus === name)?.name ?? name;
  return {
    ...FALL_B,
    name: 'b-lang',
    teams: FALL_B.teams.map(team => {
      const lang = ersatz.find(e => e.aus === team.name);
      return lang ? { ...team, name: lang.name, ...(mitKurzname ? { kurzname: lang.kurzname } : {}) } : team;
    }),
    spiele: FALL_B.spiele.map(s => ({ ...s, heim: umbenennen(s.heim), gast: umbenennen(s.gast) })),
  };
}

/** a mit Adresse der Halle (@DR-031): gleiche Daten wie a, das Mockup hat keine Adresse. */
export const FALL_A_ADRESSE: HandzettelFall = { ...FALL_A, name: 'a', adresse: { street: 'Mühlberger Weg 5', postalCode: '83329', city: 'Waging am See' } };

export const FALL_B_LANG: HandzettelFall = fallBLang(1);

/** b mit langem Hallennamen und langer Adresse (@DR-031): beides bricht in der Spalte „Wo“ um, nichts wird gekürzt. */
export const HALLE_LANG = 'Dreifachturnhalle des Chiemgau-Gymnasiums Traunstein';
export const ADRESSE_LANG = { street: 'Dr.-Johann-Sebastian-Mayr-Straße 117', postalCode: '83278', city: 'Traunstein-Haslach' } as const;
export const FALL_B_HALLE: HandzettelFall = { ...FALL_B, name: 'b-lang', halle: HALLE_LANG, adresse: ADRESSE_LANG };

/**
 * b mit je Runde anderer Regel, damit jede Zeile von @DR-019 vorkommt: Halbfinale direkt Strafstoßschießen, Finale erst
 * Verlängerung, dann Strafstoßschießen, Spiel um Platz 3 Golden Goal (das Mockup hat überall Strafstoßschießen).
 */
export function mitRegelnDR019(fall: HandzettelFall = FALL_B): HandzettelFall {
  return { ...fall, entscheidung: { quarterfinal: 'shootout', semifinal: 'shootout', final: 'overtime-then-shootout', placement: 'goldenGoal' } };
}

/**
 * Stand am Turniertag für @DR-019 (a): Spiele 1–5 beendet, Spiel 6 ausgefallen, Spiel 7 läuft (mit `halbzeit` in der
 * Halbzeit), Rest geplant. Das Mockup zeigt nur die leere Fassung; diese Zustände ergänzen es.
 */
export function mitStandA(fall: HandzettelFall = FALL_A, halbzeit = false): HandzettelFall {
  const stand: Record<number, FallZustand> = {
    1: { status: 'finished', a: 2, b: 1 }, 2: { status: 'finished', a: 0, b: 0 }, 3: { status: 'finished', a: 1, b: 3 },
    4: { status: 'finished', a: 4, b: 2 }, 5: { status: 'finished', a: 10, b: 0 }, 6: { status: 'skipped' },
    7: { status: halbzeit ? 'paused' : 'running' },
  };
  return { ...fall, spiele: fall.spiele.map(s => (stand[s.nr] ? { ...s, zustand: stand[s.nr] } : s)) };
}

/** Feste Uhr der PDF-Tests (Stand-Zeile, @DR-001): Turniertag a/c, 17:35 (Spiel 7 läuft). */
export const FALL_NOW = new Date(2026, 10, 28, 17, 35);

/** b mit Ansprechpartner in der Fußzeile (@DR-044): eigener Fall, die Mockup-Fälle a, b, c bleiben unverändert. */
export const FALL_B_KONTAKT: HandzettelFall = { ...FALL_B, kontakt: 'Max Mustermann · 0171 1234567 · fussballjugend@tsv-waging.de' };

/** b mit Schiedsrichter-Spalte in Gruppenspielen und Finalrunde (@DR-037: dann reicht der Platz neben dem Ergebnis nicht). */
export const FALL_B_SR: HandzettelFall = {
  ...FALL_B,
  schiedsrichterNamen: ['Eins', 'Zwei', 'Drei'],
  spiele: FALL_B.spiele.map((spiel, i) => ({ ...spiel, sr: (i % 3) + 1 })),
  finale: (FALL_B.finale ?? []).map((spiel, i) => ({ ...spiel, sr: (i % 3) + 1 })),
};
