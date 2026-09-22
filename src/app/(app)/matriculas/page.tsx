import { RefreshCcw } from "lucide-react";
import { getEnrollments } from "@/lib/data/enrollments";
import { getAcademicData } from "@/lib/data/lookups";
import { getAlunosSemMatriculaNoAno } from "@/lib/data/students";
import { PageHeader } from "@/components/ui/page-header";
import { ButtonLink } from "@/components/ui/button";
import { NovaMatriculaDialog } from "@/components/matriculas/nova-matricula-dialog";
import { MatriculasTable } from "@/components/matriculas/matriculas-table";
import { MatriculasFilters } from "@/components/matriculas/matriculas-filters";
import { requirePermission } from "@/lib/auth/session";
import { anoLetivoDaData } from "@/lib/matriculas/ano-letivo";

export default async function MatriculasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  await requirePermission("matriculas", "read");
  const { status = "", nome = "", aluno_id = "", sucesso = "", erro = "", tipo_vaga = "" } = await searchParams;

  const [{ alunos, series, turmas, planos }, alunosDisponiveis, all, filtered] = await Promise.all([
    getAcademicData(),
    // Mesmo ano que o formulário sugere (setembro em diante = ano seguinte),
    // senão o combo busca "sem matrícula" no ano errado e some com quem a
    // secretaria precisa achar para rematricular (Critical C1).
    getAlunosSemMatriculaNoAno(anoLetivoDaData(new Date())),
    getEnrollments(),
    getEnrollments({ status: status || undefined, nome: nome || undefined, tipoVaga: tipo_vaga || undefined }),
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
          <>
            <NovaMatriculaDialog
              alunos={alunosParaCombo}
              series={series}
              turmas={turmas}
              planos={planos.map((p) => ({ id: p.id, nome: p.nome }))}
              alunoPre={alunoPre}
              sucesso={Boolean(sucesso)}
              erro={Boolean(erro)}
            />
            <ButtonLink href="/matriculas/rematricula-lote?step=1" variant="warn">
              <RefreshCcw size={14} /> Re-matricular em lote
            </ButtonLink>
          </>
        }
      />

      <div className="grid gap-4">
        <MatriculasFilters counts={counts} />
        <MatriculasTable
          matriculas={filtered}
          series={series.map((s) => ({ id: s.id, nome: s.nome }))}
          turmas={turmas.map((t) => ({ id: t.id, nome: t.nome, serieId: t.serie_id }))}
          planos={planos.map((p) => ({ id: p.id, nome: p.nome }))}
        />
      </div>
    </div>
  );
}
