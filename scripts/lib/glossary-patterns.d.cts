// Companion-Deklaration für glossary-patterns.cjs.

export interface GlossaryShort {
  de: string;
  en: string;
  context: 'tabellenkopf' | 'ergebniszelle';
  shortKey: string;
  usedBy?: string[];
}

export interface GlossaryEntry {
  de: string;
  en: string;
  forbidden_de: string[];
  forbidden_en?: string[];
  reason: string;
  i18nKey: string;
  kuerzel?: boolean;
  tsLint?: boolean;
  short?: GlossaryShort;
}

export interface GlossaryPattern {
  term: string;
  forbidden: string;
  lang: 'de' | 'en';
  kuerzel: boolean;
  tsLint: boolean;
  reason: string;
  i18nKey: string;
  de: string;
  en: string;
  regex: RegExp;
}

declare const glossaryPatterns: {
  GERMAN_WORD_CHAR: string;
  LETTER_CHAR: string;
  escapeRegExp: (value: string) => string;
  wordBoundaryRegex: (phrase: string) => RegExp;
  kuerzelRegex: (abbreviation: string) => RegExp;
  stripInterpolation: (value: string) => string;
  buildPatterns: (
    glossary: { terms: Record<string, GlossaryEntry> },
    useAnchorOnly?: (forbidden: string) => boolean
  ) => GlossaryPattern[];
};

export default glossaryPatterns;
