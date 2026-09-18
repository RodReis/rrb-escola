import { Panel } from "@/components/ui/card";
import { RematriculaLoteDestinoPicker } from "@/components/matriculas/rematricula-lote-destino-picker";
import { getPlanoPredominanteDaTurma } from "@/lib/data/enrollments";
import { getAcademicData } from "@/lib/data/lookups";

type Props = {
  ano: number;
  turma_id: string;
};

const TURNO_LABEL: Record<string, string> = {
  matutino: "MATUTINO",
  vespertino: "VESPERTINO",
  noturno: "NOTURNO",
  integral: "INTEGRAL",
};

export async function RematricularLoteStep2({ ano, turma_id }: Props) {
  const { series, turmas, planos } = await getAcademicData();
  const turma = turmas.find((t) => t.id === turma_id);

  const serieOrigem = turma ? series.find((s) => s.id === turma.serie_id) : null;
  const turnoLabel = turma ? TURNO_LABEL[turma.turno as string] ?? String(turma.turno).toUpperCase() : "";
  const turmaLabel = turma
    ? (turma.nome as string).trim().toUpperCase() === turnoLabel
      ? turnoLabel
      : `${turma.nome} — ${turnoLabel}`
    : turma_id;

  // A próxima série na ordem pedagógica é o destino esperado na virada de ano.
  const seriesAtivas = series.filter((s) => s.ativo).sort((a, b) => Number(a.ordem ?? 0) - Number(b.ordem ?? 0));
  const indiceOrigem = serieOrigem ? seriesAtivas.findIndex((s) => s.id === serieOrigem.id) : -1;
  const sugerida = indiceOrigem >= 0 ? seriesAtivas[indiceOrigem + 1] : undefined;

  const turmasDestino = turmas
    .filter((t) => t.ativo && Number(t.ano_letivo) === ano + 1)
    .map((t) => ({
      id: t.id as string,
      nome: t.nome as string,
      serie_id: t.serie_id as string,
      turno: t.turno as string,
    }));

  const planosAtivos = planos
    .filter((p) => p.ativo)
    .map((p) => ({ id: p.id as string, nome: p.nome as string }));

  // Plano vigente da turma de origem: serve de aviso para não repetir o do ano anterior.
  const planoOrigemNome = await getPlanoPredominanteDaTurma(turma_id, ano);

  return (
    <Panel className="grid gap-6">
      <div>
        <p className="ds-kicker">Passo 2 de 3</p>
        <h2 className="mt-1 text-xl font-bold text-ink">Selecione a série destino</h2>
      </div>

      {/* Mesma largura dos campos abaixo: resumo e formulário compartilham o eixo. */}
      <dl className="grid gap-x-8 gap-y-4 border-y border-line py-4 sm:grid-cols-3">
        <div className="grid gap-0.5">
          <dt className="text-xs font-semibold text-dim">Série de origem</dt>
          <dd className="font-bold text-ink">{serieOrigem?.nome ?? "—"}</dd>
        </div>
        <div className="grid gap-0.5">
          <dt className="text-xs font-semibold text-dim">Turma</dt>
          <dd className="font-bold text-ink">{turmaLabel}</dd>
        </div>
        <div className="grid gap-0.5">
          <dt className="text-xs font-semibold text-dim">Ano</dt>
          <dd className="font-bold tabular-nums text-ink">{ano}</dd>
        </div>
      </dl>

      <form method="GET" className="grid gap-4">
        <input type="hidden" name="step" value="3" />
        <input type="hidden" name="ano" value={ano} />
        <input type="hidden" name="turma_id" value={turma_id} />

        <RematriculaLoteDestinoPicker
          series={seriesAtivas.map((s) => ({ id: s.id as string, nome: s.nome as string }))}
          turmas={turmasDestino}
          anoDestino={ano + 1}
          serieSugeridaId={(sugerida?.id as string) ?? ""}
          serieOrigemNome={(serieOrigem?.nome as string) ?? null}
          turnoOrigem={(turma?.turno as string) ?? ""}
          planos={planosAtivos}
          planoOrigemNome={planoOrigemNome}
          voltarHref={`/matriculas/rematricula-lote?step=1&ano=${ano}&turma_id=${turma_id}`}
        />
      </form>
    </Panel>
  );
}
