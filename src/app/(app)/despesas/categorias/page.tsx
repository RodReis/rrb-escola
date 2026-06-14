import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Sucedido pelas Categorias Financeiras do Livro-Razão (Fase 0).
export default async function CategoriasDespesaRedirect() {
  redirect("/financeiro/lancamentos/categorias");
}
