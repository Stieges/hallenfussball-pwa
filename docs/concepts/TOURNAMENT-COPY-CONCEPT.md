# Technisches Konzept: US-TOURNAMENT-COPY

**Version:** 1.0
**Erstellt:** 2025-12-22
**Geschätzter Aufwand:** 2-3 Stunden

---

## Übersicht

### Ziel
Turnierleiter sollen bestehende Turniere als Vorlage kopieren können, um nicht alle Einstellungen neu eingeben zu müssen.

### Architektur-Entscheidung

```
┌─────────────────────────────────────────────────────────────────┐
│                        KOPIER-FLOW                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   TournamentCard        CopyTournamentDialog       useTournaments│
│   ┌──────────┐          ┌──────────────────┐      ┌────────────┐│
│   │  [⋮]     │ ──────►  │ Name: [...]      │      │            ││
│   │ Kopieren │          │ □ Teams          │ ───► │saveTournament│
│   └──────────┘          │ □ Finals         │      │            ││
│                         │ [Kopieren]       │      └────────────┘│
│                         └──────────────────┘            │       │
│                                                         ▼       │
│                                                   localStorage  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Dateien

| Datei | Aktion | Beschreibung |
|-------|--------|--------------|
| `src/utils/tournamentCopy.ts` | NEU | Kopier-Logik |
| `src/components/dialogs/CopyTournamentDialog.tsx` | NEU | Dialog-Komponente |
| `src/components/TournamentCard.tsx` | ÄNDERN | onCopy Prop hinzufügen |
| `src/screens/DashboardScreen.tsx` | ÄNDERN | Copy-Handler + Dialog |

---

## 1. Utility: tournamentCopy.ts

### Pfad
`src/utils/tournamentCopy.ts`

### Interface

```typescript
/**
 * Options for copying a tournament
 */
export interface CopyTournamentOptions {
  /** New tournament name (required) */
  newName: string;

  /** Copy teams into groups (default: false) */
  includeTeams: boolean;

  /** Copy group structure - names, etc. (default: true) */
  includeGroupStructure: boolean;

  /** Copy finals configuration (default: true) */
  includeFinalsConfig: boolean;

  /** Copy referee configuration (default: true) */
  includeRefereeConfig: boolean;
}

export const DEFAULT_COPY_OPTIONS: Omit<CopyTournamentOptions, 'newName'> = {
  includeTeams: false,
  includeGroupStructure: true,
  includeFinalsConfig: true,
  includeRefereeConfig: true,
};
```

### Implementierung

```typescript
import { Tournament, Team, Match } from '../types/tournament';

/**
 * Creates a copy of an existing tournament
 *
 * COPIED:
 * - All tournament settings (sport, mode, durations, etc.)
 * - Placement logic
 * - Point system
 * - Metadata (location, organizer, ageClass)
 * - Groups structure (if includeGroupStructure)
 * - Teams (if includeTeams)
 * - Finals config (if includeFinalsConfig)
 * - Referee config (if includeRefereeConfig)
 *
 * NEVER COPIED:
 * - Matches (schedule is regenerated)
 * - Scores/Results
 * - Match status (scheduled/running/finished)
 * - Timer data
 * - Correction history
 * - createdAt/updatedAt (new timestamps)
 *
 * @param source - Tournament to copy from
 * @param options - Copy options
 * @returns New tournament with unique IDs
 */
