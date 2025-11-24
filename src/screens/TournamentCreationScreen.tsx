import { useState } from 'react';
import { Button, Icons } from '../components/ui';
import { ProgressBar } from '../components/ProgressBar';
import {
  Step1_SportAndType,
  Step2_ModeAndSystem,
  Step3_Metadata,
  Step4_Teams,
  Step5_Overview,
} from '../features/tournament-creation';
import { Tournament, TournamentType, PlacementCriterion } from '../types/tournament';
import { useTournaments } from '../hooks/useTournaments';
import { generateMatches } from '../utils/matchGenerator';
import { theme } from '../styles/theme';

interface TournamentCreationScreenProps {
  onBack: () => void;
  existingTournament?: Tournament;
}

const getDefaultFormData = (): Partial<Tournament> => ({
  sport: 'football',
  tournamentType: 'classic',
  mode: 'classic',
  numberOfFields: 1,
  groupSystem: 'roundRobin',
  numberOfGroups: 2,
  gameDuration: 10,
  breakDuration: 5,
  placementLogic: [
    { id: 'points', label: 'Punkte', enabled: true },
    { id: 'goalDifference', label: 'Tordifferenz', enabled: true },
    { id: 'goalsFor', label: 'Erzielte Tore', enabled: true },
    { id: 'directComparison', label: 'Direkter Vergleich', enabled: false },
  ],
  finals: {
    final: false,
    thirdPlace: false,
    fifthSixth: false,
    seventhEighth: false,
  },
  isKidsTournament: false,
  hideScoresForPublic: false,
  hideRankingsForPublic: false,
  resultMode: 'goals',
  pointSystem: {
    win: 3,
    draw: 1,
    loss: 0,
  },
  title: '',
  ageClass: 'U11',
  date: new Date().toISOString().split('T')[0],
  timeSlot: '09:00 - 16:00',
  location: '',
  teams: [],
});

