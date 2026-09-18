import { EmissaoForm } from "@/components/historico/emissao-form";
import { requirePermission } from "@/lib/auth/session";
import { listarElegiveis } from "@/lib/data/historico-elegiveis";
import { getAcademicData } from "@/lib/data/lookups";
import type { NivelEnsino } from "@/lib/historico/tipos";

type Props = {
  searchParams: Promise<{ ano?: string; nivel?: string; serie?: string; turma?: string }>;
};

export default async function EmissaoPage({ searchParams }: Props) {
  await requirePermission("historico", "read");
  const params = await searchParams;
  const { series, turmas } = await getAcademicData();

  const anoLetivo = Number(params.ano ?? new Date().getFullYear());
  const nivel = (params.nivel ?? "fund1") as NivelEnsino;
  const temFiltro = Boolean(params.serie || params.turma);

  const elegiveis = temFiltro
    ? await listarElegiveis({
        anoLetivo,
        nivel,
        serieId: params.serie,
        turmaId: params.turma
      })
    : [];

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Emissão do Histórico Escolar</h1>
        <p className="text-sm text-muted">
          Acadêmico / Histórico e Certificado / Emissões / Emissão do histórico escolar
        </p>
      </header>

      <EmissaoForm
        anoLetivo={anoLetivo}
        nivel={nivel}
        series={series.map((s) => ({ id: s.id as string, nome: s.nome as string }))}
        turmas={turmas.map((t) => ({ id: t.id as string, nome: t.nome as string }))}
        elegiveis={elegiveis}
      />
    </div>
  );
}
