import { HistoricoAbas } from "@/components/historico/historico-abas";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth/session";
import { getHistoricoAluno, listarAnosMatriculados } from "@/lib/data/historico";
import { getAcademicData } from "@/lib/data/lookups";
import type { NivelEnsino } from "@/lib/historico/tipos";

type Props = {
  searchParams: Promise<{ aluno?: string; nivel?: string }>;
};

export default async function EntradaNotasPage({ searchParams }: Props) {
  await requirePermission("historico", "read");
  const params = await searchParams;
  const { alunos, series } = await getAcademicData();

  const alunoId = params.aluno ?? "";
  const nivel = (params.nivel ?? "fund1") as NivelEnsino;
  const historico = alunoId ? await getHistoricoAluno(alunoId, nivel) : null;
  const anosMatriculados = alunoId ? await listarAnosMatriculados(alunoId) : [];

  return (
    <div className="grid gap-8 p-6">
      <PageHeader
        breadcrumb={[
          { label: "Acadêmico", href: "/" },
          { label: "Histórico Escolar", href: "/historico/associacoes" },
          { label: "Entrada de Notas" }
        ]}
        title="Entrada de Notas"
        description="Lança e revisa as notas que compõem o histórico escolar de cada aluno."
      />

      <HistoricoAbas
        alunos={alunos.map((a) => ({
          id: a.id as string,
          nome: a.nome as string,
          matricula_codigo: a.matricula_codigo as string
        }))}
        series={series.map((s) => ({ id: s.id as string, nome: s.nome as string }))}
        alunoId={alunoId}
        nivel={nivel}
        historico={historico}
        anosMatriculados={anosMatriculados}
      />
    </div>
  );
}
