// Companion-Deklaration für check-terminology.cjs (TypeScript findet eine
// gleichnamige .d.cts automatisch neben der .cjs-Datei, unabhängig vom
// relativen Pfad, über den ein Importer sie einbindet).

export interface TerminologyCheckResult {
  check: string;
  errors: string[];
}

export interface TerminologyCheckReport {
  locales: string[];
  namespaces: string[];
  results: TerminologyCheckResult[];
}

export interface GlossaryTerm {
  de: string;
  en: string;
  forbidden_de: string[];
  reason: string;
  i18nKey: string;
}

export interface Glossary {
  terms: Record<string, GlossaryTerm>;
}

export interface ForbiddenPattern {
  term: string;
  forbidden: string;
  reason: string;
  regex: RegExp;
}

declare const checkTerminology: {
  discoverLocales: (localesDir: string) => string[];
  discoverNamespaces: (localesDir: string, locales: string[]) => string[];
  loadNamespace: (
    localesDir: string,
    locale: string,
    namespace: string
  ) => Record<string, unknown> | null;
  flatten: (obj: Record<string, unknown>, prefix?: string) => Record<string, unknown>;
  loadGlossary: (glossaryPath: string) => Glossary;
  wordBoundaryRegex: (phrase: string) => RegExp;
  stripInterpolationRefs: (value: string) => string;
  buildForbiddenPatterns: (glossary: Glossary) => ForbiddenPattern[];
  checkKeyParity: (localesDir: string, locales: string[], namespaces: string[]) => string[];
  checkForbiddenSynonyms: (
    localesDir: string,
    locales: string[],
    namespaces: string[],
    patterns: ForbiddenPattern[]
  ) => string[];
  checkGlossaryKeys: (localesDir: string, locales: string[], glossary: Glossary) => string[];
  runAllChecks: (localesDir?: string, glossaryPath?: string) => TerminologyCheckReport;
};

export default checkTerminology;
