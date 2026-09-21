import { ArrowLeft, CalendarCheck, Filter, Users } from "lucide-react";
import { saveClassAttendanceAction } from "@/lib/actions/attendance";
import { getClassAttendanceData } from "@/lib/data/attendance";
import {
  getDisciplinasPorSerie,
} from "@/lib/data/lancamento-notas";
import { getNotasDoBimestre } from "@/lib/data/notas-aula";
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { ButtonLink } from "@/components/ui/button";
import { Card, Panel } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/session";
import { bimestreFromData } from "@/lib/datas/bimestre";
import { ChamadaTabs } from "@/components/frequencias/chamada-tabs";
import { DisciplinasCards } from "@/components/avaliacoes/disciplinas-cards";
import { NotasUnicoBimestreGrid } from "@/components/avaliacoes/notas-unico-bimestre-grid";
import { BimestreSelect } from "@/components/frequencias/bimestre-select";
import { SubmitButton } from "@/components/ui/submit-button";

type SearchParams = {
  turma_id?: string;
  data_aula?: string;
  tab?: string;
  disciplina?: string;
  bim?: string;
};

function isValidBim(v: string | undefined): v is "1" | "2" | "3" | "4" {
  return v === "1" || v === "2" || v === "3" || v === "4";
}

async function getSerieIdFromTurma(turmaId: string): Promise<string | null> {
  if (!turmaId) return null;
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("turmas")
    .select("serie_id")
    .eq("id", turmaId)
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .maybeSingle();
  return data?.serie_id ?? null;
}

export default async function ChamadaPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("frequencias", "update");
  const data = await getClassAttendanceData(searchParams.turma_id, searchParams.data_aula);

  const tab: "chamada" | "notas" = searchParams.tab === "notas" ? "notas" : "chamada";
  const bim = isValidBim(searchParams.bim)
    ? Number(searchParams.bim)
    : bimestreFromData(data.date);
  const disciplinaSel = searchParams.disciplina || null;
  const anoLetivo = Number(data.date.slice(0, 4));

  const serieId = data.selectedTurmaId
    ? await getSerieIdFromTurma(data.selectedTurmaId)
    : null;

  const disciplinas = serieId ? await getDisciplinasPorSerie(serieId) : [];
  const disciplinaValida =
    !!disciplinaSel && disciplinas.some((d) => d.id === disciplinaSel);

  const notasGrid =
    tab === "notas" && data.selectedTurmaId && disciplinaValida
      ? await getNotasDoBimestre(data.selectedTurmaId, disciplinaSel!, bim, anoLetivo)
      : null;

  const summary = [
    ["Turmas", String(data.turmas.length)],
    ["Alunos", String(data.students.length)],
    ["Data", data.date.split("-").reverse().join("/")],
    ["Selecionada", data.selectedTurmaId ? "Sim" : "Não"]
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
              Frequência por turma
            </h1>
            <p className="mt-4 max-w-2xl text-sm font-medium leading-6 text-ink/68">
              Marque presenças e faltas em lote para todos os alunos ativos da turma selecionada.
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
                  <dd className="mt-1 font-display text-2xl italic leading-none text-brand">{value}</dd>
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

        {data.temCalendario && !data.diaLetivo && (
          <div className="rounded-ui border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
            <p className="font-semibold">Data não letiva</p>
            <p className="mt-1 text-xs">
              {data.date.split("-").reverse().join("/")} não é um dia letivo no calendário
              (feriado, recesso ou fim de semana). Não é possível lançar frequência.
            </p>
          </div>
        )}

      {data.selectedTurmaId && <ChamadaTabs tab={tab} />}

      {tab === "chamada" && (
      <form action={saveClassAttendanceAction} className="overflow-hidden rounded-panel border border-line bg-surface shadow-soft">
        <input type="hidden" name="turma_id" value={data.selectedTurmaId} />
        <input type="hidden" name="data_aula" value={data.date} />
        <div className="grid grid-cols-[120px_1fr_150px_1.2fr] bg-muted px-5 py-3 text-xs font-black uppercase tracking-[0.1em] text-ink/62 max-lg:hidden">
          <span>Matrícula</span>
          <span>Aluno</span>
          <span>Presença</span>
          <span>Justificativa</span>
        </div>
        {data.students.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-ink/60">
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
          <SubmitButton variant="accent" disabled={data.students.length === 0 || (data.temCalendario && !data.diaLetivo)}>
            <CalendarCheck size={16} /> Salvar chamada
          </SubmitButton>
        </div>
      </form>
      )}

      {tab === "notas" && data.selectedTurmaId && (
        <div className="grid gap-4">
          <Panel className="grid gap-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-bold text-ink">Disciplinas</h2>
              <BimestreSelect value={bim} />
            </div>
            <DisciplinasCards disciplinas={disciplinas} disciplinaSel={disciplinaSel} />
          </Panel>

          {notasGrid && (
            <Panel className="grid gap-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-ink">Notas dos alunos</h3>
                <p className="text-xs text-ink/60">
                  {notasGrid.alunos.length} aluno{notasGrid.alunos.length === 1 ? "" : "s"} ·
                  salva automaticamente
                </p>
              </div>
              <NotasUnicoBimestreGrid
                key={`${data.selectedTurmaId}-${disciplinaSel}-${bim}-${anoLetivo}`}
                alunos={notasGrid.alunos}
                turmaId={data.selectedTurmaId}
                disciplinaId={disciplinaSel!}
                bimestre={bim}
                anoLetivo={anoLetivo}
                valorMaximo={notasGrid.valorMaximo}
              />
            </Panel>
          )}

          {!disciplinaValida && (
            <div className="rounded-ui bg-muted/30 p-6 text-center text-sm text-ink/60">
              Selecione uma disciplina para lançar as notas.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
