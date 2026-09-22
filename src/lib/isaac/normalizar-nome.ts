/**
 * Normalização de nome para casar aluno do isaac com aluno do cadastro.
 *
 * Existe separada de `normalizeNome` (src/lib/format/normalize-nome.ts) porque
 * precisa espelhar a coluna GERADA `alunos.nome_normalizado`, definida na
 * migration 202609190002 como:
 *
 *     lower(immutable_unaccent(nome))
 *
 * Essa definição NÃO apara as pontas nem colapsa espaço interno — `normalizeNome`
 * apara (`.trim()`). Hoje a diferença é inócua (nenhum dos 789 alunos tem espaço
 * anômalo), mas o nome do isaac é dado externo: um "Ana  Silva" com dois espaços
 * vindo de lá não casaria com "Ana Silva" do cadastro, e a falha seria muda — a
 * parcela cairia na fila como "sem_aluno" sem nenhuma pista do porquê.
 *
 * Por isso a comparação colapsa espaço nos DOIS lados. Do lado do banco, a
 * consulta tem que aplicar o mesmo tratamento sobre a coluna:
 *
 *     regexp_replace(nome_normalizado, '\s+', ' ', 'g') = $1
 *
 * O índice `idx_alunos_nome_normalizado` não serve para essa forma. Com 789
 * alunos o seq scan é irrelevante; se a base crescer, a saída é um índice
 * funcional sobre a mesma expressão — não afrouxar a comparação.
 */
export function normalizarNomeIsaac(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
