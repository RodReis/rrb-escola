import { notFound } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { DeclaracaoModeloForm } from "@/components/declaracoes/declaracao-modelo-form";
import { updateDeclaracaoModeloAction } from "@/lib/actions/declaracoes";
import { getDeclaracaoModeloById } from "@/lib/data/declaracoes";
import { requirePermission } from "@/lib/auth/session";

export default async function EditarModeloDeclaracaoPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  await requirePermission("historico", "update");
  const { id } = await params;
  const sp = await searchParams;

  const modelo = await getDeclaracaoModeloById(id);
  if (!modelo) notFound();

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[
          { label: "Acadêmico" },
          { label: "Declarações", href: "/declaracoes/modelos" },
          { label: "Modelos", href: "/declaracoes/modelos" },
          { label: modelo.nome }
        ]}
        title="Editar modelo de declaração"
      />
      {sp.erro ? (
        <div className="flex items-center gap-2 rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">
          <AlertCircle size={16} />
          {sp.erro}
        </div>
      ) : null}
      <Panel className="p-6">
        <DeclaracaoModeloForm action={updateDeclaracaoModeloAction} modelo={modelo} submitLabel="Salvar alterações" />
      </Panel>
    </div>
  );
}
