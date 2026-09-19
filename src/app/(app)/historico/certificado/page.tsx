import { CertificadoForm } from "@/components/historico/certificado-form";
import { requirePermission } from "@/lib/auth/session";
import { getCertificadoConfig, getEscolaCertificado } from "@/lib/data/certificados";
import { listarElegiveis } from "@/lib/data/historico-elegiveis";
import { getAcademicData } from "@/lib/data/lookups";

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
  const { series, turmas, alunos } = await getAcademicData();

  const anoLetivo = Number(params.ano ?? new Date().getFullYear());
  const temFiltro = Boolean(params.serie || params.turma || params.aluno);

  // O certificado de conclusão é do Ensino Médio: é o nível cujo verso tem
  // histórico a imprimir. Por isso o nível não é escolha da tela.
  const nivel = "medio" as const;

  // A série do cabeçalho: a filtrada, ou a da turma filtrada.
  const serieDoFiltro =
    params.serie ?? turmas.find((t) => (t.id as string) === params.turma)?.serie_id ?? null;

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
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Certificado de Conclusão</h1>
        <p className="text-sm text-muted">
          Acadêmico / Histórico e Certificado / Emissões / Certificado de conclusão
        </p>
      </header>

      <CertificadoForm
        anoLetivo={anoLetivo}
        nivel={nivel}
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
