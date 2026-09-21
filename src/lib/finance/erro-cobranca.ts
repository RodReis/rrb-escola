/**
 * As actions de `lib/actions/finance.ts` sinalizam falha redirecionando para
 * `/financeiro?erro=<slug>`. Este mapa traduz o slug para o texto que a
 * página mostra.
 *
 * Antes disso o parâmetro era simplesmente ignorado pela página: a operação
 * falhava, a tela recarregava igual e nada indicava o que houve.
 */
const ERRO_LABEL: Record<string, string> = {
  id: "Não foi possível identificar a cobrança. Recarregue a página e tente de novo.",
  campos: "Preencha a cobrança, o aluno e o valor pago.",
  paga: "Esta cobrança já está paga ou foi cancelada.",
  pagamento: "Não foi possível registrar o pagamento.",
  editar: "Não foi possível editar a cobrança. Cobranças já pagas não podem ser alteradas.",
  estornar: "Não foi possível estornar o pagamento. Ele pode já ter sido estornado.",
};

export function mensagemErroCobranca(slug: string | undefined): string | null {
  if (!slug) return null;
  return ERRO_LABEL[slug] ?? `Erro ao processar a cobrança: ${slug}`;
}
