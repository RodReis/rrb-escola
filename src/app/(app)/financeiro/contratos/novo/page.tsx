import { AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { ContratoForm } from "@/components/contratos/contrato-form";
import { createContratoAction } from "@/lib/actions/contratos";
import { getCategoriasFinanceiras } from "@/lib/data/lancamentos";
import { requirePermission } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function NovoContratoPage({
  searchParams
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  await requirePermission("financeiro.contratos", "create");
  const { erro } = await searchParams;
  const categorias = await getCategoriasFinanceiras({ onlyAtivos: true });

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[
          { label: "Financeiro" },
          { label: "Contratos", href: "/financeiro/contratos" },
          { label: "Novo" }
        ]}
        title="Novo contrato de receita"
        description="Defina a receita recorrente. Depois gere os lançamentos por competência."
      />

      {erro ? (
        <div className="flex items-center gap-2 rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">
          <AlertCircle size={16} /> {erro}
        </div>
      ) : null}

      <Panel className="p-6">
        <ContratoForm action={createContratoAction} categorias={categorias} submitLabel="Salvar contrato" />
      </Panel>
    </div>
  );
}
