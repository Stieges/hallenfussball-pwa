/**
 * Import Templates
 *
 * Template definitions and download logic for tournament import.
 * Moved here to keep ImportDialog focused on step logic.
 */

// Schema/Template Examples - Vollständiges Turnier-Schema
export const JSON_TEMPLATE = {
  // === METADATEN (Step 3) ===
  title: "TSV Musterstadt Hallencup 2025",
  organizer: "TSV Musterstadt e.V.",
  ageClass: "U12",
  date: "2025-03-15",
  timeSlot: "09:00",
  startDate: "2025-03-15",
  startTime: "09:00",
  location: {
    name: "Dreifachturnhalle Musterstadt",
    street: "Sportplatzweg 5",
    postalCode: "12345",
    city: "Musterstadt",
    country: "Deutschland"
  },
  contactInfo: {
    name: "Max Mustermann",
    email: "turniere@tsv-musterstadt.de",
    phone: "+49 123 456789",
    website: "https://tsv-musterstadt.de"
  },

  // === SPORTART & TYP (Step 1) ===
  sport: "football",              // "football" | "other"
  tournamentType: "classic",      // "classic" | "bambini"

  // === MODUS & SYSTEM (Step 2) ===
  mode: "classic",                // "classic" | "miniFussball"
  numberOfFields: 2,
  numberOfTeams: 8,
  groupSystem: "groupsAndFinals", // "roundRobin" | "groupsAndFinals"
  numberOfGroups: 2,

  // Spielzeiten Gruppenphase
  groupPhaseGameDuration: 10,     // Minuten
  groupPhaseBreakDuration: 2,     // Pause zwischen Spielen
  gamePeriods: 2,                 // 1 = durchgehend, 2 = Halbzeiten
  halftimeBreak: 1,               // Pause zwischen Halbzeiten

  // Spielzeiten Finalrunde
  finalRoundGameDuration: 12,
  finalRoundBreakDuration: 3,
  breakBetweenPhases: 10,         // Pause vor Finalrunde

  // Mindest-Pause zwischen Spielen pro Team (Slots)
  minRestSlots: 1,

  // === PLATZIERUNGSLOGIK ===
  placementLogic: [
    { id: "points", label: "Punkte", enabled: true },
    { id: "goalDifference", label: "Tordifferenz", enabled: true },
    { id: "goalsFor", label: "Erzielte Tore", enabled: true },
    { id: "directComparison", label: "Direkter Vergleich", enabled: false }
  ],

  // === PUNKTESYSTEM ===
  pointSystem: {
    win: 3,
    draw: 1,
    loss: 0
  },

  // === FINALRUNDEN-KONFIGURATION ===
  finalsConfig: {
    preset: "top-4",              // "none" | "final-only" | "top-4" | "top-8" | "all-places"
    parallelSemifinals: false,
    parallelQuarterfinals: false
  },

  // Legacy Finals (für Abwärtskompatibilität)
  finals: {
    final: true,
    thirdPlace: true,
    fifthSixth: false,
    seventhEighth: false
  },

  // === SCHIEDSRICHTER ===
  refereeConfig: {
    mode: "organizer",            // "none" | "organizer" | "teams"
    numberOfReferees: 2,
    maxConsecutiveMatches: 2,
    refereeNames: {
      1: "Hans Müller",
      2: "Peter Schmidt"
    },
    finalsRefereeMode: "neutralTeams"
  },

  // === BAMBINI-EINSTELLUNGEN ===
  isKidsTournament: false,
  hideScoresForPublic: false,
  hideRankingsForPublic: false,
  resultMode: "goals",            // "goals" | "winLossOnly"

  // === TEAMS (Step 4) ===
  teams: [
    { id: "t1", name: "TSV Musterstadt", group: "A" },
    { id: "t2", name: "FC Bayern U12", group: "A" },
    { id: "t3", name: "TSV 1860 U12", group: "A" },
    { id: "t4", name: "SpVgg Unterhaching U12", group: "A" },
    { id: "t5", name: "SC Freiburg U12", group: "B" },
    { id: "t6", name: "VfB Stuttgart U12", group: "B" },
    { id: "t7", name: "Borussia Dortmund U12", group: "B" },
    { id: "t8", name: "RB Leipzig U12", group: "B" }
  ],

  // === SPIELE (optional - werden sonst generiert) ===
  // slot = Zeit-Slot (0-basiert), round = Runden-Nummer (1-basiert)
  // Bei mehreren Feldern können mehrere Spiele im selben slot parallel laufen
  matches: [
    // Gruppe A - Runde 1 (Slot 0)
    { id: "m1", round: 1, slot: 0, field: 1, teamA: "t1", teamB: "t2", group: "A" },
    { id: "m2", round: 1, slot: 0, field: 2, teamA: "t3", teamB: "t4", group: "A" },
    // Gruppe B - Runde 1 (Slot 1)
    { id: "m3", round: 2, slot: 1, field: 1, teamA: "t5", teamB: "t6", group: "B" },
    { id: "m4", round: 2, slot: 1, field: 2, teamA: "t7", teamB: "t8", group: "B" },
    // Weitere Gruppenspiele...
    { id: "m5", round: 3, slot: 2, field: 1, teamA: "t1", teamB: "t3", group: "A" },
    { id: "m6", round: 3, slot: 2, field: 2, teamA: "t2", teamB: "t4", group: "A" },
    { id: "m7", round: 4, slot: 3, field: 1, teamA: "t5", teamB: "t7", group: "B" },
    { id: "m8", round: 4, slot: 3, field: 2, teamA: "t6", teamB: "t8", group: "B" },
    // Mit Ergebnissen (optional)
    { id: "m9", round: 5, slot: 4, field: 1, teamA: "t1", teamB: "t4", group: "A", scoreA: 3, scoreB: 1 },
    { id: "m10", round: 5, slot: 4, field: 2, teamA: "t2", teamB: "t3", group: "A", scoreA: 2, scoreB: 2 }
  ]
};

export const CSV_TEMPLATE = `Team,Gruppe
FC Bayern U12,A
TSV 1860 U12,A
SC Freiburg U12,B
VfB Stuttgart U12,B
Borussia Dortmund U12,A
RB Leipzig U12,B`;

/**
 * Download a template file (JSON or CSV)
 */
export function downloadTemplate(type: 'json' | 'csv'): void {
  let content: string;
  let filename: string;
  let mimeType: string;

  if (type === 'json') {
    content = JSON.stringify(JSON_TEMPLATE, null, 2);
    filename = 'turnier-vorlage.json';
    mimeType = 'application/json';
  } else {
    content = CSV_TEMPLATE;
    filename = 'teams-vorlage.csv';
    mimeType = 'text/csv';
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
