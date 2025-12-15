import QRCode from 'qrcode';

/**
 * Generates a QR code as a data URL (base64 PNG) for a given URL
 *
 * @param url - The URL to encode in the QR code
 * @param size - Size of the QR code in pixels (default: 256)
 * @returns Promise resolving to data URL or empty string on error
 */
export async function generateQRCode(url: string, size: number = 256): Promise<string> {
  try {
    const dataUrl = await QRCode.toDataURL(url, {
      width: size,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M', // Medium error correction
    });

    return dataUrl;
  } catch (error) {
    console.error('Failed to generate QR code:', error);
    return '';
  }
}

/**
 * Generates a QR code as a canvas element
 * Useful for custom rendering scenarios
 *
 * @param url - The URL to encode in the QR code
 * @param size - Size of the QR code in pixels (default: 256)
 * @returns Promise resolving to canvas element or null on error
 */
export async function generateQRCodeCanvas(url: string, size: number = 256): Promise<HTMLCanvasElement | null> {
  try {
    const canvas = document.createElement('canvas');
    await QRCode.toCanvas(canvas, url, {
      width: size,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    });

    return canvas;
  } catch (error) {
    console.error('Failed to generate QR code canvas:', error);
    return null;
  }
}

/**
 * Validates if a string is a valid URL
 *
 * @param url - String to validate
 * @returns true if valid URL, false otherwise
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
