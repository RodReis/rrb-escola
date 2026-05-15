import { Layers3, Plus } from "lucide-react";
import { createSerieAction, toggleSerieAction, updateSerieAction } from "@/lib/actions/academics";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, Panel } from "@/components/ui/card";
import { getAcademicData } from "@/lib/data/lookups";

export default async function SeriesPage() {
  const { series, turmas } = await getAcademicData();
  const activeSeries = series.filter((item) => item.ativo).length;

  const summary = [
    ["Total", String(series.length)],
    ["Ativas", String(activeSeries)],
    ["Inativas", String(series.length - activeSeries)],
    ["Turmas vinculadas", String(turmas.length)]
  ];

  return (
    <div className="grid gap-6">
      <section className="-mx-4 -mt-6 border-b border-line bg-surface px-4 py-8 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="flex items-center gap-3 text-[0.66rem] font-black uppercase tracking-[0.16em] text-ink/58">
              <span>Academico</span>
              <span className="text-line">/</span>
              <span className="text-brand">Series</span>
            </p>
            <h1 className="mt-8 text-4xl font-black leading-none text-brand md:text-5xl">
              Series <span className="font-serif italic text-ink/42">{series.length}</span>
            </h1>
            <p className="mt-4 max-w-2xl text-sm font-medium leading-6 text-ink/68">
              Estrutura de etapas escolares usada para organizar turmas e matriculas.
            </p>
          </div>

          <div className="grid gap-7">
            <div className="flex flex-wrap gap-2 xl:justify-end">
              <ButtonLink href="/turmas" variant="secondary">
                <Layers3 size={16} /> Ver turmas
              </ButtonLink>
            </div>
            <dl className="grid gap-0 sm:grid-cols-4">
              {summary.map(([label, value]) => (
                <div key={label} className="border-line py-1 sm:border-l sm:px-6 first:sm:border-l-0">
                  <dt className="text-xs font-medium text-ink/62">{label}</dt>
                  <dd className="mt-1 font-serif text-2xl italic leading-none text-brand">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {summary.map(([label, value]) => (
          <Card key={label} className="p-5">
            <p className="ds-kicker">{label}</p>
            <strong className="mt-3 block text-3xl font-black text-ink">{value}</strong>
          </Card>
        ))}
      </section>

      <Panel className="grid gap-5">
        <div>
          <p className="ds-kicker">Nova serie</p>
          <h2 className="mt-2 text-xl font-black text-ink">Cadastrar etapa escolar</h2>
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
          <button className="ds-button ds-button-accent self-end">
            <Plus size={16} /> Adicionar
          </button>
        </form>
      </Panel>

      <section className="grid gap-3">
        {series.length === 0 ? (
          <Panel>
            <p className="text-sm font-medium text-ink/60">Nenhuma serie cadastrada.</p>
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
              <button className="ds-button ds-button-primary self-end">Salvar</button>
            </form>
            <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
              <Badge tone={item.ativo ? "green" : "red"}>{item.ativo ? "Ativa" : "Inativa"}</Badge>
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
