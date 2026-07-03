import { AlertCircle, Plus, Tag, Save, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { CategoriaFinanceiraCreateForm } from "@/components/lancamentos/categoria-financeira-form";
import {
  deleteCategoriaFinanceiraAction,
  updateCategoriaFinanceiraAction
} from "@/lib/actions/categorias-financeiras";
import { getCategoriasFinanceiras } from "@/lib/data/lancamentos";
import { requirePermission } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function CategoriasFinanceirasPage({
  searchParams
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  await requirePermission("financeiro.lancamentos", "read");
  const { erro } = await searchParams;
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

      {erro ? (
        <div className="flex items-center gap-2 rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">
          <AlertCircle size={16} />
          {erro}
        </div>
      ) : null}

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
                  <tr key={c.id} className="border-t border-line transition hover:bg-muted/40">
                    <td className="py-2.5 px-3">
                      <form action={updateCategoriaFinanceiraAction} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="tipo" value={c.tipo} />
                        <input name="nome" defaultValue={c.nome} required maxLength={80} />
                        <label className="flex items-center gap-1 text-xs">
                          <input type="checkbox" name="ativo" defaultChecked={c.ativo} className="h-4 w-4" />
                          ativa
                        </label>
                        <Button
                          type="submit"
                          variant="secondary"
                          title="Salvar alterações"
                          aria-label="Salvar"
                          className="!h-8 !min-w-0 !px-2"
                        >
                          <Save size={14} />
                        </Button>
                      </form>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex items-center rounded-pill px-2 py-0.5 text-xs font-semibold ${
                        c.tipo === "receita" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
                      }`}>
                        {c.tipo === "receita" ? "Receita" : "Despesa"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex items-center rounded-pill px-2 py-0.5 text-xs font-semibold ${
                        c.ativo ? "bg-success/10 text-success" : "bg-muted text-ink/60"
                      }`}>
                        {c.ativo ? "Sim" : "Não"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <form action={deleteCategoriaFinanceiraAction} className="inline">
                        <input type="hidden" name="id" value={c.id} />
                        <ConfirmButton
                          message={`Tem certeza que quer excluir a categoria "${c.nome}"?`}
                          title="Excluir categoria"
                          aria-label="Excluir"
                          className="inline-flex h-7 min-w-0 items-center justify-center rounded-ui px-2 text-danger hover:bg-danger/10"
                        >
                          <Trash2 size={14} />
                        </ConfirmButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