export function copyTournament(
  source: Tournament,
  options: CopyTournamentOptions
): Tournament {
  const now = new Date().toISOString();

  // Generate new IDs for all entities
  const generateId = () => crypto.randomUUID();

  // Copy teams with new IDs (if requested)
  const copyTeam = (team: Team): Team => ({
    id: generateId(),
    name: team.name,
    group: team.group,
    // Don't copy: isRemoved, removedAt (team history)
  });

  // Build copied tournament
  const copy: Tournament = {
    // === NEW DATA ===
    id: generateId(),
    title: options.newName,
    status: 'draft', // Always start as draft
    createdAt: now,
    updatedAt: now,

    // === ALWAYS COPY: Sport & Mode ===
    sport: source.sport,
    sportId: source.sportId,
    tournamentType: source.tournamentType,
    mode: source.mode,

    // === ALWAYS COPY: Field & Team Config ===
    numberOfFields: source.numberOfFields,
    numberOfTeams: source.numberOfTeams,
    groupSystem: source.groupSystem,
    numberOfGroups: source.numberOfGroups,

    // === ALWAYS COPY: DFB Keys ===
    useDFBKeys: source.useDFBKeys,
    dfbKeyPattern: source.dfbKeyPattern,

    // === ALWAYS COPY: Timing ===
    groupPhaseGameDuration: source.groupPhaseGameDuration,
    groupPhaseBreakDuration: source.groupPhaseBreakDuration,
    finalRoundGameDuration: source.finalRoundGameDuration,
    finalRoundBreakDuration: source.finalRoundBreakDuration,
    breakBetweenPhases: source.breakBetweenPhases,
    gamePeriods: source.gamePeriods,
    halftimeBreak: source.halftimeBreak,
    minRestSlots: source.minRestSlots,

    // Legacy timing (for backwards compatibility)
    gameDuration: source.gameDuration,
    breakDuration: source.breakDuration,

    // === ALWAYS COPY: Placement Logic ===
    roundLogic: source.roundLogic,
    numberOfRounds: source.numberOfRounds,
    placementLogic: source.placementLogic.map(p => ({ ...p })),

    // === ALWAYS COPY: Bambini Settings ===
    isKidsTournament: source.isKidsTournament,
    hideScoresForPublic: source.hideScoresForPublic,
    hideRankingsForPublic: source.hideRankingsForPublic,
    resultMode: source.resultMode,

    // === ALWAYS COPY: Point System ===
    pointSystem: { ...source.pointSystem },

    // === ALWAYS COPY: Metadata ===
    ageClass: source.ageClass,
    date: source.date,
    timeSlot: source.timeSlot,
    startDate: source.startDate,
    startTime: source.startTime,
    location: { ...source.location },
    organizer: source.organizer,
    contactInfo: source.contactInfo ? { ...source.contactInfo } : undefined,

    // === CONDITIONAL: Finals ===
    finals: options.includeFinalsConfig
      ? { ...source.finals }
      : { final: false, thirdPlace: false, fifthSixth: false, seventhEighth: false },
    finalsConfig: options.includeFinalsConfig && source.finalsConfig
      ? { ...source.finalsConfig }
      : undefined,
    playoffConfig: options.includeFinalsConfig && source.playoffConfig
      ? {
          ...source.playoffConfig,
          matches: source.playoffConfig.matches.map(m => ({ ...m })),
        }
      : undefined,

    // === CONDITIONAL: Referees ===
    refereeConfig: options.includeRefereeConfig && source.refereeConfig
      ? {
          ...source.refereeConfig,
          refereeNames: source.refereeConfig.refereeNames
            ? { ...source.refereeConfig.refereeNames }
            : undefined,
          manualAssignments: undefined, // Never copy manual assignments
        }
      : undefined,

    // === CONDITIONAL: Teams & Groups ===
    teams: options.includeGroupStructure && options.includeTeams
      ? source.teams.filter(t => !t.isRemoved).map(copyTeam)
      : [],

    // === NEVER COPY ===
    matches: [], // Will be regenerated
    fieldAssignments: undefined, // Will be regenerated
    isExternal: false,
    externalSource: undefined,
    lastVisitedStep: undefined,
  };

  return copy;
}

/**
 * Generates a suggested name for the copy
 * @example "Hallenturnier 2025" → "Hallenturnier 2025 (Kopie)"
 * @example "Hallenturnier 2025 (Kopie)" → "Hallenturnier 2025 (Kopie 2)"
 */
export function generateCopyName(originalName: string): string {
  // Check if name already ends with (Kopie) or (Kopie N)
  const copyPattern = /\s*\(Kopie(?:\s+(\d+))?\)$/;
  const match = originalName.match(copyPattern);

  if (match) {
    const currentNumber = match[1] ? parseInt(match[1], 10) : 1;
    const baseName = originalName.replace(copyPattern, '');
    return `${baseName} (Kopie ${currentNumber + 1})`;
  }

  return `${originalName} (Kopie)`;
}

/**
 * Counts what will be copied for preview
 */
export interface CopyPreview {
  teamCount: number;
  groupCount: number;
  hasFinalsConfig: boolean;
  hasRefereeConfig: boolean;
}

export function getCopyPreview(source: Tournament): CopyPreview {
  return {
    teamCount: source.teams.filter(t => !t.isRemoved).length,
    groupCount: source.numberOfGroups || 0,
    hasFinalsConfig: !!source.finalsConfig || source.finals?.final,
    hasRefereeConfig: !!source.refereeConfig && source.refereeConfig.mode !== 'none',
  };
}
```

---

## 2. Dialog: CopyTournamentDialog.tsx

### Pfad
`src/components/dialogs/CopyTournamentDialog.tsx`

### Implementierung

```typescript
import { CSSProperties, useState, useMemo } from 'react';
import { Tournament } from '../../types/tournament';
import { Button, Dialog } from '../ui';
import { theme } from '../../styles/theme';
import {
  CopyTournamentOptions,
  DEFAULT_COPY_OPTIONS,
  generateCopyName,
  getCopyPreview,
} from '../../utils/tournamentCopy';

