/**
 * Share utilities for Native Share API and Clipboard operations
 */

export interface ShareOptions {
  url: string;
  title: string;
  text?: string;
}

export interface ShareResult {
  success: boolean;
  method: 'native' | 'clipboard' | 'failed';
  error?: string;
}

/**
 * Check if Native Share API is supported
 */
export function isShareSupported(): boolean {
  return typeof navigator !== 'undefined' && 'share' in navigator;
}

/**
 * Check if Clipboard API is supported
 */
export function isClipboardSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'clipboard' in navigator &&
    'writeText' in navigator.clipboard
  );
}

/**
 * Share content using Native Share API
 * Falls back to clipboard if native share is not available
 *
 * @param options - Share options (url, title, text)
 * @returns Promise resolving to ShareResult
 */
export async function shareUrl(options: ShareOptions): Promise<ShareResult> {
  const { url, title, text } = options;

  // Try Native Share API first
  if (isShareSupported()) {
    try {
      await navigator.share({
        title,
        text: text || title,
        url,
      });

      return {
        success: true,
        method: 'native',
      };
    } catch (error) {
      // User cancelled share or error occurred
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          method: 'native',
          error: 'Share cancelled',
        };
      }

      console.error('Native share failed:', error);
      // Fall through to clipboard
    }
  }

  // Fallback to clipboard
  const clipboardResult = await copyToClipboard(url);
  return {
    success: clipboardResult,
    method: clipboardResult ? 'clipboard' : 'failed',
    error: clipboardResult ? undefined : 'Copy to clipboard failed',
  };
}

/**
 * Copy text to clipboard using Clipboard API
 *
 * @param text - Text to copy
 * @returns Promise resolving to true if successful, false otherwise
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (isClipboardSupported()) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.error('Clipboard API failed:', error);
      // Fall through to legacy method
    }
  }

  // Fallback: Legacy method using execCommand (deprecated but widely supported)
  return legacyCopyToClipboard(text);
}

/**
 * Legacy clipboard copy using document.execCommand
 * Used as fallback for older browsers
 *
 * @param text - Text to copy
 * @returns true if successful, false otherwise
 */
function legacyCopyToClipboard(text: string): boolean {
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);

    return successful;
  } catch (error) {
    console.error('Legacy copy failed:', error);
    return false;
  }
}

/**
 * Get user-friendly message for share result
 *
 * @param result - ShareResult from shareUrl or copyToClipboard
 * @returns Localized message string
 */
export function getShareMessage(result: ShareResult): string {
  if (result.success) {
    if (result.method === 'native') {
      return 'Link erfolgreich geteilt!';
    } else if (result.method === 'clipboard') {
      return 'Link in Zwischenablage kopiert!';
    }
  }

  return 'Fehler beim Teilen. Bitte Link manuell kopieren.';
}

/**
 * Generate public tournament URL
 *
 * @param tournamentId - Tournament ID
 * @param baseUrl - Base URL (defaults to current origin)
 * @returns Full public tournament URL
 */
export function generatePublicUrl(tournamentId: string, baseUrl?: string): string {
  const origin = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${origin}/public/${tournamentId}`;
}
