// Companion-Deklaration für check-pdf-font-precache.cjs (B-28 C3, B6).
export interface PdfFontPrecacheResult {
  skipped: boolean;
  problems: string[];
  chunks: string[];
}

export function checkPdfFontPrecache(root: string): PdfFontPrecacheResult;
