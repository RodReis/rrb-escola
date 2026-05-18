import { Plus } from "lucide-react";
import { createEnrollmentAction } from "@/lib/actions/academics";
import { getEnrollments } from "@/lib/data/enrollments";
import { getAcademicData } from "@/lib/data/lookups";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { StudentCombobox } from "@/components/matriculas/student-combobox";
import { MatriculasTable } from "@/components/matriculas/matriculas-table";
import { MatriculasFilters } from "@/components/matriculas/matriculas-filters";

export default async function MatriculasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const { status = "", nome = "" } = await searchParams;

  const [{ alunos, series, turmas, planos }, all, filtered] = await Promise.all([
    getAcademicData(),
    getEnrollments(),
    getEnrollments({ status: status || undefined, nome: nome || undefined }),
  ]);

  const counts = {
    all:        all.length,
    ativa:      all.filter((m) => m.status === "ativa").length,
    concluida:  all.filter((m) => m.status === "concluida").length,
    cancelada:  all.filter((m) => m.status === "cancelada").length,
    transferida:all.filter((m) => m.status === "transferida").length,
  };

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "Acadêmico", href: "/" }, { label: "Matrículas" }]}
        title="Matrículas"
        counter={all.length.toLocaleString("pt-BR")}
        description="Vínculo do aluno com série, turma, plano financeiro e histórico acadêmico."
        kpis={[
          { label: "Total",        value: all.length.toLocaleString("pt-BR") },
          { label: "Ativas",       value: counts.ativa.toLocaleString("pt-BR"), tone: "success" },
          { label: "Concluídas",   value: counts.concluida.toLocaleString("pt-BR") },
          { label: "Canceladas",   value: counts.cancelada.toLocaleString("pt-BR"), tone: "danger" },
        ]}
      />

      <Panel className="grid gap-5">
        <div>
          <p className="text-[0.66rem] font-bold uppercase tracking-[0.14em] text-ink/55">Nova matrícula</p>
          <h2 className="mt-1 text-xl font-bold text-ink">Cadastrar vínculo acadêmico</h2>
        </div>
        <form action={createEnrollmentAction} className="grid gap-4 md:grid-cols-4">
          <label className="md:col-span-2">Aluno
            <StudentCombobox alunos={alunos} />
          </label>
          <label>Série
            <select name="serie_id" required>
              {series.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
            </select>
          </label>
          <label>Turma
            <select name="turma_id" required>
              {turmas.map((item) => <option key={item.id} value={item.id}>{item.nome} — {item.ano_letivo}</option>)}
            </select>
          </label>
          <label>Plano
            <select name="plano_id">
              <option value="">Sem plano</option>
              {planos.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
            </select>
          </label>
          <label>Código<input name="codigo" /></label>
          <label>Data<input name="data_matricula" type="date" /></label>
          <label>Ano letivo<input name="ano_letivo" type="number" defaultValue={new Date().getFullYear()} /></label>
          <label>Idade<input name="idade_na_matricula" type="number" /></label>
          <label className="md:col-span-3">Observações<input name="observacoes" /></label>
          <button className="ds-button ds-button-primary self-end">
            <Plus size={14} /> Matricular
          </button>
        </form>
      </Panel>

      <div className="grid gap-4">
        <MatriculasFilters counts={counts} />
        <MatriculasTable matriculas={filtered} />
      </div>
    </div>
  );
}
