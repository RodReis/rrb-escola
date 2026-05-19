import { GraduationCap, Plus } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { createTurmaAction, toggleTurmaAction, updateTurmaAction } from "@/lib/actions/academics";
import { getAcademicData } from "@/lib/data/lookups";
import { requirePermission } from "@/lib/auth/session";

export default async function TurmasPage() {
  await requirePermission("turmas", "read");
  const { series, turmas } = await getAcademicData();
  const activeClasses = turmas.filter((item) => item.ativo).length;
  const currentYear = new Date().getFullYear();
  const currentYearClasses = turmas.filter((item) => Number(item.ano_letivo) === currentYear).length;

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "Acadêmico" }, { label: "Turmas" }]}
        title="Turmas"
        counter={turmas.length.toLocaleString("pt-BR")}
        description="Organização das salas por série, turno, capacidade e ano letivo."
        actions={
          <ButtonLink href="/series" variant="secondary">
            <GraduationCap size={14} /> Ver séries
          </ButtonLink>
        }
        kpis={[
          { label: "Total",     value: turmas.length.toLocaleString("pt-BR") },
          { label: "Ativas",    value: activeClasses.toLocaleString("pt-BR"), tone: "success" },
          { label: "Ano atual", value: currentYearClasses.toLocaleString("pt-BR") },
          { label: "Séries",    value: series.length.toLocaleString("pt-BR") }
        ]}
      />

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
          <button className="ds-button ds-button-primary self-end">
            <Plus size={14} /> Adicionar
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
              <StatusPill tone={item.ativo ? "success" : "danger"}>{item.ativo ? "Ativa" : "Inativa"}</StatusPill>
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
