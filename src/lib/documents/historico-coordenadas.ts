/**
 * Coordenadas extraídas de docs/referencias/historico-manuela.pdf via pdfjs.
 * Contrato de layout: o gerador deve posicionar cada texto nestas coordenadas,
 * em pontos, com origem no canto inferior esquerdo da página A4.
 */
export const COORDENADAS_REFERENCIA = [
  { texto: "EPG TRINDADE", x: 24.0, y: 810.0 },
  { texto: "ESCOLA PINGUINHO DE GENTE LTDA", x: 24.0, y: 798.0 },
  { texto: "CNPJ: 11.714.876/0001-16", x: 24.0, y: 786.0 },
  { texto: "MANUELA MARGARIDA BARROS", x: 24.0, y: 662.0 },
  { texto: "116.726.301-42", x: 420.4, y: 662.0 },
  { texto: "1041", x: 499.7, y: 662.0 },
  { texto: "28/08/2017", x: 24.0, y: 622.0 },
  { texto: "BRASILEIRA", x: 261.9, y: 622.0 },
  { texto: "1º ANO", x: 142.8, y: 595.0 },
  { texto: "2º ANO", x: 189.6, y: 595.0 },
  { texto: "Disciplinas", x: 59.2, y: 580.5 },
  { texto: "Resultado Final", x: 22.0, y: 401.0 },
  { texto: "Carga Horária Anual", x: 22.0, y: 390.0 },
  { texto: "Dias Letivos", x: 22.0, y: 379.0 },
  { texto: "Série", x: 66.8, y: 364.0 },
  { texto: "Estabelecimento", x: 258.4, y: 364.0 },
  { texto: "UF", x: 555.8, y: 364.0 }
] as const;

/** Tolerância em pontos: o modelo foi medido com uma casa decimal. */
export const TOLERANCIA_PT = 2.5;
