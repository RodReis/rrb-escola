import { CertificadoForm } from "@/components/historico/certificado-form";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth/session";
import { getCertificadoConfig, getEscolaCertificado } from "@/lib/data/certificados";
import { listarElegiveis } from "@/lib/data/historico-elegiveis";
import { getAcademicData, getAnosLetivosDisponiveis } from "@/lib/data/lookups";
import { SEGMENTO_PARA_NIVEL, type SegmentoSerie } from "@/lib/historico/tipos";

type Props = {
  searchParams: Promise<{
    ano?: string;
    serie?: string;
    turma?: string;
    aluno?: string;
    modo?: string;
  }>;
};

export default async function CertificadoPage({ searchParams }: Props) {
  await requirePermission("historico", "read");
  const params = await searchParams;
  const [{ series, turmas, alunos }, anosDisponiveis] = await Promise.all([
    getAcademicData(),
    getAnosLetivosDisponiveis()
  ]);

  const anoLetivo = Number(params.ano ?? new Date().getFullYear());
  const temFiltro = Boolean(params.serie || params.turma || params.aluno);

  // A série do cabeçalho: a filtrada, a da turma filtrada, ou a da matrícula
  // do aluno filtrado naquele ano letivo.
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

  // Certificado de conclusão vale para o fim de qualquer segmento (5º ano,
  // 9º ano ou 3ª série) — o nível segue o segmento da série filtrada, não é
  // mais fixo em "medio". Sem série resolvida ainda, cai em "medio" (só
  // afeta o rótulo do cabeçalho; sem filtro a lista de elegíveis vem vazia).
  const segmento = series.find((s) => (s.id as string) === serieDoFiltro)?.segmento as
    | SegmentoSerie
    | undefined;
  const nivel = segmento ? SEGMENTO_PARA_NIVEL[segmento] : "medio";

  const [config, escola, elegiveis] = await Promise.all([
    getCertificadoConfig(),
    getEscolaCertificado(serieDoFiltro as string | null, anoLetivo),
    temFiltro
      ? listarElegiveis({
          anoLetivo,
          nivel,
          serieId: params.serie,
          turmaId: params.turma,
          alunoId: params.aluno
        })
      : Promise.resolve([])
  ]);

  return (
    <div className="grid gap-8 p-6">
      <PageHeader
        breadcrumb={[
          { label: "Acadêmico", href: "/" },
          { label: "Histórico Escolar", href: "/historico/associacoes" },
          { label: "Certificado" }
        ]}
        title="Certificado de Conclusão"
        description="Emite o certificado de conclusão de etapa, com o histórico escolar anexado no verso."
      />

      <CertificadoForm
        anoLetivo={anoLetivo}
        nivel={nivel}
        anosDisponiveis={anosDisponiveis}
        config={config}
        escola={escola}
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
