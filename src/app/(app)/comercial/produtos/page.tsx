import Link from "next/link";
import { Plus, Package, Pencil } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { money } from "@/lib/constants";
import { getProdutos } from "@/lib/data/comercial";
import { requirePermission } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function ProdutosPage() {
  await requirePermission("comercial.produtos", "read");
  const produtos = await getProdutos();

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "Comercial" }, { label: "Produtos" }]}
        title="Produtos"
        description="Uniformes, apostilas e outros itens à venda."
        counter={produtos.length.toLocaleString("pt-BR")}
      />

      <div className="flex justify-end">
        <ButtonLink href="/comercial/produtos/novo" variant="primary">
          <Plus size={14} /> Novo produto
        </ButtonLink>
      </div>

      {produtos.length === 0 ? (
        <Panel className="p-5">
          <div className="flex flex-col items-center justify-center gap-2 rounded-ui bg-muted/30 py-12 text-ink/60">
            <Package size={28} />
            <p className="text-sm">Nenhum produto cadastrado.</p>
            <ButtonLink href="/comercial/produtos/novo" variant="ghost" className="mt-2">
              <Plus size={14} /> Cadastrar primeiro
            </ButtonLink>
          </div>
        </Panel>
      ) : (
        <div className="grid gap-4">
          {produtos.map((p) => (
            <Panel key={p.id} className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-ink">{p.nome}</h2>
                  <span className="inline-flex items-center rounded-pill bg-muted px-2 py-0.5 text-xs font-semibold text-ink/60">{p.tipo}</span>
                  {p.controla_estoque && (
                    <span className="inline-flex items-center rounded-pill bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">estoque</span>
                  )}
                  {!p.ativo && (
                    <span className="inline-flex items-center rounded-pill bg-muted px-2 py-0.5 text-xs font-semibold text-ink/60">inativo</span>
                  )}
                </div>
                <Link
                  href={`/comercial/produtos/${p.id}/editar`}
                  className="inline-flex items-center gap-1 text-sm text-ink/60 hover:text-brand"
                >
                  <Pencil size={14} /> Editar
                </Link>
              </div>
              {p.variacoes.length === 0 ? (
                <p className="text-sm text-ink/60">Sem variações. Adicione na edição.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-[0.66rem] font-bold uppercase tracking-kicker text-ink/60">
                      <th className="py-1.5 px-2">SKU</th>
                      <th className="py-1.5 px-2">Atributos</th>
                      <th className="py-1.5 px-2 text-right">Preço</th>
                      <th className="py-1.5 px-2 text-right">Estoque mín.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.variacoes.map((v) => (
                      <tr key={v.id} className="border-t border-line">
                        <td className="py-1.5 px-2 text-ink/70">{v.sku ?? "—"}</td>
                        <td className="py-1.5 px-2 text-ink/70">
                          {Object.entries(v.atributos).map(([k, val]) => `${k}: ${val}`).join(", ") || "—"}
                        </td>
                        <td className="py-1.5 px-2 text-right tabular-nums">{money.format(v.preco_venda)}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums">{v.estoque_minimo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
