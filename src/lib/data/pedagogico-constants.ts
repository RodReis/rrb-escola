/**
 * Pure helpers for the "pedagogico" dashboard feature.
 * This file is safe to import in both Server and Client Components.
 * Do NOT add any server-only imports (e.g. next/headers, supabase server) here.
 */

/** Ordena série pelo número no nome ("2º Ano" antes de "10º Ano"); sem número, cai para alfabética. */
export function compareSerie(a: string, b: string): number {
  const na = Number(a.match(/\d+/)?.[0]);
  const nb = Number(b.match(/\d+/)?.[0]);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
  return a.localeCompare(b);
}
