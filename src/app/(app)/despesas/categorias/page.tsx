import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CategoriaCreateForm } from "@/components/despesas/categoria-form";
import {
  deleteCategoriaAction,
  updateCategoriaAction
} from "@/lib/actions/categorias-despesa";
import { getCategorias } from "@/lib/data/despesas";

export const dynamic = "force-dynamic";

export default async function CategoriasDespesaPage({
  searchParams
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
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
        <div className="rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">{erro}</div>
      ) : null}

      <Panel>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Nova categoria</h2>
        <CategoriaCreateForm />
      </Panel>

      <Panel>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Categorias cadastradas</h2>
        {categorias.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma categoria cadastrada.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-2">Nome</th>
                <th className="py-2">Ativa</th>
                <th className="py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {categorias.map((c) => (
                <tr key={c.id} className="border-t border-line">
                  <td className="py-2">
                    <form action={updateCategoriaAction} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={c.id} />
                      <input name="nome" defaultValue={c.nome} required maxLength={80} />
                      <label className="flex items-center gap-1 text-xs">
                        <input type="checkbox" name="ativo" defaultChecked={c.ativo} className="h-4 w-4" />
                        ativa
                      </label>
                      <Button type="submit" variant="secondary">Salvar</Button>
                    </form>
                  </td>
                  <td className="py-2">{c.ativo ? "Sim" : "Não"}</td>
                  <td className="py-2 text-right">
                    <form action={deleteCategoriaAction} className="inline">
                      <input type="hidden" name="id" value={c.id} />
                      <Button type="submit" variant="ghost">Excluir</Button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