export const TournamentCreationScreen: React.FC<TournamentCreationScreenProps> = ({
  onBack,
  existingTournament,
}) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<Partial<Tournament>>(
    existingTournament || getDefaultFormData()
  );
  const { saveTournament } = useTournaments();

  const updateForm = <K extends keyof Tournament>(field: K, value: Tournament[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleTournamentTypeChange = (newType: TournamentType) => {
    const currentType = formData.tournamentType;

    if (currentType && currentType !== newType) {
      const confirmed = window.confirm(
        `Möchtest du wirklich zu "${newType === 'classic' ? 'Klassisches Turnier' : 'Bambini-Turnier'}" wechseln?\n\nDie Einstellungen werden angepasst.`
      );
      if (!confirmed) return;
    }

    if (newType === 'bambini') {
      setFormData((prev) => ({
        ...prev,
        tournamentType: newType,
        isKidsTournament: true,
        hideScoresForPublic: true,
        hideRankingsForPublic: true,
        resultMode: 'winLossOnly',
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        tournamentType: newType,
        isKidsTournament: false,
        hideScoresForPublic: false,
        hideRankingsForPublic: false,
        resultMode: 'goals',
      }));
    }
  };

  const movePlacementLogic = (index: number, direction: number) => {
    if (!formData.placementLogic) return;

    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= formData.placementLogic.length) return;

    const newLogic = [...formData.placementLogic];
    [newLogic[index], newLogic[newIndex]] = [newLogic[newIndex], newLogic[index]];
    updateForm('placementLogic', newLogic);
  };

  const togglePlacementLogic = (index: number) => {
    if (!formData.placementLogic) return;

    const newLogic = [...formData.placementLogic];
    newLogic[index] = { ...newLogic[index], enabled: !newLogic[index].enabled };
    updateForm('placementLogic', newLogic);
  };

  const addTeam = () => {
    const newTeam = {
      id: `team-${Date.now()}`,
      name: `Team ${(formData.teams?.length || 0) + 1}`,
    };
    updateForm('teams', [...(formData.teams || []), newTeam]);
  };

  const removeTeam = (id: string) => {
    updateForm('teams', formData.teams?.filter((t) => t.id !== id) || []);
  };

  const updateTeam = (id: string, updates: Partial<Tournament['teams'][0]>) => {
    updateForm(
      'teams',
      formData.teams?.map((t) => (t.id === id ? { ...t, ...updates } : t)) || []
    );
  };

  const handleSave = () => {
    const tournament: Tournament = {
      id: existingTournament?.id || `tournament-${Date.now()}`,
      sport: formData.sport || 'football',
      tournamentType: formData.tournamentType || 'classic',
      mode: formData.mode || 'classic',
      numberOfFields: formData.numberOfFields || 1,
      groupSystem: formData.groupSystem,
      numberOfGroups: formData.numberOfGroups,
      gameDuration: formData.gameDuration || 10,
      breakDuration: formData.breakDuration,
      roundLogic: formData.roundLogic,
      numberOfRounds: formData.numberOfRounds,
      placementLogic: formData.placementLogic || [],
      finals: formData.finals || { final: false, thirdPlace: false, fifthSixth: false, seventhEighth: false },
      isKidsTournament: formData.isKidsTournament || false,
      hideScoresForPublic: formData.hideScoresForPublic || false,
      hideRankingsForPublic: formData.hideRankingsForPublic || false,
      resultMode: formData.resultMode || 'goals',
      pointSystem: formData.pointSystem || { win: 3, draw: 1, loss: 0 },
      title: formData.title || 'Unbenanntes Turnier',
      ageClass: formData.ageClass || 'U11',
      date: formData.date || new Date().toISOString().split('T')[0],
      timeSlot: formData.timeSlot || '',
      location: formData.location || '',
      teams: formData.teams || [],
      matches: generateMatches(formData as Tournament),
      createdAt: existingTournament?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveTournament(tournament);
    onBack();
  };

  const canGoNext = () => {
    switch (step) {
      case 1:
        return formData.sport && formData.tournamentType;
      case 2:
        return formData.mode;
      case 3:
        return formData.title && formData.date && formData.location;
      case 4:
        return (formData.teams?.length || 0) >= 2;
      default:
        return true;
    }
  };

  return (
    <div style={{ padding: '40px 20px', maxWidth: '800px', margin: '0 auto' }}>
      {/* Header */}
      <button
        onClick={onBack}
        style={{
          marginBottom: '24px',
          padding: `${theme.spacing.sm} ${theme.spacing.md}`,
          background: 'transparent',
          border: 'none',
          color: theme.colors.text.secondary,
          fontSize: theme.fontSizes.md,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: theme.spacing.sm,
        }}
      >
        <Icons.ChevronLeft />
        Zurück
      </button>

      <h1
        style={{
          fontFamily: theme.fonts.heading,
          fontSize: theme.fontSizes.xxxl,
          marginBottom: '32px',
          background: theme.gradients.primary,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        {existingTournament ? 'TURNIER BEARBEITEN' : 'NEUES TURNIER'}
      </h1>

      {/* Progress Bar */}
      <ProgressBar
        currentStep={step}
        totalSteps={5}
        stepLabels={['Sportart', 'Modus', 'Stammdaten', 'Teams', 'Übersicht']}
      />

      {/* Steps */}
      {step === 1 && (
        <Step1_SportAndType
          formData={formData}
          onUpdate={updateForm}
          onTournamentTypeChange={handleTournamentTypeChange}
        />
      )}

      {step === 2 && (
        <Step2_ModeAndSystem
          formData={formData}
          onUpdate={updateForm}
          onMovePlacementLogic={movePlacementLogic}
          onTogglePlacementLogic={togglePlacementLogic}
        />
      )}

      {step === 3 && <Step3_Metadata formData={formData} onUpdate={updateForm} />}

      {step === 4 && (
        <Step4_Teams
          formData={formData}
          onUpdate={updateForm}
          onAddTeam={addTeam}
          onRemoveTeam={removeTeam}
          onUpdateTeam={updateTeam}
        />
      )}

      {step === 5 && <Step5_Overview formData={formData} onSave={handleSave} />}

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
        <Button
          variant="ghost"
          onClick={() => setStep(Math.max(1, step - 1))}
          disabled={step === 1}
          icon={<Icons.ChevronLeft />}
        >
          Zurück
        </Button>
        {step < 5 && (
          <Button
            onClick={() => setStep(Math.min(5, step + 1))}
            disabled={!canGoNext()}
            icon={<Icons.ChevronRight />}
            iconPosition="right"
          >
            Weiter
          </Button>
        )}
      </div>
    </div>
  );
};
