/**
 * O client do Supabase nao lanca excecao quando o banco recusa a operacao:
 * `insert/update/delete/upsert` resolvem com `{ data: null, error }`. Escrever
 *
 *     await supabase.from("x").insert({ ... });
 *     revalidatePath("/x");
 *
 * descarta esse `error`, revalida a pagina e devolve sucesso ao usuario — que
 * ve a confirmacao e a linha que nunca foi gravada. Ver
 * `supabase-error-silenciado.test.ts` para a prova do comportamento.
 *
 * `assertOk` transforma a recusa do banco em excecao, que o error boundary do
 * app (`src/app/(app)/error.tsx`) ou o `useAction` exibem.
 *
 *     assertOk(await supabase.from("x").insert({ ... }), "Nao foi possivel salvar");
 */

type RespostaSupabase<T> = { data: T; error: { message: string; code?: string } | null };

/** Erros do Postgres que merecem texto proprio em vez da mensagem crua. */
const POR_CODIGO: Record<string, string> = {
  "23505": "Já existe um registro com esses dados.",
  "23503": "Registro vinculado a outros dados e não pode ser alterado.",
  "23502": "Faltou preencher um campo obrigatório.",
  "42501": "Você não tem permissão para esta operação.",
};

export function assertOk<T>(resposta: RespostaSupabase<T>, contexto?: string): T {
  const { data, error } = resposta;
  if (!error) return data;

  const amigavel = error.code ? POR_CODIGO[error.code] : undefined;
  // A mensagem crua do Postgres vai para o log do servidor; o usuario recebe
  // o texto de contexto da action.
  console.error("[supabase]", contexto ?? "", error.code ?? "", error.message);

  throw new Error(amigavel ?? contexto ?? "Não foi possível concluir a operação.");
}
