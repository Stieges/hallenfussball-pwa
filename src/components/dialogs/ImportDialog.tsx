/**
 * ImportDialog Component (US-005)
 *
 * Multi-step dialog for importing external tournament data.
 * Steps: select -> warnings -> preview -> success
 */

import { useState, useRef, CSSProperties, DragEvent } from 'react';
import { Dialog } from './Dialog';
import { cssVars } from '../../design-tokens'
import { Tournament, ImportValidationResult } from '../../types/tournament';
import { validateAndParseTournamentImport, detectImportFormat } from '../../utils/tournamentImporter';
import { SelectStep, WarningsStep, PreviewStep, SuccessStep } from './ImportSteps';

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
    gap: cssVars.spacing.xl,
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
