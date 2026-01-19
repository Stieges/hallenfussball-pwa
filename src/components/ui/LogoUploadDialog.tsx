import React, { useState, useRef, useCallback, useEffect, CSSProperties } from 'react';
import { cssVars, displaySizes } from '../../design-tokens';
import { Button } from './Button';
import { TeamAvatar } from './TeamAvatar';
import {
  processLogo,
  validateLogoFile,
  createTeamLogo,
  SUPPORTED_MIME_TYPES,
  CropArea,
} from '../../utils/logoProcessor';
import { TeamLogo } from '../../types/tournament';

interface LogoUploadDialogProps {
  /** Team name for preview */
  teamName: string;
  /** Current logo (if any) */
  currentLogo?: TeamLogo;
  /** Called when logo is saved */
  onSave: (logo: TeamLogo) => void;
  /** Called when dialog is closed without saving */
  onCancel: () => void;
  /** Called when logo is removed */
  onRemove?: () => void;
}

type UploadStep = 'upload' | 'preview';

export const LogoUploadDialog: React.FC<LogoUploadDialogProps> = ({
  teamName,
  currentLogo,
  onSave,
  onCancel,
  onRemove,
}) => {
  const [step, setStep] = useState<UploadStep>(currentLogo ? 'preview' : 'upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    currentLogo?.type === 'base64' ? currentLogo.value : null
  );
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [cropArea, setCropArea] = useState<CropArea>({ x: 0.5, y: 0.5, scale: 1 });
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const handleFileSelect = useCallback((file: File) => {
    setError(null);

    const validation = validateLogoFile(file);
    if (!validation.valid) {
      setError(validation.error ?? 'Invalid file');
      return;
    }

    setSelectedFile(file);

    // Create preview URL
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setStep('preview');
    setCropArea({ x: 0.5, y: 0.5, scale: 1 });
  }, []);

  // Handle paste events for clipboard images
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) {return;}

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            handleFileSelect(file);
            break;
          }
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handleFileSelect]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleSave = async () => {
    if (!selectedFile && !currentLogo) {return;}
    if (!disclaimerAccepted) {
      setError('Bitte bestätige die Nutzungsrechte');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      if (selectedFile) {
        const processed = await processLogo(selectedFile, cropArea);
        const logo = createTeamLogo(processed, 'organizer');
        onSave(logo);
      } else if (currentLogo) {
        // Just confirm existing logo
        onSave(currentLogo);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler bei der Verarbeitung');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreviewUrl(currentLogo?.type === 'base64' ? currentLogo.value : null);
    setCropArea({ x: 0.5, y: 0.5, scale: 1 });
    setStep(currentLogo ? 'preview' : 'upload');
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Styles
  const overlayStyles: CSSProperties = {
    position: 'fixed',
    inset: 0,
    backgroundColor: cssVars.colors.overlayStrong,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: cssVars.spacing.md,
  };

  const dialogStyles: CSSProperties = {
    backgroundColor: cssVars.colors.surface,
    borderRadius: cssVars.borderRadius.lg,
    maxWidth: 480,
    width: '100%',
    maxHeight: '90vh',
    overflow: 'auto',
  };

  const headerStyles: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: cssVars.spacing.lg,
    borderBottom: `1px solid ${cssVars.colors.border}`,
  };

  const titleStyles: CSSProperties = {
    fontSize: cssVars.fontSizes.lg,
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.textPrimary,
    margin: 0,
  };

  const closeButtonStyles: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '44px',
    height: '44px',
    minWidth: '44px',
    minHeight: '44px',
    background: 'none',
    border: 'none',
    borderRadius: cssVars.borderRadius.sm,
    fontSize: cssVars.fontSizes.xxl,
    cursor: 'pointer',
    color: cssVars.colors.textSecondary,
    padding: 0,
  };

  const contentStyles: CSSProperties = {
    padding: cssVars.spacing.lg,
  };

  const dropZoneStyles: CSSProperties = {
    border: `2px dashed ${isDragging ? cssVars.colors.primary : cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    padding: cssVars.spacing.xl,
    textAlign: 'center',
    backgroundColor: isDragging ? cssVars.colors.primarySubtle : 'transparent',
    transition: 'all 0.2s ease',
    cursor: 'pointer',
  };

  const previewContainerStyles: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: cssVars.spacing.lg,
  };

  const zoomControlStyles: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.md,
    width: '100%',
    maxWidth: 300,
  };

  const sliderStyles: CSSProperties = {
    flex: 1,
    height: 4,
    appearance: 'none',
    backgroundColor: cssVars.colors.border,
    borderRadius: 2,
    outline: 'none',
  };

  const avatarPreviewStyles: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: cssVars.spacing.lg,
    padding: cssVars.spacing.md,
    backgroundColor: cssVars.colors.inputBg,
    borderRadius: cssVars.borderRadius.md,
  };

  const disclaimerStyles: CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: cssVars.spacing.sm,
    padding: cssVars.spacing.md,
    backgroundColor: cssVars.colors.inputBg,
    borderRadius: cssVars.borderRadius.md,
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
  };

  const errorStyles: CSSProperties = {
    color: cssVars.colors.error,
    fontSize: cssVars.fontSizes.sm,
    padding: cssVars.spacing.sm,
    backgroundColor: cssVars.colors.errorSubtle,
    borderRadius: cssVars.borderRadius.sm,
    marginTop: cssVars.spacing.md,
  };

  const footerStyles: CSSProperties = {
    display: 'flex',
    gap: cssVars.spacing.md,
    padding: cssVars.spacing.lg,
    borderTop: `1px solid ${cssVars.colors.border}`,
    justifyContent: 'flex-end',
  };

  // Create a preview team object for TeamAvatar
  const previewTeam = {
    name: teamName,
    logo: previewUrl
      ? { type: 'base64' as const, value: previewUrl }
      : undefined,
  };

  return (
    <div style={overlayStyles} onClick={onCancel}>
      <div style={dialogStyles} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={headerStyles}>
          <h2 style={titleStyles}>Logo hochladen</h2>
          <button style={closeButtonStyles} onClick={onCancel} aria-label="Schließen">
            ×
          </button>
        </div>

        {/* Content */}
        <div style={contentStyles}>
          {step === 'upload' ? (
            <>
              {/* Drop Zone */}
              <div
                ref={dropZoneRef}
                style={dropZoneStyles}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
              >
                <div style={{ fontSize: displaySizes.lg, marginBottom: cssVars.spacing.md }}>📤</div>
                <p style={{ color: cssVars.colors.textPrimary, marginBottom: cssVars.spacing.sm }}>
                  Datei hierher ziehen
                </p>
                <p style={{ color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.sm }}>
                  oder klicken zum Auswählen
                </p>
                <p style={{ color: cssVars.colors.textTertiary, fontSize: cssVars.fontSizes.xs, marginTop: cssVars.spacing.md }}>
                  Tipp: Strg+V zum Einfügen aus der Zwischenablage
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept={SUPPORTED_MIME_TYPES.join(',')}
                onChange={handleFileInputChange}
                style={{ display: 'none' }}
              />

              <p style={{ color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.sm, marginTop: cssVars.spacing.md, textAlign: 'center' }}>
                Unterstützte Formate: PNG, JPG, WebP, SVG, GIF
              </p>
            </>
          ) : (
            /* Preview Step */
            <div style={previewContainerStyles}>
              {/* Main Preview with Live Zoom */}
              {previewUrl && (
                <div style={{
                  width: 160,
                  height: 160,
                  borderRadius: cssVars.borderRadius.lg,
                  backgroundColor: cssVars.colors.inputBg,
                  border: `1px solid ${cssVars.colors.border}`,
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <img
                    src={previewUrl}
                    alt="Logo Vorschau"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                      transform: `scale(${cropArea.scale})`,
                      transition: 'transform 0.15s ease-out',
                    }}
                  />
                </div>
              )}

              {/* Zoom Control */}
              <div style={zoomControlStyles}>
                <button
                  onClick={() => setCropArea(prev => ({ ...prev, scale: Math.max(0.5, prev.scale - 0.1) }))}
                  style={{
                    background: 'none',
                    border: `1px solid ${cssVars.colors.border}`,
                    borderRadius: cssVars.borderRadius.sm,
                    width: 32,
                    height: 32,
                    cursor: 'pointer',
                    color: cssVars.colors.textSecondary,
                    fontSize: cssVars.fontSizes.lg,
                  }}
                  aria-label="Verkleinern"
                >
                  −
                </button>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={cropArea.scale}
                  onChange={(e) => setCropArea(prev => ({ ...prev, scale: parseFloat(e.target.value) }))}
                  style={sliderStyles}
                />
                <button
                  onClick={() => setCropArea(prev => ({ ...prev, scale: Math.min(2, prev.scale + 0.1) }))}
                  style={{
                    background: 'none',
                    border: `1px solid ${cssVars.colors.border}`,
                    borderRadius: cssVars.borderRadius.sm,
                    width: 32,
                    height: 32,
                    cursor: 'pointer',
                    color: cssVars.colors.textSecondary,
                    fontSize: cssVars.fontSizes.lg,
                  }}
                  aria-label="Vergrößern"
                >
                  +
                </button>
              </div>
              <p style={{ fontSize: cssVars.fontSizes.xs, color: cssVars.colors.textSecondary, margin: 0 }}>
                Zoom: {Math.round(cropArea.scale * 100)}%
              </p>

              {/* Avatar Size Preview */}
              <div style={avatarPreviewStyles}>
                <div style={{ textAlign: 'center' }}>
                  <TeamAvatar team={previewTeam} size="lg" />
                  <p style={{ fontSize: cssVars.fontSizes.xs, color: cssVars.colors.textSecondary, marginTop: cssVars.spacing.xs }}>
                    Groß
                  </p>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <TeamAvatar team={previewTeam} size="md" />
                  <p style={{ fontSize: cssVars.fontSizes.xs, color: cssVars.colors.textSecondary, marginTop: cssVars.spacing.xs }}>
                    Normal
                  </p>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <TeamAvatar team={previewTeam} size="sm" />
                  <p style={{ fontSize: cssVars.fontSizes.xs, color: cssVars.colors.textSecondary, marginTop: cssVars.spacing.xs }}>
                    Klein
                  </p>
                </div>
              </div>

              {/* Change/Reset Buttons */}
              <div style={{ display: 'flex', gap: cssVars.spacing.sm }}>
                <Button variant="ghost" size="sm" onClick={handleReset}>
                  Anderes Bild
                </Button>
                {onRemove && currentLogo && (
                  <Button variant="danger" size="sm" onClick={onRemove}>
                    Entfernen
                  </Button>
                )}
              </div>

              {/* Disclaimer */}
              <label style={disclaimerStyles}>
                <input
                  type="checkbox"
                  checked={disclaimerAccepted}
                  onChange={(e) => setDisclaimerAccepted(e.target.checked)}
                  style={{ marginTop: 2 }}
                />
                <span>
                  Ich bestätige, dass ich berechtigt bin, dieses Logo zu verwenden
                  (Eigentümer, Vereinsmitglied oder Lizenz).
                </span>
              </label>
            </div>
          )}

          {/* Error Message */}
          {error && <div style={errorStyles}>{error}</div>}
        </div>

        {/* Footer */}
        <div style={footerStyles}>
          <Button variant="secondary" onClick={onCancel}>
            Abbrechen
          </Button>
          {step === 'preview' && (
            <Button
              onClick={() => void handleSave()}
              loading={isProcessing}
              disabled={!disclaimerAccepted || isProcessing}
            >
              Logo speichern
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default LogoUploadDialog;
