import type { ModeloEtiqueta } from "../tipos";

export type ModeloEtiquetaDef = {
  codigo: ModeloEtiqueta;
  nome: string;
  papel: "letter" | "a4";
  paginaW: number;
  paginaH: number;
  colunas: number;
  linhas: number;
  largura: number;
  altura: number;
  margemEsq: number;
  margemTopo: number;
  passoH: number;
  passoV: number;
};

// ponytail: geometria de catálogo Pimaco; conferir com folha real impressa
// (Task 14) e ajustar margemEsq/margemTopo se houver deslocamento.
export const MODELOS_ETIQUETA: Record<ModeloEtiqueta, ModeloEtiquetaDef> = {
  "6180": { codigo: "6180", nome: "Carta - 6180", papel: "letter", paginaW: 215.9, paginaH: 279.4, colunas: 3, linhas: 10, largura: 66.7, altura: 25.4, margemEsq: 4.8, margemTopo: 12.7, passoH: 69.85, passoV: 25.4 },
  "6181": { codigo: "6181", nome: "Carta - 6181", papel: "letter", paginaW: 215.9, paginaH: 279.4, colunas: 2, linhas: 10, largura: 101.6, altura: 25.4, margemEsq: 4.2, margemTopo: 12.7, passoH: 105.9, passoV: 25.4 },
  A4256: { codigo: "A4256", nome: "A4 - A4256 / 6280", papel: "a4", paginaW: 210, paginaH: 297, colunas: 3, linhas: 11, largura: 63.5, altura: 25.4, margemEsq: 7.2, margemTopo: 8.8, passoH: 66.0, passoV: 25.4 },
  A4362: { codigo: "A4362", nome: "A4 - A4362", papel: "a4", paginaW: 210, paginaH: 297, colunas: 2, linhas: 8, largura: 99.0, altura: 33.9, margemEsq: 4.75, margemTopo: 12.9, passoH: 101.5, passoV: 33.9 },
};

export function posicaoEtiqueta(m: ModeloEtiquetaDef, indice: number): { pagina: number; x: number; y: number } {
  const porPagina = m.colunas * m.linhas;
  const pagina = Math.floor(indice / porPagina);
  const resto = indice % porPagina;
  const linha = Math.floor(resto / m.colunas);
  const coluna = resto % m.colunas;
  return { pagina, x: m.margemEsq + coluna * m.passoH, y: m.margemTopo + linha * m.passoV };
}

const num = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

export function descricaoModelo(m: ModeloEtiquetaDef): string {
  const papel = m.papel === "letter" ? "Carta" : "A4";
  return `Folha Tamanho ${papel} ${num(m.paginaW)} x ${num(m.paginaH)} mm. ${m.colunas} colunas e ${m.linhas} linhas totalizando ${m.colunas * m.linhas} etiquetas por folha.`;
}
