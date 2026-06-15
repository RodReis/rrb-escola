import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Despesas migrou para o Livro-Razão unificado (Fase 0). Rota mantida só para
// não quebrar links antigos; redireciona preservando o mês.
export default async function DespesasRedirect({
  searchParams
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { mes } = await searchParams;
  redirect(mes ? `/financeiro/lancamentos?mes=${mes}` : "/financeiro/lancamentos");
}
