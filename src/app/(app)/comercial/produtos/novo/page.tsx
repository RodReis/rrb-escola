import { AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { ProdutoForm } from "@/components/comercial/produto-form";
import { createProdutoAction } from "@/lib/actions/comercial";
import { requirePermission } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function NovoProdutoPage({
  searchParams
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  await requirePermission("comercial.produtos", "create");
  const { erro } = await searchParams;

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[
          { label: "Comercial" },
          { label: "Produtos", href: "/comercial/produtos" },
          { label: "Novo" }
        ]}
        title="Novo produto"
        description="Cadastre o produto; as variações (SKU) você adiciona na edição."
      />

      {erro ? (
        <div className="flex items-center gap-2 rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">
          <AlertCircle size={16} />
          {erro}
        </div>
      ) : null}

      <Panel className="p-6">
        <ProdutoForm action={createProdutoAction} submitLabel="Salvar e adicionar variações" />
      </Panel>
    </div>
  );
}
