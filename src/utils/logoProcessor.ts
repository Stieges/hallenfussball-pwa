import imageCompression from 'browser-image-compression';
import { TeamLogo } from '../types/tournament';

/**
 * Logo processing configuration
 */
export interface LogoProcessingConfig {
  /** Target size in pixels (square) */
  targetSize: number;
  /** Output format */
  format: 'webp' | 'png' | 'jpeg';
  /** Quality for lossy formats (0-1) */
  quality: number;
  /** Padding around the logo (0-1, as percentage) */
  padding: number;
}

/**
 * Crop area for manual adjustment
 */
export interface CropArea {
  /** X position (0-1) */
  x: number;
  /** Y position (0-1) */
  y: number;
  /** Zoom/scale factor */
  scale: number;
}

/**
 * Result of logo processing
 */
export interface ProcessedLogo {
  type: 'base64';
  value: string;
  sizeKB: number;
}

/**
 * Default configuration for logo processing
 * - 128px square for optimal display
 * - WebP format for best compression
 * - 80% quality for good balance
 */
export const DEFAULT_LOGO_CONFIG: LogoProcessingConfig = {
  targetSize: 128,
  format: 'webp',
  quality: 0.8,
  padding: 0.05,
};

/**
 * Maximum file size for logo upload (in bytes)
 * 5MB should cover most reasonable logo files
 */
export const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;

/**
 * Supported image MIME types
 */
export const SUPPORTED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
  'image/gif',
];

/**
 * Get initials from team name
 * "FC Bayern" -> "FB"
 * "Bayern" -> "BA"
 */
export function getInitials(name: string): string {
  if (!name) {return '??';}

  const words = name.trim().split(/\s+/);

  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  return name.slice(0, 2).toUpperCase();
}

/**
 * Load an image from a File
 */
async function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

/**
 * Convert a Blob to Base64 data URL
 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Compress image using browser-image-compression
 */
async function compressImage(file: File): Promise<File> {
  const options = {
    maxSizeMB: 0.1, // 100KB max
    maxWidthOrHeight: 256, // Intermediate size before final resize
    useWebWorker: true,
    fileType: 'image/webp' as const,
  };

  return imageCompression(file, options);
}

/**
 * Process a logo file into the final format
 *
 * @param file - The uploaded image file
 * @param cropArea - Optional crop/position adjustment
 * @param config - Processing configuration
 * @returns Processed logo ready for storage
 */
export async function processLogo(
  file: File,
  cropArea?: CropArea,
  config: LogoProcessingConfig = DEFAULT_LOGO_CONFIG
): Promise<ProcessedLogo> {
  // Validate file type
  if (!SUPPORTED_MIME_TYPES.includes(file.type)) {
    throw new Error(`Unsupported file type: ${file.type}. Supported: PNG, JPEG, WebP, SVG, GIF`);
  }

  // Validate file size
  if (file.size > MAX_UPLOAD_SIZE) {
    throw new Error(`File too large: ${Math.round(file.size / 1024 / 1024)}MB. Maximum: 5MB`);
  }

  // For SVG, handle separately (no compression needed)
  if (file.type === 'image/svg+xml') {
    const base64 = await blobToBase64(file);
    return {
      type: 'base64',
      value: base64,
      sizeKB: Math.round(file.size / 1024),
    };
  }

  // Compress the image first
  const compressed = await compressImage(file);

  // Load the compressed image
  const img = await loadImage(compressed);

  // Create canvas with target size
  const canvas = document.createElement('canvas');
  canvas.width = config.targetSize;
  canvas.height = config.targetSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas 2D context');
  }

  // Clear with transparent background
  ctx.clearRect(0, 0, config.targetSize, config.targetSize);

  // Calculate drawing parameters
  const scale = cropArea?.scale ?? 1;
  const offsetX = cropArea?.x ?? 0.5;
  const offsetY = cropArea?.y ?? 0.5;

  // Calculate the size to draw (fit the image in the target with padding)
  const padding = config.padding * config.targetSize;
  const availableSize = config.targetSize - (padding * 2);

  // Determine scale to fit
  const imgAspect = img.width / img.height;
  let drawWidth: number;
  let drawHeight: number;

  if (imgAspect > 1) {
    // Wider than tall
    drawWidth = availableSize * scale;
    drawHeight = (availableSize / imgAspect) * scale;
  } else {
    // Taller than wide
    drawWidth = (availableSize * imgAspect) * scale;
    drawHeight = availableSize * scale;
  }

  // Center the image (with optional offset adjustment)
  const drawX = (config.targetSize - drawWidth) * offsetX;
  const drawY = (config.targetSize - drawHeight) * offsetY;

  // Draw the image
  ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

  // Convert to WebP blob
  const mimeType = config.format === 'webp'
    ? 'image/webp'
    : config.format === 'png'
      ? 'image/png'
      : 'image/jpeg';

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Canvas conversion failed'))),
      mimeType,
      config.quality
    );
  });

  // Convert to base64
  const base64 = await blobToBase64(blob);

  return {
    type: 'base64',
    value: base64,
    sizeKB: Math.round(blob.size / 1024),
  };
}

/**
 * Create a TeamLogo object from processed logo data
 */
export function createTeamLogo(
  processed: ProcessedLogo,
  uploadedBy: 'organizer' | 'trainer' = 'organizer'
): TeamLogo {
  return {
    type: processed.type,
    value: processed.value,
    uploadedAt: new Date().toISOString(),
    uploadedBy,
  };
}

/**
 * Validate if a file is a valid image for logo upload
 */
export function validateLogoFile(file: File): { valid: boolean; error?: string } {
  if (!SUPPORTED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Nicht unterstütztes Format: ${file.type.split('/')[1] || file.type}. Unterstützt: PNG, JPEG, WebP, SVG, GIF`,
    };
  }

  if (file.size > MAX_UPLOAD_SIZE) {
    return {
      valid: false,
      error: `Datei zu groß: ${Math.round(file.size / 1024 / 1024)}MB. Maximum: 5MB`,
    };
  }

  return { valid: true };
}

/**
 * Check if a data URL is a valid image
 */
export function isValidImageDataUrl(dataUrl: string): boolean {
  return (
    typeof dataUrl === 'string' &&
    dataUrl.startsWith('data:image/') &&
    dataUrl.includes('base64,')
  );
}

/**
 * Get estimated storage size for a base64 string in KB
 */
export function getBase64SizeKB(base64: string): number {
  // Base64 encoding increases size by ~33%
  // The actual data starts after "data:image/xxx;base64,"
  const base64Data = base64.split(',')[1] || base64;
  return Math.round((base64Data.length * 0.75) / 1024);
}
