import { Panel } from "@/components/ui/card";
import { RematriculaLoteTurmaPicker } from "@/components/matriculas/rematricula-lote-turma-picker";
import { getAcademicData } from "@/lib/data/lookups";

export async function RematricularLoteStep1() {
  const { turmas, series } = await getAcademicData();

  const anos = Array.from(new Set(turmas.map((t) => Number(t.ano_letivo)))).sort((a, b) => b - a);

  const ordemPorSerie = new Map(series.map((s) => [s.id as string, Number(s.ordem ?? 0)]));

  const turmasAtivas = turmas
    .filter((t) => t.ativo)
    .map((t) => ({
      id: t.id as string,
      nome: t.nome as string,
      ano_letivo: Number(t.ano_letivo),
      turno: t.turno as string,
      serieNome: (t.series as { nome: string } | null)?.nome ?? null,
      serieOrdem: ordemPorSerie.get(t.serie_id as string) ?? 0,
    }));

  return (
    <Panel className="grid gap-6">
      <div>
        <p className="ds-kicker">Passo 1 de 3</p>
        <h2 className="mt-1 text-xl font-bold text-ink">Selecione turma e ano letivo</h2>
        <p className="mt-1 max-w-prose text-sm text-muted">
          Serão listados apenas alunos com matrícula ativa na turma selecionada
          que ainda não foram re-matriculados para o próximo ano.
        </p>
      </div>

      <form method="GET" className="grid gap-4">
        <input type="hidden" name="step" value="2" />

        <div className="grid gap-4 sm:grid-cols-2">
          <RematriculaLoteTurmaPicker anos={anos} turmas={turmasAtivas} />
        </div>

        <button type="submit" className="ds-button ds-button-primary justify-self-start">
          Próximo →
        </button>
      </form>
    </Panel>
  );
}
