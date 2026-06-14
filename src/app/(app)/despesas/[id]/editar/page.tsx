import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Sucedido pelo Livro-Razão (Fase 0). O id antigo de despesa NÃO é o id do
// lançamento migrado (virou origem_id, não PK), então não dá para apontar para a
// edição específica sem um lookup. Redireciona para a lista do razão.
export default async function EditarDespesaRedirect() {
  redirect("/financeiro/lancamentos");
}
