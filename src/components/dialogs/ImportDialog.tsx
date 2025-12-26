/**
 * ImportDialog Component (US-005)
 *
 * Multi-step dialog for importing external tournament data.
 * Steps: select -> warnings -> preview -> success
 */

import { useState, useRef, CSSProperties, DragEvent } from 'react';
import { Dialog } from './Dialog';
import { Button } from '../ui/Button';
import { Icons } from '../ui/Icons';
import { borderRadius, colors, fontSizes, spacing } from '../../design-tokens';
import { Tournament, ImportValidationResult } from '../../types/tournament';
import { validateAndParseTournamentImport, detectImportFormat } from '../../utils/tournamentImporter';
import { formatTournamentDate } from '../../utils/tournamentCategories';

export interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (tournament: Tournament) => void;
}

type ImportStep = 'select' | 'warnings' | 'preview' | 'success';

export const ImportDialog = ({
  isOpen,
  onClose,
  onImportComplete,
}: ImportDialogProps) => {
  const [step, setStep] = useState<ImportStep>('select');
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string>('');
  const [validationResult, setValidationResult] = useState<ImportValidationResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setStep('select');
    setIsDragging(false);
    setError('');
    setValidationResult(null);
    setSelectedFile(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const processFile = async (file: File) => {
    setSelectedFile(file);
    setError('');

    try {
      const content = await file.text();
      const format = detectImportFormat(file.name, content);

      if (!format) {
        setError('Unbekanntes Dateiformat. Bitte eine JSON- oder CSV-Datei auswählen.');
        return;
      }

      const result = validateAndParseTournamentImport(content, format);
      setValidationResult(result);

      if (!result.isValid) {
        const errorMessages = result.errors.map(e => e.message).join(', ');
        setError(errorMessages);
        return;
      }

      // If there are warnings, show them first
      if (result.warnings.length > 0) {
        setStep('warnings');
      } else {
        setStep('preview');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Lesen der Datei');
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      void processFile(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      void processFile(files[0]);
    }
  };

  const handleImport = () => {
    if (validationResult?.tournament) {
      setStep('success');
    }
  };

  const handleComplete = () => {
    if (validationResult?.tournament) {
      onImportComplete(validationResult.tournament);
      handleClose();
    }
  };

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.xl,
  };

  const getStepTitle = (): string => {
    switch (step) {
      case 'select': return 'Turnier importieren';
      case 'warnings': return 'Hinweise zum Import';
      case 'preview': return 'Import-Vorschau';
      case 'success': return 'Import erfolgreich';
      default: return 'Import';
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={handleClose} title={getStepTitle()} maxWidth="550px">
      <div style={containerStyle}>
        {step === 'select' && (
          <SelectStep
            isDragging={isDragging}
            error={error}
            selectedFile={selectedFile}
            fileInputRef={fileInputRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onFileSelect={handleFileSelect}
            onButtonClick={() => fileInputRef.current?.click()}
          />
        )}

        {step === 'warnings' && validationResult && (
          <WarningsStep
            warnings={validationResult.warnings}
            onBack={() => setStep('select')}
            onContinue={() => setStep('preview')}
          />
        )}

        {step === 'preview' && validationResult?.tournament && (
          <PreviewStep
            tournament={validationResult.tournament}
            onBack={() => validationResult.warnings.length > 0 ? setStep('warnings') : setStep('select')}
            onImport={handleImport}
          />
        )}

        {step === 'success' && validationResult?.tournament && (
          <SuccessStep
            tournament={validationResult.tournament}
            onComplete={handleComplete}
          />
        )}
      </div>
    </Dialog>
  );
};

// Schema/Template Examples - Vollständiges Turnier-Schema
const JSON_TEMPLATE = {
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
  matches: [
    // Gruppe A - Runde 1
    { id: "m1", round: 1, field: 1, teamA: "t1", teamB: "t2", group: "A" },
    { id: "m2", round: 1, field: 2, teamA: "t3", teamB: "t4", group: "A" },
    // Gruppe B - Runde 1
    { id: "m3", round: 2, field: 1, teamA: "t5", teamB: "t6", group: "B" },
    { id: "m4", round: 2, field: 2, teamA: "t7", teamB: "t8", group: "B" },
    // Weitere Gruppenspiele...
    { id: "m5", round: 3, field: 1, teamA: "t1", teamB: "t3", group: "A" },
    { id: "m6", round: 3, field: 2, teamA: "t2", teamB: "t4", group: "A" },
    { id: "m7", round: 4, field: 1, teamA: "t5", teamB: "t7", group: "B" },
    { id: "m8", round: 4, field: 2, teamA: "t6", teamB: "t8", group: "B" },
    // Mit Ergebnissen (optional)
    { id: "m9", round: 5, field: 1, teamA: "t1", teamB: "t4", group: "A", scoreA: 3, scoreB: 1 },
    { id: "m10", round: 5, field: 2, teamA: "t2", teamB: "t3", group: "A", scoreA: 2, scoreB: 2 }
  ]
};

const CSV_TEMPLATE = `Team,Gruppe
FC Bayern U12,A
TSV 1860 U12,A
SC Freiburg U12,B
VfB Stuttgart U12,B
Borussia Dortmund U12,A
RB Leipzig U12,B`;

const downloadTemplate = (type: 'json' | 'csv') => {
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
};

// Step Components

interface SelectStepProps {
  isDragging: boolean;
  error: string;
  selectedFile: File | null;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (e: DragEvent<HTMLDivElement>) => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onButtonClick: () => void;
}

const SelectStep = ({
  isDragging,
  error,
  selectedFile,
  fileInputRef,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileSelect,
  onButtonClick,
}: SelectStepProps) => {
  const dropZoneStyle: CSSProperties = {
    border: `2px dashed ${isDragging ? colors.primary : colors.border}`,
    borderRadius: borderRadius.md,
    padding: spacing.xxl,
    textAlign: 'center',
    background: isDragging ? 'rgba(0,230,118,0.1)' : 'transparent',
    transition: 'all 0.2s ease',
    cursor: 'pointer',
  };

  const iconStyle: CSSProperties = {
    fontSize: '48px',
    marginBottom: spacing.md,
  };

  const hintStyle: CSSProperties = {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.md,
  };

  const errorStyle: CSSProperties = {
    padding: spacing.md,
    background: 'rgba(255,82,82,0.15)',
    border: `1px solid ${colors.error}`,
    borderRadius: borderRadius.sm,
    color: colors.error,
    fontSize: fontSizes.sm,
  };

  return (
    <>
      <div
        style={dropZoneStyle}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={onButtonClick}
      >
        <div style={iconStyle}>
          {isDragging ? '📂' : '📁'}
        </div>
        <p style={{ color: colors.textPrimary, fontSize: fontSizes.md, margin: 0 }}>
          {isDragging ? 'Datei hier ablegen' : 'Datei hierher ziehen oder klicken'}
        </p>
        <p style={hintStyle}>
          Unterstützte Formate: JSON, CSV
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.csv"
        onChange={onFileSelect}
        style={{ display: 'none' }}
      />

      {selectedFile && !error && (
        <div style={{ fontSize: fontSizes.sm, color: colors.textSecondary }}>
          Ausgewählt: {selectedFile.name}
        </div>
      )}

      {error && (
        <div style={errorStyle}>
          {error}
        </div>
      )}

      <Button
        variant="secondary"
        size="md"
        icon={<Icons.Upload />}
        onClick={onButtonClick}
        fullWidth
      >
        Datei auswählen
      </Button>

      {/* Template Downloads */}
      <div style={{
        marginTop: spacing.lg,
        paddingTop: spacing.lg,
        borderTop: `1px solid ${colors.border}`,
      }}>
        <p style={{
          fontSize: fontSizes.sm,
          color: colors.textSecondary,
          margin: `0 0 ${spacing.md} 0`,
          textAlign: 'center',
        }}>
          Vorlage herunterladen:
        </p>
        <div style={{ display: 'flex', gap: spacing.md }}>
          <Button
            variant="secondary"
            size="sm"
            icon={<Icons.Download />}
            onClick={() => downloadTemplate('json')}
            fullWidth
          >
            JSON-Vorlage
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<Icons.Download />}
            onClick={() => downloadTemplate('csv')}
            fullWidth
          >
            CSV-Vorlage
          </Button>
        </div>
        <p style={{
          fontSize: fontSizes.xs,
          color: colors.textMuted,
          margin: `${spacing.sm} 0 0 0`,
          textAlign: 'center',
          lineHeight: '1.4',
        }}>
          JSON: Komplettes Turnier mit Teams & Spielen<br />
          CSV: Einfache Team-Liste (Spielplan wird generiert)
        </p>
      </div>
    </>
  );
};

interface WarningsStepProps {
  warnings: ImportValidationResult['warnings'];
  onBack: () => void;
  onContinue: () => void;
}

const WarningsStep = ({ warnings, onBack, onContinue }: WarningsStepProps) => {
  const warningsContainerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.sm,
    maxHeight: '300px',
    overflowY: 'auto',
  };

  const warningItemStyle = (severity: 'info' | 'warning'): CSSProperties => ({
    padding: spacing.md,
    background: severity === 'warning' ? 'rgba(255,145,0,0.15)' : 'rgba(0,176,255,0.1)',
    border: `1px solid ${severity === 'warning' ? 'rgba(255,145,0,0.4)' : 'rgba(0,176,255,0.3)'}`,
    borderRadius: borderRadius.sm,
    fontSize: fontSizes.sm,
    color: severity === 'warning' ? colors.warning : colors.secondary,
    display: 'flex',
    alignItems: 'flex-start',
    gap: spacing.sm,
  });

  const buttonGroupStyle: CSSProperties = {
    display: 'flex',
    gap: spacing.md,
    marginTop: spacing.md,
  };

  const infoWarnings = warnings.filter(w => w.severity === 'info');
  const realWarnings = warnings.filter(w => w.severity === 'warning');

  return (
    <>
      <p style={{ color: colors.textSecondary, fontSize: fontSizes.sm, margin: 0 }}>
        Beim Import wurden folgende Hinweise festgestellt:
      </p>

      <div style={warningsContainerStyle}>
        {realWarnings.map((warning, index) => (
          <div key={`warning-${index}`} style={warningItemStyle('warning')}>
            <span>⚠️</span>
            <span>{warning.message}</span>
          </div>
        ))}
        {infoWarnings.map((warning, index) => (
          <div key={`info-${index}`} style={warningItemStyle('info')}>
            <span>ℹ️</span>
            <span>{warning.message}</span>
          </div>
        ))}
      </div>

      <div style={buttonGroupStyle}>
        <Button variant="secondary" size="md" onClick={onBack} fullWidth>
          Zurück
        </Button>
        <Button variant="primary" size="md" onClick={onContinue} fullWidth>
          Trotzdem importieren
        </Button>
      </div>
    </>
  );
};

interface PreviewStepProps {
  tournament: Tournament;
  onBack: () => void;
  onImport: () => void;
}

const PreviewStep = ({ tournament, onBack, onImport }: PreviewStepProps) => {
  const previewContainerStyle: CSSProperties = {
    background: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    border: `1px solid ${colors.border}`,
  };

  const previewGridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: spacing.md,
  };

  const previewItemStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.xs,
  };

  const labelStyle: CSSProperties = {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  };

  const valueStyle: CSSProperties = {
    fontSize: fontSizes.md,
    color: colors.textPrimary,
  };

  const buttonGroupStyle: CSSProperties = {
    display: 'flex',
    gap: spacing.md,
    marginTop: spacing.md,
  };

  return (
    <>
      <div style={previewContainerStyle}>
        <h3 style={{ color: colors.textPrimary, fontSize: fontSizes.lg, margin: `0 0 ${spacing.lg} 0` }}>
          {tournament.title}
        </h3>

        <div style={previewGridStyle}>
          <div style={previewItemStyle}>
            <span style={labelStyle}>Datum</span>
            <span style={valueStyle}>{formatTournamentDate(tournament)}</span>
          </div>
          <div style={previewItemStyle}>
            <span style={labelStyle}>Ort</span>
            <span style={valueStyle}>{tournament.location.name || '-'}</span>
          </div>
          <div style={previewItemStyle}>
            <span style={labelStyle}>Teams</span>
            <span style={valueStyle}>{tournament.teams.length}</span>
          </div>
          <div style={previewItemStyle}>
            <span style={labelStyle}>Spiele</span>
            <span style={valueStyle}>{tournament.matches.length}</span>
          </div>
          <div style={previewItemStyle}>
            <span style={labelStyle}>Altersklasse</span>
            <span style={valueStyle}>{tournament.ageClass}</span>
          </div>
          <div style={previewItemStyle}>
            <span style={labelStyle}>Quelle</span>
            <span style={{ ...valueStyle, color: colors.statusExternal }}>
              {tournament.externalSource}
            </span>
          </div>
        </div>
      </div>

      <div style={buttonGroupStyle}>
        <Button variant="secondary" size="md" onClick={onBack} fullWidth>
          Zurück
        </Button>
        <Button variant="primary" size="md" onClick={onImport} fullWidth>
          Importieren
        </Button>
      </div>
    </>
  );
};

interface SuccessStepProps {
  tournament: Tournament;
  onComplete: () => void;
}

const SuccessStep = ({ tournament, onComplete }: SuccessStepProps) => {
  const successContainerStyle: CSSProperties = {
    textAlign: 'center',
    padding: spacing.xl,
  };

  const iconStyle: CSSProperties = {
    fontSize: '64px',
    marginBottom: spacing.lg,
  };

  const messageStyle: CSSProperties = {
    fontSize: fontSizes.lg,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  };

  const subMessageStyle: CSSProperties = {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  };

  return (
    <>
      <div style={successContainerStyle}>
        <div style={iconStyle}>✅</div>
        <p style={messageStyle}>
          "{tournament.title}" wurde erfolgreich importiert!
        </p>
        <p style={subMessageStyle}>
          Das Turnier wurde als Entwurf gespeichert und kann jetzt bearbeitet werden.
        </p>
      </div>

      <Button variant="primary" size="md" onClick={onComplete} fullWidth>
        Zum Turnier
      </Button>
    </>
  );
};
