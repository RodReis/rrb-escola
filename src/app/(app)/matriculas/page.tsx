import { CheckCircle2, Plus, RefreshCcw, UserPlus } from "lucide-react";
import { createEnrollmentAction } from "@/lib/actions/academics";
import { getEnrollments } from "@/lib/data/enrollments";
import { getAcademicData } from "@/lib/data/lookups";
import { getAlunosSemMatriculaNoAno } from "@/lib/data/students";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { NovaMatriculaFields } from "@/components/matriculas/nova-matricula-fields";
import { MatriculasTable } from "@/components/matriculas/matriculas-table";
import { MatriculasFilters } from "@/components/matriculas/matriculas-filters";
import { requirePermission } from "@/lib/auth/session";
import { anoLetivoDaData } from "@/lib/matriculas/ano-letivo";
import { SubmitButton } from "@/components/ui/submit-button";

export default async function MatriculasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  await requirePermission("matriculas", "read");
  const { status = "", nome = "", aluno_id = "", sucesso = "", erro = "" } = await searchParams;

  const [{ alunos, series, turmas, planos }, alunosDisponiveis, all, filtered] = await Promise.all([
    getAcademicData(),
    // Mesmo ano que o formulário sugere (setembro em diante = ano seguinte),
    // senão o combo busca "sem matrícula" no ano errado e some com quem a
    // secretaria precisa achar para rematricular (Critical C1).
    getAlunosSemMatriculaNoAno(anoLetivoDaData(new Date())),
    getEnrollments(),
    getEnrollments({ status: status || undefined, nome: nome || undefined }),
  ]);

  // Combo de nova matrícula: só alunos ativos sem matrícula no ano corrente
  // (fonte única, Task 4) — evita listar quem já está matriculado.
  // `matriculas`/`data_nascimento` propagados: NovaMatriculaFields usa para
  // sugerir série/ano e calcular idade/repetência (Critical C2).
  const alunosParaCombo = alunosDisponiveis.map((a) => ({
    id: a.id,
    nome: a.nome,
    matricula_codigo: a.matriculaCodigo ?? "",
    data_nascimento: a.dataNascimento,
    matriculas: a.matriculas,
  }));

  // alunoPre (link "matricular" vindo de outra tela) pode apontar para um
  // aluno fora do universo "sem matrícula": busca no universo completo para
  // não quebrar o preenchimento, mas o combo em si usa alunosParaCombo.
  const alunoPre = aluno_id
    ? alunos.find((a) => a.id === aluno_id) ?? null
    : null;

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
        actions={
          <ButtonLink href="/matriculas/rematricula-lote?step=1" variant="warn">
            <RefreshCcw size={14} /> Re-matricular em lote
          </ButtonLink>
        }
      />

      <Panel id="nova-matricula" className="grid gap-5">
        <div>
          <p className="text-[0.66rem] font-bold uppercase tracking-[0.14em] text-ink/60">Nova matrícula</p>
          <h2 className="mt-1 flex items-center gap-2 text-xl font-bold text-ink">
            <UserPlus size={20} className="text-brand" />
            Cadastrar vínculo acadêmico
          </h2>
        </div>
        {sucesso ? (
          <p className="flex items-center gap-2 rounded-ui bg-moss/10 p-3 text-sm font-bold text-moss">
            <CheckCircle2 size={16} />
            Matrícula cadastrada com sucesso.
          </p>
        ) : null}
        {erro ? (
          <p className="flex items-center gap-2 rounded-ui bg-clay/10 p-3 text-sm font-bold text-clay">
            Erro ao cadastrar matrícula. Tente novamente.
          </p>
        ) : null}
        <form action={createEnrollmentAction} className="grid gap-5">
          <div className="grid gap-4 md:grid-cols-4">
            <NovaMatriculaFields alunos={alunosParaCombo} series={series} turmas={turmas} alunoPre={alunoPre} />
            <label className="self-start">Plano
              <select name="plano_id">
                <option value="">Sem plano</option>
                {planos.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
              </select>
            </label>
            <label className="self-start">Data<input name="data_matricula" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label>
            <label className="self-start md:col-span-2">Observações<input name="observacoes" /></label>
          </div>
          {/* Ação fora da grade de campos: separada por borda, não compete por coluna. */}
          <div className="flex border-t border-line pt-4">
            <SubmitButton>
              <Plus size={14} /> Matricular
            </SubmitButton>
          </div>
        </form>
      </Panel>

      <div className="grid gap-4">
        <MatriculasFilters counts={counts} />
        <MatriculasTable matriculas={filtered} />
      </div>
      {alunoPre && (
        <script
          dangerouslySetInnerHTML={{
            __html:
              "document.getElementById('nova-matricula')?.scrollIntoView({behavior:'smooth',block:'start'});",
          }}
        />
      )}
    </div>
  );
}
