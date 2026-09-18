import type { OrigemHistorico, ResultadoHistorico } from "./tipos";

/**
 * Ano externo nasce congelado — não há o que recalcular.
 * Ano interno congela quando recebe resultado final: daí em diante o histórico
 * não muda mais, mesmo que uma nota seja corrigida depois.
 */
export function deveCongelar(resultado: ResultadoHistorico, origem: OrigemHistorico): boolean {
  if (origem === "externa") return true;
  return resultado !== "cursando";
}
