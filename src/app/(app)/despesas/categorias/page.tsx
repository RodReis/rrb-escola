import { AlertCircle, Plus, Tag, Save, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CategoriaCreateForm } from "@/components/despesas/categoria-form";
import {
  deleteCategoriaAction,
  updateCategoriaAction
} from "@/lib/actions/categorias-despesa";
import { getCategorias } from "@/lib/data/despesas";
import { requirePermission } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function CategoriasDespesaPage({
  searchParams
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  await requirePermission("despesas", "read");
  const { erro } = await searchParams;
  const categorias = await getCategorias();

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "Despesas", href: "/despesas" }, { label: "Categorias" }]}
        title="Categorias de Despesa"
        description="Classifique despesas em categorias reutilizáveis."
        counter={categorias.length.toLocaleString("pt-BR")}
      />

      {erro ? (
        <div className="flex items-center gap-2 rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">
          <AlertCircle size={16} />
          {erro}
        </div>
      ) : null}

      <Panel>
        <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-kicker text-ink/55">
          <Plus size={12} /> Nova categoria
        </h2>
        <CategoriaCreateForm />
      </Panel>

      <Panel>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-kicker text-ink/55">
            <Tag size={12} /> Categorias cadastradas
          </h2>
          {categorias.length > 0 && (
            <span className="text-xs text-ink/45">{categorias.length} {categorias.length === 1 ? "categoria" : "categorias"}</span>
          )}
        </div>
        {categorias.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-ui bg-muted/30 py-10 text-ink/40">
            <Tag size={24} />
            <p className="text-sm">Nenhuma categoria cadastrada.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">
                  <th className="py-2 px-3">Nome</th>
                  <th className="py-2 px-3">Ativa</th>
                  <th className="py-2 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {categorias.map((c) => (
                  <tr key={c.id} className="border-t border-line transition hover:bg-muted/40">
                    <td className="py-2.5 px-3">
                      <form action={updateCategoriaAction} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={c.id} />
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
                        c.ativo ? "bg-success/10 text-success" : "bg-muted text-ink/55"
                      }`}>
                        {c.ativo ? "Sim" : "Não"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <form action={deleteCategoriaAction} className="inline">
                        <input type="hidden" name="id" value={c.id} />
                        <Button
                          type="submit"
                          variant="ghost"
                          title="Excluir categoria"
                          aria-label="Excluir"
                          className="!h-7 !min-w-0 !px-2 text-danger hover:bg-danger/10"
                        >
                          <Trash2 size={14} />
                        </Button>
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
