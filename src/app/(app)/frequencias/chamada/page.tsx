import { ArrowLeft, CalendarCheck, Filter, Users } from "lucide-react";
import { saveClassAttendanceAction } from "@/lib/actions/attendance";
import { getClassAttendanceData } from "@/lib/data/attendance";
import { ButtonLink } from "@/components/ui/button";
import { Card, Panel } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/session";

type SearchParams = {
  turma_id?: string;
  data_aula?: string;
};

export default async function ChamadaPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("frequencias", "update");
  const data = await getClassAttendanceData(searchParams.turma_id, searchParams.data_aula);

  const summary = [
    ["Turmas", String(data.turmas.length)],
    ["Alunos", String(data.students.length)],
    ["Data", data.date.split("-").reverse().join("/")],
    ["Selecionada", data.selectedTurmaId ? "Sim" : "Nao"]
  ];

  return (
    <div className="grid gap-6">
      <section className="-mx-4 -mt-6 border-b border-line bg-surface px-4 py-8 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="flex items-center gap-3 text-[0.66rem] font-black uppercase tracking-[0.16em] text-ink/58">
              <span>Chamada</span>
              <span className="text-line">/</span>
              <span className="text-brand">Turma</span>
            </p>
            <h1 className="mt-8 text-4xl font-black leading-none text-brand md:text-5xl">
              Frequencia por turma
            </h1>
            <p className="mt-4 max-w-2xl text-sm font-medium leading-6 text-ink/68">
              Marque presencas e faltas em lote para todos os alunos ativos da turma selecionada.
            </p>
          </div>

          <div className="grid gap-7">
            <div className="flex flex-wrap gap-2 xl:justify-end">
              <ButtonLink href="/frequencias" variant="secondary">
                <ArrowLeft size={16} /> Voltar
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
          <p className="ds-kicker">Filtro</p>
          <h2 className="mt-2 flex items-center gap-2 text-xl font-black text-ink">
            <Filter size={20} className="text-brand" />
            Selecionar turma e data
          </h2>
        </div>
        <form action="/frequencias/chamada" className="grid gap-4 md:grid-cols-[1fr_220px_150px]">
          <label>
            Turma
            <select name="turma_id" defaultValue={data.selectedTurmaId}>
              {data.turmas.map((turma) => (
                <option key={turma.id} value={turma.id}>
                  {turma.series?.nome} {turma.nome} - {turma.ano_letivo}
                </option>
              ))}
            </select>
          </label>
          <label>
            Data
            <input name="data_aula" type="date" defaultValue={data.date} />
          </label>
          <button className="ds-button ds-button-primary self-end">Carregar</button>
        </form>
      </Panel>

      <form action={saveClassAttendanceAction} className="overflow-hidden rounded-panel border border-line bg-surface shadow-soft">
        <input type="hidden" name="turma_id" value={data.selectedTurmaId} />
        <input type="hidden" name="data_aula" value={data.date} />
        <div className="grid grid-cols-[120px_1fr_150px_1.2fr] bg-muted px-5 py-3 text-xs font-black uppercase tracking-[0.1em] text-ink/62 max-lg:hidden">
          <span>Matricula</span>
          <span>Aluno</span>
          <span>Presenca</span>
          <span>Justificativa</span>
        </div>
        {data.students.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-ink/40">
            <Users size={28} />
            <p className="text-sm font-medium">Nenhum aluno ativo nesta turma.</p>
          </div>
        ) : (
          data.students.map((row) => (
            <div key={row.alunoId} className="grid gap-3 border-t border-line px-5 py-4 lg:grid-cols-[120px_1fr_150px_1.2fr] lg:items-center">
              <input type="hidden" name="aluno_id" value={row.alunoId} />
              <input type="hidden" name={`matricula_id_${row.alunoId}`} value={row.matriculaId} />
              <span className="text-sm font-black text-brand">{row.aluno?.matricula_codigo}</span>
              <strong className="text-sm text-ink">{row.aluno?.nome}</strong>
              <label className="flex grid-cols-none items-center gap-2">
                <input
                  name={`presente_${row.alunoId}`}
                  type="checkbox"
                  className="h-4 w-4"
                  defaultChecked={row.attendance?.presente ?? true}
                />
                Presente
              </label>
              <input name={`justificativa_${row.alunoId}`} defaultValue={row.attendance?.justificativa ?? ""} />
            </div>
          ))
        )}
        <div className="flex justify-end border-t border-line p-4">
          <button className="ds-button ds-button-accent" disabled={data.students.length === 0}>
            <CalendarCheck size={16} /> Salvar chamada
          </button>
        </div>
      </form>
    </div>
  );
}
