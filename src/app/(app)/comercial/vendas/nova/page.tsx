import { AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { VendaForm } from "@/components/comercial/venda-form";
import { createVendaAction } from "@/lib/actions/comercial";
import { getVariacoesAtivas } from "@/lib/data/comercial";
import { requirePermission } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function NovaVendaPage({
  searchParams
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  await requirePermission("comercial.vendas", "create");
  const { erro } = await searchParams;
  const variacoes = await getVariacoesAtivas();

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[
          { label: "Comercial" },
          { label: "Vendas", href: "/comercial/vendas" },
          { label: "Nova" }
        ]}
        title="Nova venda"
        description="Monte a venda; depois confirme na lista para gerar a receita."
      />

      {erro ? (
        <div className="flex items-center gap-2 rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">
          <AlertCircle size={16} />
          {erro}
        </div>
      ) : null}

      <Panel className="p-6">
        <VendaForm action={createVendaAction} variacoes={variacoes} />
      </Panel>
    </div>
  );
}
