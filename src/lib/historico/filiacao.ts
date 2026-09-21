type Responsavel = { nome: string; parentesco: string | null };

const ORDEM_PARENTESCO = ["pai", "mãe", "mae"];

function posicao(parentesco: string | null): number {
  const i = ORDEM_PARENTESCO.indexOf((parentesco ?? "").toLowerCase().trim());
  return i === -1 ? ORDEM_PARENTESCO.length : i;
}

/**
 * Filiação impressa no histórico: "PAI e MÃE", em caixa alta, nessa ordem —
 * é como o documento oficial da escola apresenta. Responsáveis sem parentesco
 * de pai/mãe (avó, tio) entram depois, e só se não houver nenhum dos dois.
 */
export function montarFiliacao(responsaveis: Responsavel[]): string | null {
  const pais = responsaveis.filter((r) => posicao(r.parentesco) < ORDEM_PARENTESCO.length);
  const escolhidos = pais.length > 0 ? pais : responsaveis;
  if (escolhidos.length === 0) return null;

  return escolhidos
    .slice()
    .sort((a, b) => posicao(a.parentesco) - posicao(b.parentesco))
    .map((r) => r.nome.toUpperCase().trim())
    .join(" e ");
}
