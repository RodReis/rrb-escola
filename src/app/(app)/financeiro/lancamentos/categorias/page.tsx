import { Plus, Tag } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { CategoriaFinanceiraCreateForm } from "@/components/lancamentos/categoria-financeira-form";
import { CategoriaFinanceiraRow } from "@/components/lancamentos/categoria-financeira-row";
import { getCategoriasFinanceiras } from "@/lib/data/lancamentos";
import { requirePermission } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function CategoriasFinanceirasPage() {
  await requirePermission("financeiro.lancamentos", "read");
  const categorias = await getCategoriasFinanceiras();

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[
          { label: "Financeiro" },
          { label: "Livro-Razão", href: "/financeiro/lancamentos" },
          { label: "Categorias" }
        ]}
        title="Categorias Financeiras"
        description="Classifique receitas e despesas em categorias reutilizáveis (base do DRE)."
        counter={categorias.length.toLocaleString("pt-BR")}
      />

      <Panel>
        <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-kicker text-ink/60">
          <Plus size={12} /> Nova categoria
        </h2>
        <CategoriaFinanceiraCreateForm />
      </Panel>

      <Panel>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-kicker text-ink/60">
            <Tag size={12} /> Categorias cadastradas
          </h2>
          {categorias.length > 0 && (
            <span className="text-xs text-ink/60">{categorias.length} {categorias.length === 1 ? "categoria" : "categorias"}</span>
          )}
        </div>
        {categorias.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-ui bg-muted/30 py-10 text-ink/60">
            <Tag size={24} />
            <p className="text-sm">Nenhuma categoria cadastrada.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[0.66rem] font-bold uppercase tracking-kicker text-ink/60">
                  <th className="py-2 px-3">Nome</th>
                  <th className="py-2 px-3">Tipo</th>
                  <th className="py-2 px-3">Ativa</th>
                  <th className="py-2 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {categorias.map((c) => (
                  <CategoriaFinanceiraRow key={c.id} categoria={c} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
