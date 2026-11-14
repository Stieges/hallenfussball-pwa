/** Teile eines Wortes, jeweils bis einschließlich eines Schrägstrichs („Taching/“, „Tengling“); ohne Schrägstrich ein Teil (@ZM-207). */
export function splitAfterSlash(word: string): string[] {
  return word.match(/[^/]+\/?|\//g) ?? [word];
}
