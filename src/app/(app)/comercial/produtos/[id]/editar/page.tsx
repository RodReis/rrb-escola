import { notFound } from "next/navigation";
import { AlertCircle, FileText, Plus, Tags } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProdutoForm } from "@/components/comercial/produto-form";
import { updateProdutoAction, createVariacaoAction } from "@/lib/actions/comercial";
import { getProdutoById } from "@/lib/data/comercial";
import { money } from "@/lib/constants";
import { requirePermission } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function EditarProdutoPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  await requirePermission("comercial.produtos", "update");
  const { id } = await params;
  const { erro } = await searchParams;
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

      <Panel className="p-6">
        <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-kicker text-ink/55">
          <FileText size={12} /> Dados
        </h2>
        <ProdutoForm action={updateProdutoAction} initial={produto} submitLabel="Atualizar" />
      </Panel>

      <Panel className="p-6">
        <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-kicker text-ink/55">
          <Tags size={12} /> Variações (SKU)
        </h2>

        {produto.variacoes.length > 0 && (
          <table className="mb-5 w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">
                <th className="py-1.5 px-2">SKU</th>
                <th className="py-1.5 px-2 text-right">Preço</th>
                <th className="py-1.5 px-2 text-right">Custo</th>
                <th className="py-1.5 px-2 text-right">Estoque mín.</th>
                <th className="py-1.5 px-2">Ativa</th>
              </tr>
            </thead>
            <tbody>
              {produto.variacoes.map((v) => (
                <tr key={v.id} className="border-t border-line">
                  <td className="py-1.5 px-2 text-ink/70">{v.sku ?? "—"}</td>
                  <td className="py-1.5 px-2 text-right tabular-nums">{money.format(v.preco_venda)}</td>
                  <td className="py-1.5 px-2 text-right tabular-nums">{money.format(v.custo)}</td>
                  <td className="py-1.5 px-2 text-right tabular-nums">{v.estoque_minimo}</td>
                  <td className="py-1.5 px-2">{v.ativo ? "Sim" : "Não"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <form action={createVariacaoAction} className="grid gap-3 md:grid-cols-5 items-end">
          <input type="hidden" name="produto_id" value={produto.id} />
          <label>
            SKU
            <input name="sku" maxLength={60} placeholder="Ex.: CAM-M" />
          </label>
          <label>
            Preço
            <input type="number" name="preco_venda" step="0.01" min="0" required defaultValue="0" />
          </label>
          <label>
            Custo
            <input type="number" name="custo" step="0.01" min="0" defaultValue="0" />
          </label>
          <label>
            Estoque mín.
            <input type="number" name="estoque_minimo" step="1" min="0" defaultValue="0" />
          </label>
          <Button type="submit" variant="secondary">
            <Plus size={14} /> Adicionar
          </Button>
        </form>
        <p className="mt-2 text-xs text-ink/45">Saldo de estoque entra na Fase 2; aqui você só define o cadastro e o mínimo.</p>
      </Panel>
    </div>
  );
}
