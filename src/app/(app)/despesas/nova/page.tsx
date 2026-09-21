import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Sucedido pelo Livro-Razão (Fase 0). Redireciona para o cadastro unificado.
export default async function NovaDespesaRedirect({
  searchParams
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { mes } = await searchParams;
  redirect(mes ? `/financeiro/lancamentos/novo?mes=${mes}` : "/financeiro/lancamentos/novo");
}
