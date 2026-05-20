import { Panel } from "@/components/ui/card";
import { getAcademicData } from "@/lib/data/lookups";

type Props = {
  ano: number;
  turma_id: string;
};

export async function RematricularLoteStep2({ ano, turma_id }: Props) {
  const { series, turmas } = await getAcademicData();
  const turma = turmas.find((t) => t.id === turma_id);

  return (
    <Panel className="grid gap-6 max-w-lg">
      <div>
        <p className="ds-kicker">Passo 2 de 3</p>
        <h2 className="mt-1 text-xl font-bold text-ink">Selecione a série destino</h2>
        <p className="mt-1 text-sm text-ink/60">
          Turma: <strong>{turma?.nome ?? turma_id}</strong> · Ano: <strong>{ano}</strong>
        </p>
      </div>

      <form method="GET" className="grid gap-4">
        <input type="hidden" name="step" value="3" />
        <input type="hidden" name="ano" value={ano} />
        <input type="hidden" name="turma_id" value={turma_id} />

        <label>
          Série destino (ano {ano + 1})
          <select name="serie_dest_id" required>
            <option value="">Selecione…</option>
            {series
              .filter((s) => s.ativo)
              .map((s) => (
                <option key={s.id} value={s.id}>{s.nome}</option>
              ))}
          </select>
        </label>

        <div className="flex gap-3">
          <a
            href={`/matriculas/rematricula-lote?step=1&ano=${ano}&turma_id=${turma_id}`}
            className="ds-button ds-button-secondary"
          >
            ← Voltar
          </a>
          <button type="submit" className="ds-button ds-button-primary">
            Próximo →
          </button>
        </div>
      </form>
    </Panel>
  );
}
