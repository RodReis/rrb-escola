import { Layers3, Plus, Save } from "lucide-react";
import { createSerieAction, toggleSerieAction, updateSerieAction } from "@/lib/actions/academics";
import { ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { getAcademicData } from "@/lib/data/lookups";
import { requirePermission } from "@/lib/auth/session";

export default async function SeriesPage() {
  await requirePermission("series", "read");
  const { series, turmas } = await getAcademicData();
  const activeSeries = series.filter((item) => item.ativo).length;

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "Acadêmico" }, { label: "Séries" }]}
        title="Séries"
        counter={series.length.toLocaleString("pt-BR")}
        description="Estrutura de etapas escolares usada para organizar turmas e matrículas."
        actions={
          <ButtonLink href="/turmas" variant="secondary">
            <Layers3 size={14} /> Ver turmas
          </ButtonLink>
        }
        kpis={[
          { label: "Total",             value: series.length.toLocaleString("pt-BR") },
          { label: "Ativas",            value: activeSeries.toLocaleString("pt-BR"), tone: "success" },
          { label: "Inativas",          value: (series.length - activeSeries).toLocaleString("pt-BR"), tone: "danger" },
          { label: "Turmas vinculadas", value: turmas.length.toLocaleString("pt-BR") }
        ]}
      />

      <Panel className="grid gap-5">
        <div>
          <p className="ds-kicker">Nova serie</p>
          <h2 className="mt-2 flex items-center gap-2 text-xl font-black text-ink">
            <Plus size={20} className="text-brand" />
            Cadastrar etapa escolar
          </h2>
        </div>
        <form action={createSerieAction} className="grid gap-4 md:grid-cols-[1fr_160px_150px]">
          <label>
            Nome
            <input name="nome" placeholder="6 Ano" required />
          </label>
          <label>
            Ordem
            <input name="ordem" type="number" defaultValue={1} />
          </label>
          <button className="ds-button ds-button-primary self-end">
            <Plus size={14} /> Adicionar
          </button>
        </form>
      </Panel>

      <section className="grid gap-3">
        {series.length === 0 ? (
          <Panel>
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-ink/40">
              <Layers3 size={28} />
              <p className="text-sm font-medium">Nenhuma serie cadastrada.</p>
            </div>
          </Panel>
        ) : null}
        {series.map((item) => (
          <Panel key={item.id} className="grid gap-4">
            <form action={updateSerieAction} className="grid gap-3 md:grid-cols-[1fr_130px_120px_120px]">
              <input type="hidden" name="id" value={item.id} />
              <label>
                Nome
                <input name="nome" defaultValue={item.nome} required />
              </label>
              <label>
                Ordem
                <input name="ordem" type="number" defaultValue={item.ordem} />
              </label>
              <label className="flex grid-cols-none items-center gap-2 self-end pb-3">
                <input name="ativo" type="checkbox" className="h-4 w-4" defaultChecked={item.ativo} />
                Ativa
              </label>
              <button className="ds-button ds-button-primary self-end">
                <Save size={14} /> Salvar
              </button>
            </form>
            <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
              <StatusPill tone={item.ativo ? "success" : "danger"}>{item.ativo ? "Ativa" : "Inativa"}</StatusPill>
              <form action={toggleSerieAction}>
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="ativo" value={item.ativo ? "" : "on"} />
                <button className="text-xs font-black text-clay">{item.ativo ? "Desativar" : "Ativar"}</button>
              </form>
            </div>
          </Panel>
        ))}
      </section>
    </div>
  );
}
