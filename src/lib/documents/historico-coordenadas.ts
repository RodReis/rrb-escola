/**
 * Coordenadas extraídas de docs/referencias/historico-manuela.pdf via pdfjs.
 * Contrato de layout: o gerador deve posicionar cada texto nestas coordenadas,
 * em pontos, com origem no canto inferior esquerdo da página A4.
 *
 * ⚠️ O rodapé da grade ("Resultado Final", "Carga Horária Anual", "Dias Letivos")
 * NÃO tem âncora fixa. No formulário oficial ele fecha a grade logo abaixo da
 * última disciplina, então sobe e desce com a quantidade de disciplinas do
 * aluno. Fixar y=401 (medido de um aluno com poucas disciplinas) fazia o texto
 * ser escrito por cima das últimas linhas a partir de 16 disciplinas — 36
 * alunos da base. A ordem vertical dos blocos é verificada em
 * historico-layout.test.ts, que é o teste certo para esse comportamento.
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
  { texto: "Série", x: 66.8, y: 364.0 },
  { texto: "Estabelecimento", x: 258.4, y: 364.0 },
  { texto: "UF", x: 555.8, y: 364.0 }
] as const;

/**
 * Tolerância em pontos. O modelo foi medido com uma casa decimal; os rótulos
 * de coluna e de tabela são centrados na célula, então acompanham a largura da
 * faixa em vez de um x literal.
 */
export const TOLERANCIA_PT = 2.5;

/** Rótulos centrados na célula: comparados só pela linha de base. */
export const SOMENTE_Y: ReadonlySet<string> = new Set([
  "1º ANO",
  "2º ANO",
  "Disciplinas",
  "Série",
  "Estabelecimento",
  "UF"
]);
