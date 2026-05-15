import { GraduationCap, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, Panel } from "@/components/ui/card";
import { createTurmaAction, toggleTurmaAction, updateTurmaAction } from "@/lib/actions/academics";
import { getAcademicData } from "@/lib/data/lookups";

export default async function TurmasPage() {
  const { series, turmas } = await getAcademicData();
  const activeClasses = turmas.filter((item) => item.ativo).length;
  const currentYear = new Date().getFullYear();
  const currentYearClasses = turmas.filter((item) => Number(item.ano_letivo) === currentYear).length;

  const summary = [
    ["Total", String(turmas.length)],
    ["Ativas", String(activeClasses)],
    ["Ano atual", String(currentYearClasses)],
    ["Series", String(series.length)]
  ];

  return (
    <div className="grid gap-6">
      <section className="-mx-4 -mt-6 border-b border-line bg-surface px-4 py-8 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="flex items-center gap-3 text-[0.66rem] font-black uppercase tracking-[0.16em] text-ink/58">
              <span>Academico</span>
              <span className="text-line">/</span>
              <span className="text-brand">Turmas</span>
            </p>
            <h1 className="mt-8 text-4xl font-black leading-none text-brand md:text-5xl">
              Turmas <span className="font-serif italic text-ink/42">{turmas.length}</span>
            </h1>
            <p className="mt-4 max-w-2xl text-sm font-medium leading-6 text-ink/68">
              Organizacao das salas por serie, turno, capacidade e ano letivo.
            </p>
          </div>

          <div className="grid gap-7">
            <div className="flex flex-wrap gap-2 xl:justify-end">
              <ButtonLink href="/series" variant="secondary">
                <GraduationCap size={16} /> Ver series
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
          <p className="ds-kicker">Nova turma</p>
          <h2 className="mt-2 text-xl font-black text-ink">Cadastrar sala e turno</h2>
        </div>
        <form action={createTurmaAction} className="grid gap-4 md:grid-cols-6">
          <label>
            Serie
            <select name="serie_id" required>
              {series.map((item) => (
                <option key={item.id} value={item.id}>{item.nome}</option>
              ))}
            </select>
          </label>
          <label>
            Nome
            <input name="nome" placeholder="A" required />
          </label>
          <label>
            Ano letivo
            <input name="ano_letivo" type="number" defaultValue={currentYear} />
          </label>
          <label>
            Turno
            <select name="turno">
              <option value="matutino">Matutino</option>
              <option value="vespertino">Vespertino</option>
              <option value="noturno">Noturno</option>
              <option value="integral">Integral</option>
            </select>
          </label>
          <label>
            Capacidade
            <input name="capacidade" type="number" defaultValue={30} />
          </label>
          <button className="ds-button ds-button-accent self-end">
            <Plus size={16} /> Adicionar
          </button>
        </form>
      </Panel>

      <section className="grid gap-3">
        {turmas.length === 0 ? (
          <Panel>
            <p className="text-sm font-medium text-ink/60">Nenhuma turma cadastrada.</p>
          </Panel>
        ) : null}
        {turmas.map((item) => (
          <Panel key={item.id} className="grid gap-4">
            <form action={updateTurmaAction} className="grid gap-3 lg:grid-cols-[1fr_1fr_120px_150px_120px_110px_120px]">
              <input type="hidden" name="id" value={item.id} />
              <label>
                Serie
                <select name="serie_id" defaultValue={item.serie_id} required>
                  {series.map((serie) => (
                    <option key={serie.id} value={serie.id}>{serie.nome}</option>
                  ))}
                </select>
              </label>
              <label>
                Nome
                <input name="nome" defaultValue={item.nome} required />
              </label>
              <label>
                Ano
                <input name="ano_letivo" type="number" defaultValue={item.ano_letivo} />
              </label>
              <label>
                Turno
                <select name="turno" defaultValue={item.turno}>
                  <option value="matutino">Matutino</option>
                  <option value="vespertino">Vespertino</option>
                  <option value="noturno">Noturno</option>
                  <option value="integral">Integral</option>
                </select>
              </label>
              <label>
                Capacidade
                <input name="capacidade" type="number" defaultValue={item.capacidade} />
              </label>
              <label className="flex grid-cols-none items-center gap-2 self-end pb-3">
                <input name="ativo" type="checkbox" className="h-4 w-4" defaultChecked={item.ativo} />
                Ativa
              </label>
              <button className="ds-button ds-button-primary self-end">Salvar</button>
            </form>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
              <Badge tone={item.ativo ? "green" : "red"}>{item.ativo ? "Ativa" : "Inativa"}</Badge>
              <span className="text-sm font-medium text-ink/60">{item.series?.nome} - {item.ano_letivo}</span>
              <form action={toggleTurmaAction}>
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