interface CopyTournamentDialogProps {
  isOpen: boolean;
  tournament: Tournament;
  onClose: () => void;
  onCopy: (options: CopyTournamentOptions) => void;
}

export const CopyTournamentDialog: React.FC<CopyTournamentDialogProps> = ({
  isOpen,
  tournament,
  onClose,
  onCopy,
}) => {
  const [newName, setNewName] = useState(() => generateCopyName(tournament.title));
  const [includeTeams, setIncludeTeams] = useState(DEFAULT_COPY_OPTIONS.includeTeams);
  const [includeGroupStructure, setIncludeGroupStructure] = useState(
    DEFAULT_COPY_OPTIONS.includeGroupStructure
  );
  const [includeFinalsConfig, setIncludeFinalsConfig] = useState(
    DEFAULT_COPY_OPTIONS.includeFinalsConfig
  );
  const [includeRefereeConfig, setIncludeRefereeConfig] = useState(
    DEFAULT_COPY_OPTIONS.includeRefereeConfig
  );

  const preview = useMemo(() => getCopyPreview(tournament), [tournament]);

  const handleSubmit = () => {
    if (!newName.trim()) return;

    onCopy({
      newName: newName.trim(),
      includeTeams,
      includeGroupStructure,
      includeFinalsConfig,
      includeRefereeConfig,
    });
  };

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.lg,
    minWidth: '400px',
  };

  const inputStyle: CSSProperties = {
    width: '100%',
    padding: theme.spacing.md,
    fontSize: theme.fontSizes.md,
    background: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.sm,
    color: theme.colors.text.primary,
  };

  const checkboxContainerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    background: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    border: `1px solid ${theme.colors.border}`,
  };

  const checkboxItemStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
    cursor: 'pointer',
  };

  const checkboxLabelStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xs,
  };

  const hintStyle: CSSProperties = {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.secondary,
  };

  const warningStyle: CSSProperties = {
    padding: theme.spacing.md,
    background: theme.colors.warning + '20',
    borderRadius: theme.borderRadius.sm,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.warning,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  };

  if (!isOpen) return null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Turnier kopieren"
    >
      <div style={containerStyle}>
        {/* Name Input */}
        <div>
          <label
            htmlFor="copy-name"
            style={{
              display: 'block',
              marginBottom: theme.spacing.sm,
              fontWeight: theme.fontWeights.medium,
            }}
          >
            Neuer Turniername
          </label>
          <input
            id="copy-name"
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={inputStyle}
            autoFocus
          />
        </div>

        {/* Copy Options */}
        <div>
          <label
            style={{
              display: 'block',
              marginBottom: theme.spacing.sm,
              fontWeight: theme.fontWeights.medium,
            }}
          >
            Was soll kopiert werden?
          </label>
          <div style={checkboxContainerStyle}>
            {/* Basic Settings - Always copied, shown as disabled */}
            <div style={{ ...checkboxItemStyle, opacity: 0.7 }}>
              <input type="checkbox" checked disabled />
              <div style={checkboxLabelStyle}>
                <span>Grundeinstellungen</span>
                <span style={hintStyle}>
                  Sportart, Spielzeit, Felder, Punkte-System
                </span>
              </div>
            </div>

            {/* Group Structure */}
            <label style={checkboxItemStyle}>
              <input
                type="checkbox"
                checked={includeGroupStructure}
                onChange={(e) => {
                  setIncludeGroupStructure(e.target.checked);
                  if (!e.target.checked) setIncludeTeams(false);
                }}
              />
              <div style={checkboxLabelStyle}>
                <span>Gruppen-Struktur</span>
                <span style={hintStyle}>
                  {preview.groupCount} Gruppe{preview.groupCount !== 1 ? 'n' : ''}
                </span>
              </div>
            </label>

            {/* Teams */}
            <label
              style={{
                ...checkboxItemStyle,
                opacity: includeGroupStructure ? 1 : 0.5,
                cursor: includeGroupStructure ? 'pointer' : 'not-allowed',
                marginLeft: theme.spacing.lg,
              }}
            >
              <input
                type="checkbox"
                checked={includeTeams && includeGroupStructure}
                onChange={(e) => setIncludeTeams(e.target.checked)}
                disabled={!includeGroupStructure}
              />
              <div style={checkboxLabelStyle}>
                <span>Teams übernehmen</span>
                <span style={hintStyle}>
                  {preview.teamCount} Team{preview.teamCount !== 1 ? 's' : ''} (ohne Ergebnisse)
                </span>
              </div>
            </label>

            {/* Finals Config */}
            {preview.hasFinalsConfig && (
              <label style={checkboxItemStyle}>
                <input
                  type="checkbox"
                  checked={includeFinalsConfig}
                  onChange={(e) => setIncludeFinalsConfig(e.target.checked)}
                />
                <div style={checkboxLabelStyle}>
                  <span>Finalrunden-Konfiguration</span>
                  <span style={hintStyle}>
                    Halbfinale, Finale, Platzierungsspiele
                  </span>
                </div>
              </label>
            )}

            {/* Referee Config */}
            {preview.hasRefereeConfig && (
              <label style={checkboxItemStyle}>
                <input
                  type="checkbox"
                  checked={includeRefereeConfig}
                  onChange={(e) => setIncludeRefereeConfig(e.target.checked)}
                />
                <div style={checkboxLabelStyle}>
                  <span>Schiedsrichter-Konfiguration</span>
                  <span style={hintStyle}>
                    Modus und Schiri-Namen (ohne Zuweisungen)
                  </span>
                </div>
              </label>
            )}
          </div>
        </div>

        {/* Warning */}
        <div style={warningStyle}>
          <span>⚠️</span>
          <span>Ergebnisse und Spielplan werden nie kopiert.</span>
        </div>

        {/* Actions */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: theme.spacing.md,
          }}
        >
          <Button variant="secondary" onClick={onClose}>
            Abbrechen
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!newName.trim()}
          >
            Turnier kopieren
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
```

---

## 3. Änderungen: TournamentCard.tsx

### Erweiterung Props

```diff
interface TournamentCardProps {
  tournament: Tournament;
  onClick?: () => void;
  categoryLabel?: string;
  onDelete?: () => void;
+ onCopy?: () => void;    // NEW: Copy callback
}
```

### Erweiterung UI

Option A: **Drei-Punkte-Menü** (empfohlen für mehr Aktionen später)

```typescript
// State for dropdown
const [showMenu, setShowMenu] = useState(false);

