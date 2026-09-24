import { AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { DeclaracaoModeloForm } from "@/components/declaracoes/declaracao-modelo-form";
import { createDeclaracaoModeloAction } from "@/lib/actions/declaracoes";
import { requirePermission } from "@/lib/auth/session";

export default async function NovoModeloDeclaracaoPage({
  searchParams
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  await requirePermission("historico", "create");
  const sp = await searchParams;

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[
          { label: "Acadêmico" },
          { label: "Declarações", href: "/declaracoes" },
          { label: "Modelos", href: "/declaracoes/modelos" },
          { label: "Novo" }
        ]}
        title="Novo modelo de declaração"
      />
      {sp.erro ? (
        <div className="flex items-center gap-2 rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">
          <AlertCircle size={16} />
          {sp.erro}
        </div>
      ) : null}
      <Panel className="p-6">
        <DeclaracaoModeloForm action={createDeclaracaoModeloAction} submitLabel="Cadastrar" />
      </Panel>
    </div>
  );
}
