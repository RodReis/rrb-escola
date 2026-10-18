import { RequerimentoEmissaoForm } from "@/components/matriculas/requerimento-emissao-form";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth/session";
import { getAcademicData, getAnosLetivosDisponiveis } from "@/lib/data/lookups";
import { listarAlunosParaRequerimento } from "@/lib/data/requerimento-matricula";
import { getAnoReferenciaAtual } from "@/lib/escola/ano-referencia";
import { createServerClient } from "@/lib/supabase/server";

type Props = {
  searchParams: Promise<{ ano?: string; serie?: string; turma?: string; aluno?: string; modo?: string }>;
};

export default async function RequerimentoPage({ searchParams }: Props) {
  const session = await requirePermission("historico", "read");
  const params = await searchParams;
  const [{ series, turmas, alunos }, anosDisponiveis, anoReferencia] = await Promise.all([
    getAcademicData(),
    getAnosLetivosDisponiveis(),
    getAnoReferenciaAtual(await createServerClient(), session.profile.escola_id)
  ]);

  const anoLetivo = Number(params.ano ?? anoReferencia);
  // Igual à emissão do histórico: só lista depois de um filtro, para não
  // despejar a escola inteira na tela (e num PDF de centenas de páginas).
  const temFiltro = Boolean(params.serie || params.turma || params.aluno);

  const elegiveis = temFiltro
    ? await listarAlunosParaRequerimento({
        anoLetivo,
        serieId: params.serie,
        turmaId: params.turma,
        alunoId: params.aluno
      })
    : [];

  return (
    <div className="grid gap-8 p-6">
      <PageHeader
        breadcrumb={[
          { label: "Acadêmico", href: "/" },
          { label: "Histórico Escolar", href: "/historico/associacoes" },
          { label: "Requerimento" }
        ]}
        title="Requerimento de Matrícula"
        description="Gera a ficha de requerimento em PDF — uma página A4 por aluno, pronta para assinatura do secretário e do responsável financeiro."
      />

      <RequerimentoEmissaoForm
        anoLetivo={anoLetivo}
        anosDisponiveis={anosDisponiveis}
        series={series.map((s) => ({ id: s.id as string, nome: s.nome as string }))}
        turmas={turmas
          .filter((t) => (t.ano_letivo as number) === anoLetivo)
          .map((t) => ({ id: t.id as string, serieId: t.serie_id as string, turno: String(t.turno) }))
          .sort((a, b) => a.turno.localeCompare(b.turno))}
        alunos={alunos.map((a) => ({
          id: a.id as string,
          nome: a.nome as string,
          matricula_codigo: a.matricula_codigo as string
        }))}
        elegiveis={elegiveis}
      />
    </div>
  );
}
