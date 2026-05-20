import { Panel } from "@/components/ui/card";
import { rematricularLoteAction } from "@/lib/actions/academics";
import { listAlunosCandidatosLote } from "@/lib/data/enrollments";

type Props = {
  ano: number;
  turma_id: string;
  serie_dest_id: string;
};

export async function RematricularLoteStep3({ ano, turma_id, serie_dest_id }: Props) {
  const candidatos = await listAlunosCandidatosLote(turma_id, ano);

  if (candidatos.length === 0) {
    return (
      <Panel className="grid gap-4 max-w-lg">
        <p className="ds-kicker">Passo 3 de 3</p>
        <p className="text-sm text-ink/60">
          Nenhum aluno elegível nesta turma para re-matrícula. Todos já possuem
          matrícula ativa em {ano + 1} ou a turma não tem alunos ativos.
        </p>
        <a
          href="/matriculas/rematricula-lote?step=1"
          className="ds-button ds-button-secondary justify-self-start"
        >
          ← Recomeçar
        </a>
      </Panel>
    );
  }

  return (
    <Panel className="grid gap-6 max-w-2xl">
      <div>
        <p className="ds-kicker">Passo 3 de 3</p>
        <h2 className="mt-1 text-xl font-bold text-ink">Confirme os alunos</h2>
        <p className="mt-1 text-sm text-ink/60">
          {candidatos.length} aluno{candidatos.length !== 1 ? "s" : ""} elegível
          {candidatos.length !== 1 ? "s" : ""}. Desmarque os que não devem ser re-matriculados.
        </p>
      </div>

      <form action={rematricularLoteAction} className="grid gap-4">
        <input type="hidden" name="ano_letivo" value={ano} />
        <input type="hidden" name="turma_id" value={turma_id} />
        <input type="hidden" name="serie_dest_id" value={serie_dest_id} />

        <div className="divide-y divide-line rounded-ui border border-line">
          {candidatos.map((aluno) => (
            <label
              key={aluno.matricula_id}
              className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-surface-raised"
            >
              <input
                type="checkbox"
                name="matricula_ids"
                value={aluno.matricula_id}
                defaultChecked
                className="h-4 w-4"
              />
              <span className="text-sm text-ink">{aluno.nome}</span>
            </label>
          ))}
        </div>

        <div className="flex gap-3">
          <a
            href={`/matriculas/rematricula-lote?step=2&ano=${ano}&turma_id=${turma_id}`}
            className="ds-button ds-button-secondary"
          >
            ← Voltar
          </a>
          <button type="submit" className="ds-button ds-button-primary">
            Re-matricular {candidatos.length} aluno{candidatos.length !== 1 ? "s" : ""}
          </button>
        </div>
      </form>
    </Panel>
  );
}
