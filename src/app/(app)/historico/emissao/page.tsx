import { EmissaoForm } from "@/components/historico/emissao-form";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth/session";
import { listarElegiveis } from "@/lib/data/historico-elegiveis";
import { getAcademicData, getAnosLetivosDisponiveis } from "@/lib/data/lookups";
import { SEGMENTO_PARA_NIVEL, type NivelEnsino, type SegmentoSerie } from "@/lib/historico/tipos";

type Props = {
  searchParams: Promise<{
    ano?: string;
    nivel?: string;
    serie?: string;
    turma?: string;
    aluno?: string;
  }>;
};

export default async function EmissaoPage({ searchParams }: Props) {
  await requirePermission("historico", "read");
  const params = await searchParams;
  const [{ series, turmas, alunos }, anosDisponiveis] = await Promise.all([
    getAcademicData(),
    getAnosLetivosDisponiveis()
  ]);

  const anoLetivo = Number(params.ano ?? new Date().getFullYear());
  const temFiltro = Boolean(params.serie || params.turma || params.aluno);

  // Ao chegar pela ficha do aluno (link direto com ?aluno=<id>) não vem nível
  // na URL. Deriva do segmento da série matriculada, como o certificado já faz;
  // sem isso o default "fund1" mostra a grade errada para infantil/fund2/médio.
  const serieDoAluno = params.aluno
    ? (alunos.find((a) => (a.id as string) === params.aluno)?.matriculas as
        | Array<{ ano_letivo: number; serie_id: string }>
        | undefined
      )?.find((m) => m.ano_letivo === anoLetivo)?.serie_id
    : null;
  const serieDoFiltro =
    params.serie ??
    turmas.find((t) => (t.id as string) === params.turma)?.serie_id ??
    serieDoAluno ??
    null;
  const segmento = series.find((s) => (s.id as string) === serieDoFiltro)?.segmento as
    | SegmentoSerie
    | undefined;
  const nivel = (params.nivel as NivelEnsino | undefined)
    ?? (segmento ? SEGMENTO_PARA_NIVEL[segmento] : "fund1");

  const elegiveis = temFiltro
    ? await listarElegiveis({
        anoLetivo,
        nivel,
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
          { label: "Emissão" }
        ]}
        title="Emissão do Histórico Escolar"
        description="Gera o PDF oficial do histórico, pronto para assinatura, a partir das notas já lançadas."
      />

      <EmissaoForm
        anoLetivo={anoLetivo}
        nivel={nivel}
        anosDisponiveis={anosDisponiveis}
        series={series.map((s) => ({ id: s.id as string, nome: s.nome as string }))}
        turmas={turmas.map((t) => {
          const serie = t.series as { nome?: string } | null;
          return {
            id: t.id as string,
            nome: t.nome as string,
            turno: t.turno as string,
            serieId: t.serie_id as string,
            serieNome: serie?.nome ?? "",
            anoLetivo: t.ano_letivo as number
          };
        })}
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
