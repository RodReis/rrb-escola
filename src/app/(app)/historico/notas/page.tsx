import { HistoricoAbas } from "@/components/historico/historico-abas";
import { requirePermission } from "@/lib/auth/session";
import { getHistoricoAluno } from "@/lib/data/historico";
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

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Histórico Escolar — Entrada de Notas</h1>
        <p className="text-sm text-muted-foreground">
          Acadêmico / Histórico e Certificado / Histórico Escolar — Entrada de notas
        </p>
      </header>

      <HistoricoAbas
        alunos={alunos.map((a) => ({ id: a.id as string, nome: a.nome as string }))}
        series={series.map((s) => ({ id: s.id as string, nome: s.nome as string }))}
        alunoId={alunoId}
        nivel={nivel}
        historico={historico}
      />
    </div>
  );
}
