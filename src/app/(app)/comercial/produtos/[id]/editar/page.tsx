import { notFound } from "next/navigation";
import { AlertCircle, CheckCircle2, FileText, Tags } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { ProdutoForm } from "@/components/comercial/produto-form";
import { VariacaoForm } from "@/components/comercial/variacao-form";
import { VariacaoRowItem } from "@/components/comercial/variacao-row";
import { updateProdutoAction, createVariacaoAction } from "@/lib/actions/comercial";
import { getProdutoById } from "@/lib/data/comercial";
import { requirePermission } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function EditarProdutoPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string; ok?: string }>;
}) {
  await requirePermission("comercial.produtos", "update");
  const { id } = await params;
  const { erro, ok } = await searchParams;
  const produto = await getProdutoById(id);
  if (!produto) notFound();

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[
          { label: "Comercial" },
          { label: "Produtos", href: "/comercial/produtos" },
          { label: "Editar" }
        ]}
        title="Editar produto"
        description={produto.nome}
      />

      {erro ? (
        <div className="flex items-center gap-2 rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">
          <AlertCircle size={16} />
          {erro}
        </div>
      ) : null}

      {ok ? (
        <div className="flex items-center gap-2 rounded-ui bg-success/10 p-3 text-sm font-semibold text-success">
          <CheckCircle2 size={16} />
          {ok}
        </div>
      ) : null}

      <Panel className="p-6">
        <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-kicker text-ink/60">
          <FileText size={12} /> Dados
        </h2>
        <ProdutoForm action={updateProdutoAction} initial={produto} submitLabel="Atualizar" />
      </Panel>

      <Panel className="p-6">
        <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-kicker text-ink/60">
          <Tags size={12} /> Variações (SKU)
        </h2>

        {produto.variacoes.length > 0 && (
          <table className="mb-5 w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[0.66rem] font-bold uppercase tracking-kicker text-ink/60">
                <th className="py-1.5 px-2">SKU</th>
                <th className="py-1.5 px-2 text-right">Preço</th>
                <th className="py-1.5 px-2 text-right">Custo</th>
                <th className="py-1.5 px-2 text-right">Estoque mín.</th>
                <th className="py-1.5 px-2">Ativa</th>
                <th className="py-1.5 px-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {produto.variacoes.map((v) => (
                <VariacaoRowItem key={v.id} v={v} produtoId={produto.id} />
              ))}
            </tbody>
          </table>
        )}

        <VariacaoForm action={createVariacaoAction} produtoId={produto.id} />
        <p className="mt-2 text-xs text-ink/60">Saldo de estoque entra na Fase 2; aqui você só define o cadastro e o mínimo.</p>
      </Panel>
    </div>
  );
}
