/**
 * Extrai a mensagem de erro de qualquer formato — não só `instanceof Error`.
 * Erros do supabase-js (PostgrestError) são objetos planos `{message, details,
 * hint, code}`, NUNCA instâncias de Error; sem isso, todo erro real de banco
 * (RLS negando, coluna inexistente, etc.) caía no texto genérico, escondendo
 * a causa real tanto do usuário quanto do log do servidor.
 *
 * Em arquivo próprio (não em actions.ts) porque um módulo "use server" só
 * pode exportar funções async — exportar isto direto de lá quebra o build.
 */
export function mensagemDeErro(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === "object" && e !== null && "message" in e) {
    const m = (e as { message: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  return "Erro inesperado ao gerar o relatório.";
}
