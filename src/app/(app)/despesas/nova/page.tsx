import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { DespesaForm } from "@/components/despesas/despesa-form";
import { createDespesaAction } from "@/lib/actions/despesas";
import { getCategorias } from "@/lib/data/despesas";
import { requirePermission } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function NovaDespesaPage({
  searchParams
}: {
  searchParams: Promise<{ erro?: string; mes?: string }>;
}) {
  await requirePermission("despesas", "create");
  const { erro } = await searchParams;
  const categorias = await getCategorias({ onlyAtivos: true });

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "Despesas", href: "/despesas" }, { label: "Nova" }]}
        title="Nova despesa"
        description="Cadastre uma despesa operacional do mês."
      />

      {erro ? (
        <div className="rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">{erro}</div>
      ) : null}

      <Panel className="p-6">
        <DespesaForm action={createDespesaAction} categorias={categorias} submitLabel="Salvar" />
      </Panel>
    </div>
  );
}
