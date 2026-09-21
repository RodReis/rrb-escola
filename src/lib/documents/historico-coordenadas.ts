/**
 * Coordenadas do layout paisagem A4 (842×595pt), calibradas a partir de
 * CERTIFICADO.pdf (verso, página 2) — o modelo de referência oficial atual.
 * Substitui o contrato anterior, medido de um modelo em retrato descontinuado
 * em favor deste layout (ver decisão em docs/superpowers, certificado de
 * conclusão).
 *
 * Duas âncoras (REGISTRO e HISTÓRICO ESCOLAR) seguem a posição literal do
 * modelo. As demais são do próprio gerador, não da referência: por decisão
 * consciente, este documento mantém o bloco de identificação em caixa
 * (CPF/matrícula/filiação/nascimento/RG) que a referência não tem — ela usa
 * uma frase corrida sobre a origem do fundamental. Isso desloca a grade de
 * notas para baixo do que a referência mostra; o contrato aqui trava a
 * consistência do próprio layout, não mais uma fidelidade pixel a pixel.
 *
 * ⚠️ O rodapé da grade ("Resultado Final", "Carga Horária Anual", "Dias Letivos")
 * NÃO tem âncora fixa. No formulário oficial ele fecha a grade logo abaixo da
 * última disciplina, então sobe e desce com a quantidade de disciplinas do
 * aluno. A ordem vertical dos blocos é verificada em historico-layout.test.ts,
 * que é o teste certo para esse comportamento.
 */
export const COORDENADAS_REFERENCIA = [
  { texto: "HISTÓRICO ESCOLAR", x: 14.0, y: 571.0 },
  { texto: "REGISTRO", x: 687.8, y: 545.3 },
  { texto: "Aluno(a):", x: 16.0, y: 538.3 },
  // Texto da coluna é decisão de negócio ("1º MÉDIO", não "1ª SÉRIE - EM" do
  // modelo impresso); a posição segue o próprio layout do gerador.
  { texto: "1º MÉDIO", x: 217.9, y: 462.3 },
  { texto: "Disciplinas", x: 71.8, y: 449.3 },
  { texto: "Série", x: 48.7, y: 201.3 },
  { texto: "Estabelecimento", x: 265.7, y: 201.3 },
  { texto: "UF", x: 562.3, y: 201.3 }
] as const;

/**
 * Tolerância em pontos. O modelo foi medido com uma casa decimal; os rótulos
 * de coluna e de tabela são centrados na célula, então acompanham a largura da
 * faixa em vez de um x literal — por isso quase todo texto do contrato entra
 * em `SOMENTE_Y`.
 */
export const TOLERANCIA_PT = 4;

/** Rótulos centrados na célula: comparados só pela linha de base. */
export const SOMENTE_Y: ReadonlySet<string> = new Set([
  "1º MÉDIO",
  "Disciplinas",
  "Série",
  "Estabelecimento",
  "UF"
]);
