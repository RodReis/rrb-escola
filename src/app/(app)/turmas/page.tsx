import { AlertCircle, GraduationCap, Plus, Save } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Panel } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { createTurmaAction, toggleTurmaAction, updateTurmaAction } from "@/lib/actions/academics";
import { getAcademicData } from "@/lib/data/lookups";
import { requirePermission } from "@/lib/auth/session";

const ERRO_MENSAGEM: Record<string, string> = {
  duplicada: "Já existe uma turma com essa série, nome, ano letivo e turno.",
  turma: "Erro ao salvar turma. Tente novamente.",
};

export default async function TurmasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  await requirePermission("turmas", "read");
  const { erro } = await searchParams;
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
          <h2 className="mt-2 flex items-center gap-2 text-xl font-black text-ink">
            <Plus size={20} className="text-brand" />
            Cadastrar sala e turno
          </h2>
        </div>
        {erro ? (
          <p className="flex items-center gap-2 rounded-ui bg-clay/10 p-3 text-sm font-bold text-clay">
            <AlertCircle size={16} />
            {ERRO_MENSAGEM[erro] ?? ERRO_MENSAGEM.turma}
          </p>
        ) : null}
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
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-ink/60">
              <GraduationCap size={28} />
              <p className="text-sm font-medium">Nenhuma turma cadastrada.</p>
            </div>
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
              <button className="ds-button ds-button-primary self-end">
                <Save size={14} /> Salvar
              </button>
            </form>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
              <StatusPill tone={item.ativo ? "success" : "danger"}>{item.ativo ? "Ativa" : "Inativa"}</StatusPill>
              <span className="text-sm font-medium text-ink/60">{item.series?.nome} - {item.ano_letivo}</span>
              <form action={toggleTurmaAction}>
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="ativo" value={item.ativo ? "" : "on"} />
                <ConfirmButton
                  message={`Tem certeza que quer ${item.ativo ? "desativar" : "ativar"} a turma "${item.nome}"?`}
                  className="text-xs font-black text-clay"
                >
                  {item.ativo ? "Desativar" : "Ativar"}
                </ConfirmButton>
              </form>
            </div>
          </Panel>
        ))}
      </section>
    </div>
  );
}
