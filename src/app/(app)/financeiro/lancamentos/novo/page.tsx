import { AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { LancamentoForm } from "@/components/lancamentos/lancamento-form";
import { createLancamentoAction } from "@/lib/actions/lancamentos";
import { getCategoriasFinanceiras } from "@/lib/data/lancamentos";
import { requirePermission } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function NovoLancamentoPage({
  searchParams
}: {
  searchParams: Promise<{ erro?: string; mes?: string }>;
}) {
  await requirePermission("financeiro.lancamentos", "create");
  const { erro } = await searchParams;
  const categorias = await getCategoriasFinanceiras({ onlyAtivos: true });

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[
          { label: "Financeiro" },
          { label: "Livro-Razão", href: "/financeiro/lancamentos" },
          { label: "Novo" }
        ]}
        title="Novo lançamento"
        description="Registre uma receita ou despesa no livro-razão."
      />

      {erro ? (
        <div className="flex items-center gap-2 rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">
          <AlertCircle size={16} />
          {erro}
        </div>
      ) : null}

      <Panel className="p-6">
        <LancamentoForm action={createLancamentoAction} categorias={categorias} submitLabel="Salvar" />
      </Panel>
    </div>
  );
}