// Menu button
<button
  onClick={(e) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  }}
  style={menuButtonStyle}
  aria-label="Turnier-Aktionen"
>
  ⋮
</button>

// Dropdown menu
{showMenu && (
  <div style={dropdownStyle}>
    <button onClick={() => { onCopy?.(); setShowMenu(false); }}>
      📋 Kopieren
    </button>
    <button onClick={() => { onDelete?.(); setShowMenu(false); }}>
      🗑️ Löschen
    </button>
  </div>
)}
```

Option B: **Zusätzlicher Button** (schneller implementiert)

```typescript
{/* Copy Button */}
{onCopy && (
  <button
    style={copyButtonStyle}
    onClick={(e) => {
      e.stopPropagation();
      onCopy();
    }}
    aria-label={`Turnier "${tournament.title}" kopieren`}
  >
    <span aria-hidden="true">📋</span>
    <span>Kopieren</span>
  </button>
)}
```

---

## 4. Änderungen: DashboardScreen.tsx

### Neue Props & State

```diff
interface DashboardScreenProps {
  tournaments: Tournament[];
  onCreateNew: () => void;
  onTournamentClick: (tournament: Tournament) => void;
  onDeleteTournament: (id: string, title: string) => void;
  onImportTournament: (tournament: Tournament) => void;
+ onCopyTournament: (tournament: Tournament, options: CopyTournamentOptions) => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  ...
+ onCopyTournament,
}) => {
  const [showImportDialog, setShowImportDialog] = useState(false);
+ const [copyDialogTournament, setCopyDialogTournament] = useState<Tournament | null>(null);
```

### TournamentCard Integration

```diff
<TournamentCard
  key={tournament.id}
  tournament={tournament}
  categoryLabel={categoryLabel}
  onClick={() => onTournamentClick(tournament)}
  onDelete={allowDelete ? () => onDeleteTournament(tournament.id, tournament.title) : undefined}
+ onCopy={() => setCopyDialogTournament(tournament)}
/>
```

### Copy Dialog

```typescript
{/* Copy Tournament Dialog */}
{copyDialogTournament && (
  <CopyTournamentDialog
    isOpen={!!copyDialogTournament}
    tournament={copyDialogTournament}
    onClose={() => setCopyDialogTournament(null)}
    onCopy={(options) => {
      onCopyTournament(copyDialogTournament, options);
      setCopyDialogTournament(null);
    }}
  />
)}
```

---

## 5. Änderungen: App.tsx

### Copy Handler

```typescript
const handleCopyTournament = async (
  source: Tournament,
  options: CopyTournamentOptions
) => {
  try {
    const copy = copyTournament(source, options);
    await saveTournament(copy);

    // Optional: Navigate to new tournament
    navigate(`/tournament/${copy.id}`);

    // Show success message
    showToast(`"${copy.title}" wurde erstellt`);
  } catch (error) {
    console.error('Failed to copy tournament:', error);
    showToast('Fehler beim Kopieren des Turniers', 'error');
  }
};

// In JSX:
<DashboardScreen
  ...
  onCopyTournament={handleCopyTournament}
/>
```

---

## Testablauf

### Unit Tests (tournamentCopy.test.ts)

```typescript
describe('copyTournament', () => {
  it('should generate new IDs for tournament and teams', () => {
    const source = createMockTournament();
    const copy = copyTournament(source, { newName: 'Copy', ...DEFAULT_COPY_OPTIONS });

    expect(copy.id).not.toBe(source.id);
    expect(copy.teams.every(t => !source.teams.find(s => s.id === t.id))).toBe(true);
  });

  it('should not copy matches or results', () => {
    const source = createMockTournament({ matches: [mockMatch] });
    const copy = copyTournament(source, { newName: 'Copy', includeTeams: true, ... });

    expect(copy.matches).toHaveLength(0);
  });

  it('should set status to draft', () => {
    const source = createMockTournament({ status: 'published' });
    const copy = copyTournament(source, { newName: 'Copy', ... });

    expect(copy.status).toBe('draft');
  });

  it('should respect includeTeams option', () => {
    const source = createMockTournament({ teams: [mockTeam1, mockTeam2] });

    const withTeams = copyTournament(source, { newName: 'Copy', includeTeams: true, ... });
    expect(withTeams.teams).toHaveLength(2);

    const withoutTeams = copyTournament(source, { newName: 'Copy', includeTeams: false, ... });
    expect(withoutTeams.teams).toHaveLength(0);
  });
});

describe('generateCopyName', () => {
  it('should append (Kopie) to name', () => {
    expect(generateCopyName('Turnier 2025')).toBe('Turnier 2025 (Kopie)');
  });

  it('should increment copy number', () => {
    expect(generateCopyName('Turnier 2025 (Kopie)')).toBe('Turnier 2025 (Kopie 2)');
    expect(generateCopyName('Turnier 2025 (Kopie 2)')).toBe('Turnier 2025 (Kopie 3)');
  });
});
```

### E2E Test (Manuell)

1. Dashboard öffnen
2. Turnier-Karte → Kopieren klicken
3. Dialog prüfen: Name, Checkboxen, Vorschau-Zahlen
4. Name ändern, Teams deselektieren
5. "Turnier kopieren" klicken
6. Verifizieren:
   - Neues Turnier im Dashboard (als Entwurf)
   - Einstellungen übernommen
   - Teams nicht übernommen
   - Kein Spielplan

---

## Zeitplan

| Phase | Aufgabe | Zeit |
|-------|---------|------|
| 1 | `tournamentCopy.ts` erstellen | 30 min |
| 2 | `CopyTournamentDialog.tsx` erstellen | 45 min |
| 3 | `TournamentCard.tsx` erweitern | 15 min |
| 4 | `DashboardScreen.tsx` erweitern | 20 min |
| 5 | `App.tsx` Handler hinzufügen | 10 min |
| 6 | Testen & Bugfixes | 30 min |
| **Gesamt** | | **~2.5h** |

---

## Erweiterungen (Phase 2+3)

### Phase 2: Erweiterte Optionen

- Checkbox "Schiedsrichter-Namen beibehalten"
- Dropdown "Datum anpassen" (heute, morgen, nächste Woche)
- Preview der kopierten Daten

### Phase 3: Vorlagen-System

```typescript
interface TournamentTemplate {
  id: string;
  name: string;
  description?: string;
  baseTournament: Partial<Tournament>;
  createdAt: string;
  isBuiltIn: boolean; // System-Vorlagen (z.B. "Standard Hallenturnier")
}

// localStorage key: 'hallenfussball_templates'
```

- "Als Vorlage speichern" Button
- Vorlagen-Auswahl beim Erstellen neuer Turniere
- Built-in Vorlagen (Standard Hallenturnier, Bambini-Turnier, etc.)
