import { notFound } from "next/navigation";
import { AlertCircle, FileText, Paperclip } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { LancamentoForm } from "@/components/lancamentos/lancamento-form";
import { UploadComprovanteLancamento } from "@/components/lancamentos/upload-comprovante-lancamento";
import { updateLancamentoAction } from "@/lib/actions/lancamentos";
import { getCategoriasFinanceiras, getLancamentoById } from "@/lib/data/lancamentos";
import { requirePermission } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function EditarLancamentoPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  await requirePermission("financeiro.lancamentos", "update");
  const { id } = await params;
  const { erro } = await searchParams;
  const [lancamento, categorias] = await Promise.all([
    getLancamentoById(id),
    getCategoriasFinanceiras()
  ]);
  if (!lancamento) notFound();

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[
          { label: "Financeiro" },
          { label: "Livro-Razão", href: "/financeiro/lancamentos" },
          { label: "Editar" }
        ]}
        title="Editar lançamento"
        description={lancamento.descricao}
      />

      {erro ? (
        <div className="flex items-center gap-2 rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">
          <AlertCircle size={16} />
          {erro}
        </div>
      ) : null}

      <Panel className="p-6">
        <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-kicker text-ink/55">
          <FileText size={12} /> Dados
        </h2>
        <LancamentoForm
          action={updateLancamentoAction}
          categorias={categorias}
          initial={lancamento}
          submitLabel="Atualizar"
        />
      </Panel>

      <Panel className="p-6">
        <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-kicker text-ink/55">
          <Paperclip size={12} /> Comprovante
        </h2>
        <UploadComprovanteLancamento lancamentoId={lancamento.id} currentPath={lancamento.comprovante_path} />
      </Panel>
    </div>
  );
}
