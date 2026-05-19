import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { DespesaForm } from "@/components/despesas/despesa-form";
import { UploadComprovante } from "@/components/despesas/upload-comprovante";
import { updateDespesaAction } from "@/lib/actions/despesas";
import { getCategorias, getDespesaById } from "@/lib/data/despesas";
import { requirePermission } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function EditarDespesaPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  await requirePermission("despesas", "update");
  const { id } = await params;
  const { erro } = await searchParams;
  const [despesa, categorias] = await Promise.all([
    getDespesaById(id),
    getCategorias()
  ]);
  if (!despesa) notFound();

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "Despesas", href: "/despesas" }, { label: "Editar" }]}
        title="Editar despesa"
        description={despesa.descricao}
      />

      {erro ? (
        <div className="rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">{erro}</div>
      ) : null}

      <Panel className="p-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Dados</h2>
        <DespesaForm
          action={updateDespesaAction}
          categorias={categorias}
          initial={despesa}
          submitLabel="Atualizar"
        />
      </Panel>

      <Panel className="p-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Comprovante</h2>
        <UploadComprovante despesaId={despesa.id} currentPath={despesa.comprovante_path} />
      </Panel>
    </div>
  );
}
